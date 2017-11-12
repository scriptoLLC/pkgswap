const fs = require('fs')

function exists (fn, cb) {
  fs.stat(fn, (err, stat) => {
    if (err) {
      return cb(err)
    }
    if (!stat.isFile()) {
      const err = new Error(`${fn} is not a file`)
      return cb(err)
    }
    cb()
  })
}

module.exports = exists
