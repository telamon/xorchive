[`pure | mod`](https://github.com/telamon/create-pure)
[`code style | standard`](https://standardjs.com/)
# xorchive

> Hyperdimensional lockbox - Non-enumerable blob storage.

A variant implementation of [OFFS technique](https://en.wikipedia.org/wiki/OFFSystem).

Files stored in this archive are mixed with witenoise,
without the `key` a file cannot be recovered, let alone proven to have been stored.
Each pad in the archive might or might not be part of multiple files.

- Sits ontop of [random-access-storage](https://github.com/random-access-storage) (works in browser + node)
- [XOR-pad encrypts](https://en.wikipedia.org/wiki/XOR_cipher) contents (default 7 pads)
- Unknown total amount of files
- Unique key for each file
- Uses blake3 to hash pads into keys

## <a name="install"></a> Install

```
yarn add xorchive
```

## <a name="usage"></a> Usage

```
const raf = require('random-access-file')
const Xorchive = require('xorchive')

const xfs = new Xorchive(raf('myStuff/'), nPads = 7)

let k1 = await xfs.store(readFileSync('~/secret_evidence.md'))
const k2 = await xfs.store(readFileSync('~/README.md'))
// Each key is (32 * nPads) bytes in size

const doc = await xfs.recover(k2)

let k1 = null // secret_evidence.md is now lost forever,
// and there's no proof of it ever having been stored.
```

## API

### `new Xorchive(storage, nPads = 7, padSize = 128kB, hashSize = 32)`

Initialized a new archive.

- `nPads` number of random pads to use for chunk encryption.
- `padSize` the size of a pad. defaults to `128 << 10`
- `hashSize` blake3 hashSize


### `store(data)`

Encrypts your data as `data.length / padSize` chunks and
returns a Promise for a `key`-buffer containing all the hashes of the pads
used during encryption.


- `data` accepts Buffer, UInt8Array and Array

### `recover(key)`

Attempts to find all the pads referenced in the key and reconstruct the
original data.

returns a Promsie that resolves to your original data if
the key is valid.

## Donations

```ad
 _____                      _   _           _
|  __ \   Help Wanted!     | | | |         | |
| |  | | ___  ___ ___ _ __ | |_| |     __ _| |__  ___   ___  ___
| |  | |/ _ \/ __/ _ \ '_ \| __| |    / _` | '_ \/ __| / __|/ _ \
| |__| |  __/ (_|  __/ | | | |_| |___| (_| | |_) \__ \_\__ \  __/
|_____/ \___|\___\___|_| |_|\__|______\__,_|_.__/|___(_)___/\___|

If you're reading this it means that the docs are missing or in a bad state.

Writing and maintaining friendly and useful documentation takes
effort and time. In order to do faster releases
I will from now on provide documentation relational to project activity.

  __How_to_Help____________________________________.
 |                                                 |
 |  - Open an issue if you have ANY questions! :)  |
 |  - Star this repo if you found it interesting   |
 |  - Fork off & help document <3                  |
 |.________________________________________________|

I publish all of my work as Libre software and will continue to do so,
drop me a penny at Patreon to help fund experiments like these.

Patreon: https://www.patreon.com/decentlabs
Discord: https://discord.gg/K5XjmZx
Telegram: https://t.me/decentlabs_se
```


## <a name="changelog"></a> Changelog

### 1.2.0
- added API docs
- "fixed" data-length returned by Xorchive#recover() in most cases
### 1.1.0
- added pad rotatation by oridnal to make the order of pads significant.
- fixed chunked store/recover

### 1.0.0
- first release

## <a name="contribute"></a> Contributing

By making a pull request, you agree to release your modifications under
the license stated in the next section.

Only changesets by human contributors will be accepted.

## License

GNU AGPLv3 © Tony Ivanov
