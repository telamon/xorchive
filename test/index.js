const test = require('tape')
const { readFileSync } = require('fs')
const ram = require('random-access-memory')
const Xorchive = require('..')

const opened = {}
const ramFS = path => {
  if (!opened[path]) opened[path] = ram()
  return opened[path]
}

test('setup', async t => {
  try {
    const xorfs = new Xorchive(ramFS)
    const testData = readFileSync('./yarn.lock')
    const xkey = await xorfs.store(testData)
    const dat = await xorfs.recover(xkey)
    t.equal(
      testData.slice(0, 20).toString('utf8'),
      dat.slice(0, 20).toString('utf8')
    )
    // Sanity check:
    // l=[120,55,234,85];l.reduce((c,n)=>c^n, l.reduce((c,n)=>c^n, 255)) // => 255
    const x2 = new Xorchive(ramFS, 10)

    const k2 = await x2.store(testData)
    const d2 = await x2.recover(k2)
    t.equal(
      testData.slice(0, 20).toString('utf8'),
      d2.slice(0, 20).toString('utf8')
    )
  } catch (err) { t.error(err) }
  t.end()
})
