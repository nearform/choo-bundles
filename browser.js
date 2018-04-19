var defer = require('p-defer')
var common = require('./common')

function bundles () {
  return common.factory({
    load: function (state, emitter, app) {
      return function (name) {
        var bundle = state.bundles.manifest[name]
        if (!bundle) {
          throw new Error('bundle ' + name + ' not found in manifest')
        }
        emitter.emit('bundles:load', name)
        return load(bundle)
      }
    }
  })
}

var _bundles = {}

function load (bundle) {
  var url = bundle.js

  if (_bundles[url]) {
    return _bundles[url].promise
  }

  _bundles[url] = defer()

  if (bundle.css) {
    var css = common.stylesheet(bundle.id, bundle.css)
    var links = document.head.getElementsByTagName('link')
    var csssibelings = Array.prototype.filter.call(links, function (link) { return link.dataset.id > bundle.id })
    if (csssibelings.length > 0) {
      document.head.insertBefore(css, csssibelings[0])
    } else {
      document.head.insertBefore(css, links[links.length - 1].nextSibling)
    }
  }

  var js = common.script(bundle.id, bundle.js)
  var scripts = document.head.getElementsByTagName('script')
  var jssibelings = Array.prototype.filter.call(scripts, function (script) { return script.dataset.id > bundle.id })
  if (jssibelings.length > 0) {
    document.head.insertBefore(js, jssibelings[0])
  } else {
    document.head.insertBefore(js, scripts[scripts.length - 1].nextSibling)
  }

  return _bundles[url].promise
}

function _loaded (url, result) {
  if (!_bundles[url]) {
    // might not have been requested yet, let's keep it in cache
    _bundles[url] = defer()
  }
  _bundles[url].resolve(result)
}

module.exports = bundles
module.exports.assets = common.assets
module.exports.preloads = common.preloads
module.exports._loaded = _loaded
