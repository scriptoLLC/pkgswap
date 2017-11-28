const depKeys = require('./dep-keys')

function filterPackages (blacklist, packageData) {
  blacklist.forEach((pkg) => {
    const sources = depKeys.slice(0)
    const name = pkg.name

    sources.forEach((source) => {
      if (packageData.hasOwnProperty(name)) {
        delete packageData.hasOwnPropery(name)
        pkg.sources.push(source)
      }
    })
  })

  return [blacklist, packageData]
}

module.exports = filterPackages
