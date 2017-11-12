const minimist = require('minimist')
const PkgSwap = require('./')
const chalk = require('chalk')

const args = minimist(process.argv.slice(2))
var ps = new PkgSwap(args)
ps.init()
console.log(chalk.red('yo'))
