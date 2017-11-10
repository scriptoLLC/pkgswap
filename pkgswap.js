const fs = require('fs')
const exec = require('child_process').exec

const findRoot = require('find-root')
const sanitize = require('sanitize-filename')

function PkgSwap () {
  this._packageRoot = findRoot(process.cwd())
}

PkgSwap.prototype.init = function (name, cb) {
  name = sanitize(name)

  if (!name) {
    setImmediate
  }

  const newConfig = this._makeConfigName(name)

  fs.stat(newConfig, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
      }
      return cb(err)
    }
    slamdek
  })

}

PkgSwap.prototype._makeConfigName = function (name) {
  return path.join(this._packageRoot, `.pkgswap.${name}.json`)
}

module.exports = PkgSwap
