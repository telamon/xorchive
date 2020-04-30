// SPDX-License-Identifier: AGPL-3.0-or-later
// Sorry this code was written in haste and is messier than usual.
const { defer } = require('deferinfer')
const { hash } = require('blake3')
const { randomBytes } = require('crypto')

const PAD_L = 128 << 10 // 128kB pads
const HL = 32 // 32byte hash length

module.exports = class Xorchive {
  constructor (storage, defaultPadCount = 7) {
    this.storage = storage
    this.c = defaultPadCount
    this._indexDirty = true
    this._index = null
    this._pids = []
  }

  async _prepIndex () {
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
      if (err.message !== 'Could not satisfy length') throw err
    }
    this._indexDirty = false

    // generate new upto twice of compound count
    // if needed
    while (this._pids.length < this.c * 2) {
      const buf = randomBytes(PAD_L)
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
    const h = hash(buf, HL)
    const file = this.storage(fnameOf(h))
    await defer(d => file.write(0, buf, d))
    this._indexDirty = true
    this._pids.push(h)
    return h
  }

  async _getPad (id) {
    const file = this.storage(fnameOf(id))
    const pad = await defer(done => file.read(0, PAD_L, done))
    // TODO: cache pad
    return pad
  }

  async store (data) {
    await this._prepIndex()
    let o = 0
    const key = []
    while (o < data.length) {
      const chunk = data.slice(o, Math.min(o + PAD_L, data.length))
      o += PAD_L
      const padIds = this._selectUniqueRandom(this.c)
      const pads = await Promise.all(padIds.map(this._getPad.bind(this)))
      const cpad = Buffer.allocUnsafe(PAD_L)
      for (let i = 0; i < PAD_L; i++) {
        cpad[i] = pads.reduce((c, n) => c ^ n[i], chunk[i] || 0)
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
        out[x] = pads.reduce((c, n) => c ^ n[x], 0)
      }
      // yield out // Async generator?
      // Should probably synchroneously return a readable stream
      // but this is a quick and dirty impl so let's waste some memory.
      waste.push(out)
    }
    return Buffer.concat(waste)
  }

  _selectUniqueRandom (c) {
    const out = []
    const can = [...this._pids]
    while (out.length < c) {
      // Is this random enough?
      out.push(can.sort(() => 0.5 - Math.random()).shift())
    }
    return out
  }
}

function fnameOf (hash) {
  const hexstr = hash.toString('hex')
  return hexstr.slice(0, 2) + '/' + hexstr
}
