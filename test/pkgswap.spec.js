const fs = require('fs')
const path = require('path')

const test = require('tap').test
const ncp = require('ncp')
const rimraf = require('rimraf')

const PkgSwap = require('../')

const fixtureSource = path.join(__dirname, 'fixture')
const fixturePath = path.join(__dirname, 'data')

function setup (cb) {
  teardown(() => {
    ncp(fixtureSource, fixturePath, (err) => {
      if (err) throw err
      cb()
    })
  })
}

function teardown (cb) {
  rimraf(fixturePath, (err) => {
    if (err) {
      if (err.code === 'ENOENT') return cb()
      throw err
    }
    cb()
  })
}

test('new pkgswap', (t) => {
  setup(() => {
    t.test('cwd', (t) => {
      const pkg = new PkgSwap()
      t.equal(pkg._packageRoot, path.resolve(__dirname, '..'), 'parent path')
      t.ok(!pkg._initialized, 'should not be initialized')
      t.end()
    })

    t.test('provide wd, intialized', (t) => {
      const wd = path.join(fixturePath, 'has-init')
      const pkg = new PkgSwap(wd)
      t.equal(pkg._packageRoot, path.resolve(fixturePath, 'has-init'), 'parent path')
      t.ok(pkg._initialized, 'should be initialized')
      t.end()
    })

    t.test('provide wd, not initialized', (t) => {
      const wd = path.join(fixturePath, 'no-init')
      const pkg = new PkgSwap(wd)
      t.equal(pkg._packageRoot, path.resolve(fixturePath, 'no-init'), 'parent path')
      t.ok(!pkg._initialized, 'should not be initialized')
      t.end()
    })

    t.test('throws with no package.json', (t) => {
      const wd = '/'
      t.throws(() => {
        const pkg = new PkgSwap(wd) // eslint-disable-line
      }, 'no package.json found')
      t.end()
    })

    t.end()
  })
})

test('pkgswap init', (t) => {
  setup(() => {
    t.test('already initialized, but nothing enabled', (t) => {
      const wd = path.join(fixturePath, 'has-init')
      const pkg = new PkgSwap(wd)
      pkg.init((err) => {
        t.error(err, 'no errors already initialized')
        t.end()
      })
    })

    t.test('already initialized, foo enabled', (t) => {
      const wd = path.join(fixturePath, 'has-init-enabled')
      const pkg = new PkgSwap(wd)
      const packageFile = path.join(wd, 'package.json')
      const mainFile = path.join(wd, '.pkgswap.package.json')
      t.ok(fs.readlinkSync(packageFile).endsWith('.pkgswap.foo.json'), 'foo enabled')
      pkg.init((err) => {
        t.error(err, 'no errors already initialized')
        t.equal(fs.readlinkSync(packageFile), mainFile, 'disabled foo')
        t.end()
      })
    })

    t.test('symlink points to not pkgswap', (t) => {
      const wd = path.join(fixturePath, 'no-init-symlink')
      const pkg = new PkgSwap(wd)
      pkg.init((err) => {
        t.ok(err, 'got error')
        t.equal(err.message, 'ENOENT: no such file or directory, stat \'/Users/todd/src/pkgswap/test/data/no-init-symlink/.pkgswap.package.json\'')
        t.end()
      })
    })

    t.end()
  })
})

test('pkgswap create', (t) => {
  setup(() => {
    t.test('no init', (t) => {
      const wd = path.join(fixturePath, 'no-init')
      const pkg = new PkgSwap(wd)
      pkg.create('test', (err) => {
        t.ok(err)
        t.equal(err.message, 'You must initialize this project first')
        t.end()
      })
    })

    t.test('

    t.end()
  })
})

test('teardown', (t) => {
  teardown(() => t.end())
})
