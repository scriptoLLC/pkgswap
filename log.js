const chalk = require('chalk')

const errorColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green'
}

function log (level, msg) {
  const levelColor = errorColors[level] || 'reset'
  const lvl = chalk[levelColor](level)
  console.log(`${(lvl)}: msg`)
}

module.exports = log
