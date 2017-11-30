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
      const pj = path.join(pkg._packageRoot, 'package.json')
      const pjl = path.join(pkg._packageRoot, '.pkgswap.package.json')
      fs.unlinkSync(pj)
      fs.writeFileSync(pj, fs.readFileSync(pjl))
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
  t.test('not initialized, auto-enable', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'no-init')
      const pkg = new PkgSwap(wd)
      pkg.init((err) => {
        t.error(err, 'no error')
        t.ok(fs.readlinkSync(pkg._package).endsWith('.pkgswap.package.json'), 'linked and enabled')
        t.end()
      })
    })
  })

  t.test('not initialized, do not enable', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'no-init')
      const pkg = new PkgSwap(wd)
      pkg.init({enable: false}, (err) => {
        t.error(err, 'no error')
        t.ok(fs.existsSync(pkg._package), 'not linked and enabled')
        t.end()
      })
    })
  })

  t.test('already initialized, but nothing enabled', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'has-init')
      const pkg = new PkgSwap(wd)
      pkg.init((err) => {
        t.error(err, 'no errors already initialized')
        t.end()
      })
    })
  })

  t.test('already initialized, foo enabled', (t) => {
    setup(() => {
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
  })

  t.test('symlink points to not pkgswap', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'no-init-symlink')
      const pkg = new PkgSwap(wd)
      pkg.init((err) => {
        t.ok(err, 'got error')
        t.ok(/ENOENT.*no-init-symlink/.test(err.message), 'has error')
        t.end()
      })
    })
  })

  t.end()
})

test('pkgswap create', (t) => {
  t.test('no init', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'no-init')
      const pkg = new PkgSwap(wd)
      pkg.create('test', (err) => {
        t.ok(err)
        t.equal(err.message, 'You must initialize this project first')
        t.end()
      })
    })
  })

  t.test('has init, no blacklist, not enabled', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'has-init')
      const pkg = new PkgSwap(wd)
      pkg.create('test', (err) => {
        t.error(err, 'no error')
        const testPkg = path.join(wd, '.pkgswap.test.json')
        t.ok(fs.existsSync(testPkg), 'test package created')
        t.ok(fs.existsSync(pkg._master), 'master file still exists')
        t.equal(fs.readlinkSync(pkg._package), '.pkgswap.package.json')
        t.end()
      })
    })
  })

  t.test('has init, no blacklist, enabled', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'has-init')
      const pkg = new PkgSwap(wd)
      pkg.create('test', {enable: true}, (err) => {
        t.error(err, 'no error')
        const testPkg = path.join(wd, '.pkgswap.test.json')
        t.ok(fs.existsSync(testPkg), 'test package created')
        t.ok(fs.existsSync(pkg._master), 'master file still exists')
        t.equal(fs.readlinkSync(pkg._package), path.join(wd, '.pkgswap.test.json'))
        t.end()
      })
    })
  })

  t.test('has init, blacklist', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'has-init')
      const pkg = PkgSwap(wd)
      pkg.create('test', {blacklist: 'foo'}, (err) => {
        t.error(err, 'no error')
        const testPkg = path.join(wd, '.pkgswap.test.json')
        t.ok(fs.existsSync(testPkg), 'test package created')
        const testPkgData = require(testPkg)
        t.ok(testPkgData.hasOwnProperty('pkgswap'))
        t.ok(testPkgData.pkgswap.hasOwnProperty('blacklist'))
        t.deepEqual(testPkgData.pkgswap.blacklist, [{name: 'foo'}])
        t.end()
      })
    })
  })

  t.end()
})

test('pkgswap disable', (t) => {
  t.test('not enabled', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'no-init')
      const pkg = PkgSwap(wd)
      pkg.disable((err) => {
        t.error(err, 'no error disabling')
        const stat = fs.lstatSync(path.join(wd, 'package.json'))
        t.ok(!stat.isSymbolicLink())
        t.ok(stat.isFile())
        t.end()
      })
    })
  })

  t.test('enabled, but set to master', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'has-init')
      const pkg = PkgSwap(wd)
      pkg.disable((err) => {
        t.error(err, 'no error disabling')
        const stat = fs.lstatSync(path.join(wd, 'package.json'))
        t.ok(stat.isSymbolicLink())
        const link = fs.readlinkSync(path.join(wd, 'package.json'))
        const pointer = link.split(path.sep).slice(-1)[0]
        t.equal(pointer, '.pkgswap.package.json', 'package pointed')
        t.end()
      })
    })
  })

  t.test('works just fine', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'has-init-enabled')
      const pkg = PkgSwap(wd)
      pkg.disable((err) => {
        t.error(err, 'no error disabling')
        const stat = fs.lstatSync(path.join(wd, 'package.json'))
        t.ok(stat.isSymbolicLink())
        const link = fs.readlinkSync(path.join(wd, 'package.json'))
        const pointer = link.split(path.sep).slice(-1)[0]
        t.equal(pointer, '.pkgswap.package.json', 'package pointed')
        t.end()
      })
    })
  })

  t.end()
})

test('pkgswap reconcile', (t) => {
  t.test('reconcile against master', (t) => {
    setup(() => {
      const wd = path.join(fixturePath, 'reconcile-no-blacklist-no-new-packages')
      const pkg = new PkgSwap(wd)
      t.ok(pkg._initialized)
      t.end()
    })
  })

  t.end()
})

test('teardown', (t) => {
  teardown(() => t.end())
})
