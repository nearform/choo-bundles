var path = require('path')
var resolve = require('resolve')
var callsites = require('callsites')

var common = require('./common')

function bundles () {
  return common.factory({
    load: function (state, emitter, app) {
      return async function (filepath) {
        var basedir = path.dirname(callsites()[1].getFileName())
        var fullpath = resolve.sync(filepath, { basedir: basedir })
        var bundle = path.relative(process.env.PWD, fullpath)
        emitter.emit('bundles:load', bundle)
        return require(fullpath)
      }
    }
  })
}

module.exports = bundles
module.exports.assets = common.assets
