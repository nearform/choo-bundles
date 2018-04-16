var h = require('choo-async/html')
var assert = require('assert')

var isBrowser = typeof window !== 'undefined'

function factory (impl) {
  return function bundles (state, emitter, app) {
    assert.equal(state.async, true, 'choo-async decorator is required')
    assert.equal(state.ssr, true, 'choo-ssr plugin is required')

    state.bundles = state.bundles || {
      loaded: [],
      manifest: {}
    }

    emitter.on('bundles:load', name => {
      var bundle = state.bundles.manifest[name]
      if (!bundle) {
        throw new Error(`bundle ${name} not found in manifest`)
      }
      if (!state.bundles.loaded.some(bundle => bundle.name === name)) {
        state.bundles.loaded.push(Object.assign({}, bundle, { name }))
        state.bundles.loaded.sort((a, b) => a.id - b.id)
      }
    })

    app.bundles = {
      load: impl.load(state, emitter, app)
    }
  }
}

function assets () {
  return (state, emit) => {
    var bundles = state.bundles.loaded
    var js = bundles.map(bundle => script(bundle.id, bundle.js))
    var css = bundles.filter(bundle => bundle.css).map(bundle => stylesheet(bundle.id, bundle.css))
    return h`${[ ...js, ...css ]}`
  }
}

function script (id, url) {
  return h`<script data-id=${id} src=${url} defer></script>`
}

function stylesheet (id, url) {
  return h`<link data-id=${id} href=${url} rel="stylesheet" media="${isBrowser ? 'all' : 'none'}">`
}

module.exports.factory = factory
module.exports.assets = assets
module.exports.script = script
module.exports.stylesheet = stylesheet
