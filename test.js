const test = require('tape')
const { readFileSync } = require('fs')
const ram = require('random-access-memory')
const { randomBytes } = require('crypto')
const Xorchive = require('.')

const RamFS = () => {
  const opened = {}
  return path => {
    if (!opened[path]) opened[path] = ram()
    return opened[path]
  }
}

test('setup', async t => {
  try {
    const store = RamFS()
    const xorfs = new Xorchive(store)
    const testData = readFileSync('./yarn.lock')
    const xkey = await xorfs.store(testData)
    const dat = await xorfs.recover(xkey)
    t.equal(
      testData.slice(0, 20).toString('utf8'),
      dat.slice(0, 20).toString('utf8')
    )
    // Sanity check:
    // l=[120,55,234,85];l.reduce((c,n)=>c^n, l.reduce((c,n)=>c^n, 255)) // => 255
    const x2 = new Xorchive(store, 10)

    const k2 = await x2.store(testData)
    const d2 = await x2.recover(k2)
    t.equal(
      testData.slice(0, 20).toString('utf8'),
      d2.slice(0, 20).toString('utf8')
    )
  } catch (err) { t.error(err) }
  t.end()
})

test('chunks', async t => {
  try {
    const store = RamFS()
    const input = randomBytes(512)
    const x1 = new Xorchive(store, 7, 64) // Set pad size to 64 bytes.
    const key = await x1.store(input)

    const x2 = new Xorchive(store, 7, 64)
    const output = await x2.recover(key)
    t.ok(output.equals(input))
  } catch (e) { t.error(e) }
  t.end()
})

test('lengths', async t => {
  try {
    const store = RamFS()
    const input = randomBytes(55)
    const x1 = new Xorchive(store)
    const key = await x1.store(input)

    const x2 = new Xorchive(store)
    const output = await x2.recover(key)
    t.equal(output.length, input.length)
  } catch (e) { t.error(e) }
  t.end()
})
