// SPDX-License-Identifier: AGPL-3.0-or-later
// Sorry this code was written in haste and is messier than usual.
const { defer } = require('deferinfer')
const { hash } = require('blake3')
const { randomBytes } = require('crypto')
const randomNumber = require('pure-random-number')
const S128K = 128 << 10 // 128kB pads

module.exports = class Xorchive {
  constructor (storage, defaultPadCount = 7, padSize = S128K, hashSize = 32) {
    this.storage = storage
    this.c = defaultPadCount
    this._indexDirty = true
    this._index = null
    this._pids = []
    this.padSize = padSize
    this.hashSize = hashSize
  }

  async _prepIndex () {
    const PAD_L = this.padSize
    const HL = this.hashSize
    if (this._index) return false
    // Load existing INDEX file if available
    if (!this._index) this._index = this.storage('INDEX')
    try {
      let o = 0
      while (true) {
        const padId = await defer(d => this._index.read(o, HL, d))
        this._pids.push(padId)
        o += HL
      }
    } catch (err) {
      if (err.message !== 'Could not satisfy length' &&
        err.code !== 'ENOENT') throw err
    }
    this._indexDirty = false

    // generate new upto twice of compound count
    // if needed
    while (this._pids.length < this.c * 2) {
      const buf = await defer(d => randomBytes(PAD_L, d))
      await this._storePad(buf)
    }
    await this._storeIndex()
    return this
  }

  /* The index is only useful while generating new
   * content, it could be omitted during distribution
   */
  _storeIndex () {
    if (!this._indexDirty) return
    return defer(d => this._index.write(0, Buffer.concat(this._pids), d))
      .then(r => {
        this._indexDirty = false
        return r
      })
  }

  async _storePad (buf) {
    const HL = this.hashSize
    const h = hash(buf, HL)
    const file = this.storage(fnameOf(h))
    await defer(d => file.write(0, buf, d))
    this._indexDirty = true
    this._pids.push(h)
    return h
  }

  async _getPad (id) {
    const PAD_L = this.padSize
    const file = this.storage(fnameOf(id))
    const pad = await defer(done => file.read(0, PAD_L, done))
    // TODO: cache pad
    return pad
  }

  /* The returned key size will be
   * keyBytes = (input / PAD_LENGTH (?+1)) * (padCount + 1) * HASH_LENGTH
   * Storing a 12MB file using 128KB pads with 8 pads for each chunk
   * will cause a 24576B key. Not too shabby
   * (12 << 20) / (128 << 10) * 8 * 32 = 24576
   * Using bigger pads like 1MB will cause the same key to shrink to 3072B
   */
  async store (data, nPads) {
    const PAD_L = this.padSize
    await this._prepIndex()
    let o = 0
    const key = []
    while (o < data.length) {
      let chunk = data.slice(o, Math.min(o + PAD_L, data.length))

      if (o + PAD_L >= data.length) { // Detect last chunk
        const lastChunkSize = data.length - o
        // TODO: When you can't fit the size-uint and yet the last chunk is smaller
        // than the pad :/
        if (lastChunkSize + 4 > PAD_L) throw new Error('Please open an issue: telamon/xorchive')
        // we can use varint encoding here but i don't wanna add more depends
        // for a flawed method. Suggestions appreciated.
        const tmp = Buffer.alloc(chunk.length + 4) // Intentional safe alloc
        // 1. Stash lastChunkSize as Uint32
        tmp.writeUInt32BE(lastChunkSize, 0)
        // 2. Relocate chunk data to 4 bytes.
        chunk.copy(tmp, 4)
        // 3. overwrite chunk reference
        chunk = tmp
        console.log('Packed chunk marker', lastChunkSize)
      }
      o += PAD_L

      const padIds = await this._selectUniqueRandom(nPads || this.c)
      const pads = await Promise.all(padIds.map(this._getPad.bind(this)))
      const cpad = Buffer.allocUnsafe(PAD_L)
      for (let i = 0; i < PAD_L; i++) {
        cpad[i] = chunk[i] || 0 // Zero-pad missing length.
        for (let j = 0; j < pads.length; j++) {
          cpad[i] ^= pads[j][(i + j + 1) % PAD_L]
        }
      }
      const ch = await this._storePad(cpad)
      const chunkKey = [ch, ...padIds]
      // console.log('Enc key of chunk #', o / PAD_L)
      // console.log(chunkKey.map(k => k.hexSlice(0, 8)).join('\n'))
      key.push(Buffer.concat(chunkKey))
    }
    await this._storeIndex()
    return Buffer.concat(key)
  }

  async recover (key, nC) {
    const HL = this.hashSize
    const PAD_L = this.padSize
    const nPads = (nC || this.c) + 1 // The oneUp is for the pad containing the encrypted data
    const nChunks = key.length / HL / nPads
    if (Math.floor(nChunks) !== nChunks) throw new Error('InvalidParameters')
    const waste = []
    for (let i = 0; i < nChunks; i++) {
      const kOff = i * nPads * HL
      // console.log('Dec key of chunk #', i)
      const pads = []
      for (let j = 0; j < nPads; j++) {
        const pid = key.slice(kOff + j * HL, kOff + (j + 1) * HL)
        // console.log(pid.hexSlice(0, 8))
        const pad = await this._getPad(pid)
        pads.push(pad)
      }

      const out = Buffer.allocUnsafe(PAD_L)
      for (let x = 0; x < PAD_L; x++) {
        out[x] = 0
        for (let j = 0; j < pads.length; j++) {
          out[x] ^= pads[j][(x + j) % PAD_L]
        }
      }

      // yield out // Async generator?
      // Should probably synchroneously return a readable stream
      // but this is a quick and dirty impl so let's waste some memory.
      if (i + 1 !== nChunks) waste.push(out)
      else {
        // last chunk should contain a length-marker at the first 4 bytes.
        const dataSize = out.readUInt32BE(0)
        if (dataSize + 4 > PAD_L) throw new Error(`Not chunkSize marker ${dataSize} + 4 > ${PAD_L}`)
        waste.push(out.slice(4, 4 + dataSize))
      }
    }
    return Buffer.concat(waste)
  }

  async _selectUniqueRandom (c) {
    const out = []
    while (out.length < c) {
      const rn = await randomNumber(0, this._pids.length - 1)
      if (out.indexOf(rn) !== -1) continue
      out.push(rn)
    }
    return out.map(i => this._pids[i])
  }
}

function fnameOf (hash) {
  const hexstr = hash.toString('hex')
  return hexstr.slice(0, 2) + '/' + hexstr
}
