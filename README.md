# PKGSWAP

A tool to manage multiple package.json files to allow for different sets of modules
for ease of development.

npm 5 radicially changes how npm operations on your node_modules directory on disk,
attempting, after each operation, to generate an "ideal tree". This tool makes
it easier to explain what your "ideal tree" is for a particular instance.

## Usage

```js
> var PkgSwap = require('pkgswap')
> var ps = new PkgSwap()
> ps.init()
> ps.create('my workspace', (err) => console.log(err || 'done'))
> ps.enable('my workspace', (err) => console.log(err || 'done'))
> ps.disable((err) => console.log(err || 'done'))
```

(CLI coming soon)

## Licence
Copyright © 2017 Scripto, LLC. All rights reserved.
