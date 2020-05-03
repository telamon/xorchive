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

  async store (data) {
    const PAD_L = this.padSize
    await this._prepIndex()
    let o = 0
    const key = []
    while (o < data.length) {
      const chunk = data.slice(o, Math.min(o + PAD_L, data.length))
      o += PAD_L
      const padIds = await this._selectUniqueRandom(this.c)
      const pads = await Promise.all(padIds.map(this._getPad.bind(this)))
      const cpad = Buffer.allocUnsafe(PAD_L)
      for (let i = 0; i < PAD_L; i++) {
        cpad[i] = chunk[i]
        for (let j = 0; j < pads.length; j++) {
          cpad[i] ^= pads[j][(i + j + 1) % PAD_L]
        }
      }
      const ch = await this._storePad(cpad)
      const chunkKey = [ch, ...padIds]
      // console.log('Enc,chunkKey')
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
    if (key.length / nPads !== HL) throw new Error('InvalidParameters')
    const nChunks = key.length / HL / nPads
    if (Math.floor(nChunks) !== nChunks) throw new Error('InvalidParameters')
    const waste = []
    for (let i = 0; i < nChunks; i++) {
      const kOff = i * nPads
      // console.log('Dec,chunkKey')
      const pads = []
      for (let j = 0; j < nPads; j++) {
        const pid = (key.slice(kOff + j * HL, kOff + (j + 1) * HL))
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
      waste.push(out)
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
