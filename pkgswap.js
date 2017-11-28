const fs = require('fs')
const path = require('path')

const series = require('run-series')
const waterfall = require('run-waterfall')
const parallel = require('run-parallel')

const parse = require('fast-json-parse')
const sanitize = require('sanitize-filename')
const stringify = require('fast-safe-stringify')
const debug = require('debug')('pkgswap')

const findRoot = require('./find-root')
const depKeys = require('./dep-keys')
const buildDeps = require('./build-deps')
const skel = require('./skel')
const filterPackages = require('./filter-package')
const readPackage = require('./read-package')
const exists = require('./exists')

const pkgNS = 'pkgswap'

function PkgSwap (wd) {
  if (!(this instanceof PkgSwap)) return new PkgSwap(wd)

  this._packageRoot = findRoot(wd || process.cwd()) || '/'
  this._master = path.join(this._packageRoot, '.pkgswap.package.json')
  this._package = path.join(this._packageRoot, 'package.json')
  this._initialized = false

  try {
    const stat = fs.lstatSync(this._package)
    if (stat.isSymbolicLink()) {
      debug(`${this._package} is a symlink, initialized`)
      this._initialized = true
    }
    debug(`${this._package} is not a symlink`)
  } catch (err) {
    debug(`No package.json found ${wd} or any of it's parent directories`)
    throw err
  }
}

// opts:
//  * force:boolean - don't care if there is a symlink already present
PkgSwap.prototype.init = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {enable: true}
  }

  if (this._initialized) {
    return this.disable(cb)
  }

  this._copy('Main package.json', this._package, this._master, opts, cb)
}

// opts
//  * enable:boolean - should we enable this workspace
//  * force:boolean - should we force creation over an existing file
PkgSwap.prototype.create = function (name, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  if (!this._initialized) {
    const err = new Error('You must initialize this project first')
    err.level = 'fatal'
    return cb(err)
  }

  // need a way to find user-named files before we enable this
  // const dest = opts.dest || this.makeConfigName(name)
  const dest = this.makeConfigName(name)

  const tasks = [
    (done) => this._copy(name, this._master, dest, opts, done)
  ]

  if (typeof opts.blacklist === 'string' || Array.isArray(opts.blacklist)) {
    tasks.push((done) => this.blacklist(opts.blacklist, dest, done))
  }

  series(tasks, cb)
}

PkgSwap.prototype.enable = function (dest, cb) {
  series([
    (done) => exists(dest, done),
    (done) => this._removePackage(done),
    (done) => this._makeLink(dest, done)
  ], cb)
}

PkgSwap.prototype.disable = function (cb) {
  this.enable(this._master, cb)
}

PkgSwap.prototype.reconcileMaster = function (dest, cb) {
  parallel({
    source: (done) => readPackage(dest, done),
    master: (done) => readPackage(this._master, done)
  }, (err, {source, master}) => {
    if (err) return cb(err)

    const sourceBlacklist = source[pkgNS].blacklist
    const sourcePackages = buildDeps(source)

    // add blacklisted packages back to correct dependency sections
    // so they don't get inadvertantly removed
    sourceBlacklist.forEach((pkgObj) => {
      pkgObj.sources.forEach((depKey) => {
        sourcePackages[depKey].push(pkgObj.name)
      })
    })

    // find all packages that are in the source package
    // that aren't in the master package, and then check // the semver data for each one that is to see if it needs to update
    // but don't re-add a blacklisted package that was removed
    // from the master!
    depKeys.forEach((depKey) => {
      sourcePackages[depKey].forEach((pkg) => {
        const sourcePkg = source[depKey][pkg]
        const masterDeps = master[depKey]
        if (sourcePkg) {
          if (!masterDeps.hasOwnProperty(pkg)) {
            masterDeps[pkg] = sourcePkg
          } else if (masterDeps[pkg] !== sourcePkg) {
            masterDeps[pkg] = sourcePkg
          }
        }
      })
    })

    fs.writeFile(this._master, stringify(master), 'utf', cb)
  })
}

