const fs = require('fs')

const parse = require('fast-json-parse')
const waterfall = require('run-waterfall')

function readPackage (dest, cb) {
  waterfall([
    (done) => fs.readFile(dest, 'utf8', done),
    parsePkg
  ], cb)

  function parsePkg (pkgData, done) {
    const res = parse(pkgData)

    if (res.err) {
      return done(res.error)
    }
    done(null, res.value || {})
  }
}

module.exports = readPackage
