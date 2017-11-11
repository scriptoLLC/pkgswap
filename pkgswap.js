const fs = require('fs')
const path = require('path')

const series = require('run-series')
const waterfall = require('run-waterfall')
const parallel = require('run-parallel')

const findRoot = require('find-root')
const sanitize = require('sanitize-filename')
const debug = require('debug')('pkgswap')
const parse = require('fast-json-parse')
const stringify = require('fast-safe-stringify')

const pkgNS = 'pkgswap'

const depKeys = ['bundledDependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies', 'dependencies']

function skel () {
  return {blacklist: []}
}

function PkgSwap (wd) {
  if (!(this instanceof PkgSwap)) return new PkgSwap(wd)

  this._packageRoot = findRoot(wd || process.cwd())
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
    this._initialized = false
  }
}

// opts:
//  * force:boolean - don't care if there is a symlink already present
PkgSwap.prototype.init = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  if (this._initialized && !opts.force) {
    const linked = fs.readlinkSync(this._package)
    const err = new Error(`package.json is already a symlink pointing to ${linked}, you may already have initialized this project`)
    err.level = 'fatal'
    return cb(err)
  }

  this._copy('Main package.json', this._package, this._master, {force: true, enable: true}, cb)
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

  const dest = opts.dest || this.makeConfigName(name)
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
    (done) => this._removePackage(done),
    (done) => this._makeLink(dest, done)
  ], cb)
}

PkgSwap.prototype.disable = function (cb) {
  this.enable(this._master, cb)
}

PkgSwap.prototype.reconcileMaster = function (dest, cb) {
  parallel({
    source: (done) => this._readPackage(dest, done),
    master: (done) => this._readPackage(this._master, done)
  }, (err, res) => {
    if (err) return cb(err)

    const filteredSource = this._filterPackages(res.source[pkgNS].blacklist, res.source)
    const masterPackages = this._buildDeps(res.master)
    const sourcePackages = this._buildDeps(filteredSource)

    // find deps in filtered source that don't exist or aren't at the same version
    // as in master and copy them into master
    depKeys.forEach((depKey) => {
      sourcePackages[depKey].forEach((dep) => {
        if (!masterPackages[depKey].includes(dep)) {
          res.master[depKey][dep] = filteredSource[depKey][dep]
        } else if (res.master[depKey][dep] !== filteredSource[depKey][dep]) {
          res.master[depKey][dep] = filteredSource[depKey][dep]
        }
      })
    })

    fs.writeFile(this._master, stringify(res.master), 'utf', cb)
  })
}

PkgSwap.prototype.blacklist = function (pkgs, dest, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  pkgs = Array.isArray(pkgs) ? pkgs : [pkgs]

  waterfall([
    (done) => this._readPackage(dest, cb),
    (pkgFile, done) => remove(pkgFile, done),
    (pkgFile, done) => fs.writeFile(dest, stringify(pkgFile), 'utf8', done)
  ], cb)

  function remove (pkgFile, done) {
    if (!pkgFile.hasOwnProperty(pkgNS)) {
      pkgFile[pkgNS] = skel()
    }

    if (!Array.isArray(pkgFile.blacklist)) {
      pkgFile[pkgNS].blacklist = []
    }

    if (opts.source === 'self') {
      pkgs = pkgFile[pkgNS].blacklist
    }

    pkgFile = this._filterPackages(pkgs, pkgFile)
    pkgFile[pkgNS].blacklist = Array.from(new Set(pkgFile[pkgNS].blacklist.concat(pkgs)))
    done()
  }
}

PkgSwap.prototype._filterPackages = function (blacklist, packageData) {
  const deps = this._buildDeps(packageData)

  blacklist.forEach((pkg) => {
    depKeys.forEach((dep) => {
      if (deps[dep].includes(pkg)) {
        delete packageData[dep][pkg]
      }
    })
  })

  return packageData
}

PkgSwap.prototype._buildDeps = function (packageData) {
  const deps = {}
  depKeys.forEach((key) => {
    deps[key] = Object.keys(packageData[key] || {})
  })
  return deps
}

PkgSwap.prototype._readPackage = function (dest, cb) {
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

PkgSwap.prototype._opDone = function (err, cb) {
  if (err) {
    this._log('error', err)
  }
  cb && cb(err)
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

PkgSwap.prototype.makeConfigName = function (name) {
  name = sanitize(name)
  return path.join(this._packageRoot, `.pkgswap.${name}.json`)
}

module.exports = PkgSwap
