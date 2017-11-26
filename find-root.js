const fs = require('fs')
const path = require('path')

function findRoot (p) {
  try {
    fs.lstatSync(path.join(p, 'package.json'))
    return p
  } catch (_) {
    if (p === '/') {
      return ''
    }
    return findRoot(p.split(path.sep).slice(0, -1).join(path.sep))
  }
}

module.exports = findRoot
