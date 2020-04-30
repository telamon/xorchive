[![Build Status](https://travis-ci.com/telamon/xorchive.svg?branch=master)](https://travis-ci.com/telamon/xorchive)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
# xorchive

> Hyper dimensional storage

A loose implementation of [OFFS technique](https://en.wikipedia.org/wiki/OFFSystem).

No way to tell how many entries an archive contains.
Each pad in the archive might or might not be part of multiple files.

- Sits ontop of [random-access-storage](https://github.com/random-access-storage)
- [XOR-pad encrypts](https://en.wikipedia.org/wiki/XOR_cipher) contents (default 7 pads)
- Unknown total amount of files
- Unique key for each file
- Uses blake3 to hash pads into keys

## <a name="install"></a> Install

```
yarn add xorchive

# -OR-

npm i --save xorchive
```

## <a name="usage"></a> Usage

```
const raf = require('random-access-file')
const Xorchive = require('xorchive')

const xfs = new Xorchive(raf('myStuff/'), nPads = 7)

const k1 = await xfs.store(readFileSync('~/secret_evidence.md'))
const k2 = await xfs.store(readFileSync('~/README.md'))
// Each key is (32 * nPads) bytes in size

const doc = await xfs.recover(k2)
```
## Ad

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

## <a name="contribute"></a> Contributing

Ideas and contributions to the project are welcome. But you must follow the [guidelines](https://github.com/telamon/xorchive/blob/master/CONTRIBUTING.md).

## License

GNU AGPLv3 © Tony Ivanov
