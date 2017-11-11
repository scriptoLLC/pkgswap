const depKeys = require('./dep-keys')

function buildDeps (packageData) {
  const deps = {}
  depKeys.forEach((key) => {
    deps[key] = Object.keys(packageData[key] || {})
  })
  return deps
}

module.exports = buildDeps
