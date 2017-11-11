# PKGSWAP

A tool to manage multiple package.json files to allow for different sets of modules
for ease of development.

## TL;DR
npm 5 radicially changes how npm operations on your node_modules directory on disk,
attempting, after each operation, to generate an "ideal tree". This tool makes
it easier to explain what your "ideal tree" is for a particular instance.

## Usage

```js
> var PkgSwap = require('pkgswap')
> var ps = new PkgSwap()
> ps.init()
> ps.create('my workspace', (err) => console.log(err || 'done'))
> ps.enable('my workspace', (err) => console.log(err || 'done'))
> ps.disable((err) => console.log(err || 'done'))
```

(CLI coming soon)

## NTL;WR

With npm5 everytime you run an operation which updates the `node_modules` directory
on disk, it will attempt to make the `node_modules` directory on disk match
what you have in your package.json (or package-lock.json file). This means
if you have removed or added a dependency with an earlier operation but _not saved
the change to your package(-lock).json file_, those packages will be re-installed/deleted
so that your on-disk directory matches the canonicial or "idealized" version of the
dependency graph in the metadata.

Normally, this is what you want -- there are a lot of issues around broken
node_modules directories that his behavior is intended to rectify, however,
sometimes, you _really_ want a broken node_modules directory, especially if you
are working on a project involving a lot of interdependant modules.

Thanks to the way that [require](https://github.com/maxogden/art-of-node#how-require-works)
works in node, the following is workflow is possible.

If you were contributing to [choojs](https://choo.io), and wanted to work on some
changes to [nanomorph](https://github.com/choojs/nanomorph) but needed to test
those changes in the context of [choo](https://github.com/choojs/choo).

You could deal with using `npm link` (which has a few known-issues), or you could
setup your development enviroment like this:

```
~/src/choojs/node_modules/choo
~/src/choojs/node_modules/nanomorph
```

Now, if you wanted to change nanomorph, running `npm rm nanomorph` from `~/src/choojs/node_modules/choo` would
remove nanomorph locally, forcing node (and [browserify](http://browserify.org)) to
load the copy from `~/src/choojs/node_modules/nanomorph`.

With npm 5, however, this becomes nearly impossible, since any subsequent changes
to the package.json in the `choo` directory, will cause nanomorph to be re-installed.

The purpose of this tool is to allow the creation of specifically configured
package.json files so that npm 5 will not re-install modules you don't want it to.

For more about developing inside of a `node_modules` directory, please see: the [_Development workflow_](https://github.com/datproject/dat/blob/master/CONTRIBUTING.md#development-workflow) section for [DAT](https://datproject.org) developers.

For more details on how/why npm 5 does this: [npm uninstall causes npm install to occur](https://github.com/npm/npm/issues/18290)

## API

### new PkgSwap(wd?:string):PkgSwap
Instantiate a new instance of PkgSwap. Will attempt to find the closest `package.json`
file from the working directory provided. (Will traverse directories up towards the root
of the filesystem)

* `wd?:string` - (optional) provide a working directory. Default: `process.cwd()`

#### PkgSwap#init(opts?:object, cb:function):undefined
Initialize this module to use package swap.

* `opts?:object` - (optional) options for the initialization
    * `force:boolean` - don't abort if package.json is already a symlink. Default: false
* `cb:function` - will be called when intialization is complete

#### PkgSwap#create(name:string, opts?:object, cb:function):undefined
Create a new module workspace. If modules are provided to the blacklist, the `#blacklist`
method will be called after the workspace is created; please see the documentation
for that method for information on how this works and what to expect.

* `name:string` - the name of the workspace
* `opts?:object` - options
    * `blacklist?:array(string)`: a list of modules to remove from this namespace. Default: []
    * `force?:boolean`: overwrite existing file if any. Default: false
    * `enable?:boolean`: enable new workspace. Default: false
* `cb:function` - will be called when workspace has been created (will wait for activation if `enable: true`)

#### PkgSwap#makConfigName(name:string):string
Resolve a workspace name to a workspace filename.

Since the workspaces are stored as files on disk, they need to be properly santizied
so we don't write invalid filenames to the device

* `name:string` - the name to resolve

#### PkgSwap#enable(dest:string, cb:function):undefined
Enable an existing workspace.

* `dest:string` - the filename of the workspace to enable
* `cp:function` - will be called when the workspace is enabled

#### PkgSwap#disable(cb:function):undefined
Restore the module to use the `master` package.json file

Will cause the symlink to point back to the original `package.json` file provided
when the last workspace was enabled.

* `cb:function` - will be called when the workspace is disabled

#### PkgSwap#blacklist(pkgs:string || array(string), dest:string, cb:function):undefined
Remove modules from a workspace's dependencies lists and add them to a blacklist
for that workspace.

The dependencies list will be filtered each time that this workspace is enabled
ensuring that the modules listed in the blacklist do not appear on any of the
dependencies lists for the module.

This will not prevent npm from installing ANY of the blacklisted packages, it
will just ensure that they are not present at the time that thie worksapce is
enabled.

It will also not remove these packages from disk. Running `npm install` (or using
the CLI tool) will do this for you.

* `pkgs:string || array(string)` - a package or list of packages to blacklist
* `dest:string` - the filename of the workspace to update the blacklist for
* `cb:function` - will be called when the packages have been blacklisted

#### PkgSwap#reconcileMaster (dest:string, cb:function):undefined
Update the master package.json with the changes from a workspace, ignoring the
blacklisted modules.

This will update the master package.json file with any changes that have occured
to the workspace's package.json file, adding packages that have been added in the
workspace, removing packages that have been removed, and changing the semver
target for those which have had their semver targets changed.  (e.g. if you upgraded
a dep in the workspace, the master will receive the update as well). The modules in
the workspaces's blacklist will be kept in the master package.json file.

* `dest:string` - the source file for the blacklist
* `cb:function` - will be called when the master package.json has been reconciled

## Licence
Copyright © 2017 Scripto, LLC. All rights reserved.
