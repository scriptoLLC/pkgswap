const buildDeps = require('./build-deps')

function skel () {
  return {blacklist: buildDeps({})}
}

module.exports = skel