PkgSwap.prototype.blacklist = function (pkgs, dest, opts, cb) {
  if (dest === this._master) {
    const err = new Error('Cannot blacklist in the master file')
    return cb(err)
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  pkgs = (Array.isArray(pkgs) ? pkgs : [pkgs]).map((pkg) => ({name: pkg}))
  debug('going to remove', stringify(pkgs))

  waterfall([
    (done) => readPackage(dest, done),
    (pkgFile, done) => remove(pkgFile, done),
    (packageData, done) => fs.writeFile(dest, stringify(packageData), 'utf8', done)
  ], cb)

  function remove (pkgFile, done) {
    debug('read in source')
    if (!pkgFile.hasOwnProperty(pkgNS) || !pkgFile[pkgNS].hasOwnPropery('blacklist')) {
      debug('source does not have a', pkgNS, 'key')
      pkgFile[pkgNS] = skel()
    }

    if (opts.source === 'self') {
      pkgs = pkgFile[pkgNS].blacklist
    }

    const [blacklist, packageData] = filterPackages(pkgs, pkgFile)
    packageData[pkgNS].blacklist = blacklist
    debug('setting blacklist to', JSON.stringify(blacklist))
    done(null, packageData)
  }
}

PkgSwap.prototype.unblacklist = function (pkgs, dest, opts, cb) {
  if (dest === this._master) {
    const err = new Error('Cannot blacklist in the master file')
    return cb(err)
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  pkgs = Array.isArray(pkgs) ? pkgs : [pkgs]

  waterfall([
    (done) => readPackage(dest, done),
    (pkgData, done) => remove(pkgData, done),
    (pkgData, done) => fs.writeFile(dest, stringify(pkgData), 'utf8', done)
  ], cb)

  function remove (pkgData, done) {
    const blacklist = pkgData[pkgNS].blacklist.filter((pkg) => {
      return !pkgs.includes(pkg.name)
    })
    pkgData[pkgNS].blacklist = blacklist
    done(null, pkgData)
  }
}

PkgSwap.prototype.makeConfigName = function (name) {
  name = sanitize(name)
  return path.join(this._packageRoot, `.pkgswap.${name}.json`)
}

PkgSwap.prototype._copy = function (name, src, dest, opts, cb) {
  series([
    (done) => exists(dest, opts, done),
    (done) => copy(done)
  ], (err) => {
    if (err) {
      return cb(err)
    }
    debug(`Done copying ${src} to ${dest}`)
    if (opts.enable) {
      debug(`Enabling ${dest}`)
      return this.enable(dest, cb)
    }
    cb()
  })

  function exists (file, options, done) {
    fs.stat(file, (err, stat) => {
      if (err) {
        if (err.code === 'ENOENT') {
          debug(`${file} does not exist, allowing copy`)
          return done()
        }
        return done(err)
      }

      if (stat.isFile() && options.force) {
        debug(`${file} does exist, but force was set, allowing copy`)
        return done()
      }

      err = new Error(`${file} exists, specify force to override`)
      err.fatal = true
      done(err)
    })
  }

  function copy (done) {
    const srcStream = fs.createReadStream(src)
      .on('error', done)

    const destStream = fs.createWriteStream(dest)
      .on('error', done)
      .on('close', done)

    srcStream.pipe(destStream)
  }
}

PkgSwap.prototype._removePackage = function (cb) {
  fs.unlink(this._package, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        debug(`${this._package} does not exist, going to symlink`)
        return cb()
      }
      return cb(err)
    }
    debug(`removed ${this._package}, going to symlink`)
    cb()
  })
}

PkgSwap.prototype._makeLink = function (dest, cb) {
  fs.symlink(dest, this._package, (err) => {
    if (err) {
      return cb(err)
    }
    cb()
  })
}

PkgSwap.prototype._loadConfig = function () {
  let config = '{"workspaces": {}}'
  try {
    config = fs.readFileSync(this._rcFile, 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`Could not read configuration file: ${err.message}`)
    }
  }

  const res = parse(config)
  if (res.err) {
    throw new Error(`Could not parse configuration file: ${res.err.message}`)
  }

  this._config = res.value
}

PkgSwap.prototype._saveConfig = function () {
  try {
    fs.writeFileSync(this._rcFile, stringify(this._config), 'utf8')
  } catch (err) {
    throw new Error(`Unable to save config file: ${err.message}`)
  }
}

module.exports = PkgSwap
