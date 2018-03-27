var through = require('through2')
var acorn = require('acorn-node')
var walk = require('acorn-node/walk')
var isRequire = require('estree-is-require')

var factory = require('./factory')

function plugin (b, opts) {
  // Run this globally because it needs to run last (and because it is cheap)
  b.transform(transform, { global: true })
  b.on('reset', addHooks)

  addHooks()

  function addHooks () {
    b.pipeline.get('pack').unshift(splitter(b, opts))
  }
}

/**
 * A transform that adds an actual `require()` call to `split-require` calls.
 * This way module-deps can pick up on it.
 */
function transform (file, opts) {
  var source = ''
  return through(onwrite, onend)
  function onwrite (chunk, enc, cb) {
    source += chunk
    cb(null, chunk)
  }
  function onend (cb) {
    if (!impl.mayContainCalls(source)) {
      cb()
      return
    }

    if (this.listenerCount('dep') === 0) {
      throw new Error(impl.name + 'requires browserify v16 or up')
    }

    var self = this
    var ast = acorn.parse(source)
    impl.detectCalls(ast, function (node) {
      var value = node.arguments[0].value
      self.emit('dep', value)
    })

    cb()
  }
}

var impl = {
  name: 'choo-bundles',
  mayContainRequires: function (string) {
    return string.indexOf('choo-bundles') !== -1
  },
  detectRequires: function (ast, cb) {
    walk.simple(ast, {
      CallExpression: function (node) {
        if (isRequire(node, 'choo-bundles')) {
          cb(node)
        }
      }
    })
  },
  mayContainCalls: function (string) {
    return string.indexOf('bundles.load') !== -1
  },
  detectCalls: function (ast, cb) {
    walk.simple(ast, {
      CallExpression: function (node) {
        var callee = node.callee
        if (callee.type === 'MemberExpression') {
          if (callee.property.name === 'load' && callee.object.property && callee.object.property.name === 'bundles') {
            cb(node)
          }
        }
      }
    })
  },
  makeDynamicEntryRow: function (entry, bundlepath, runtime) {
    return {
      id: 'bundle' + entry.id,
      source: 'require("choo-bundles")._loaded("' + bundlepath + '", require("bundle"));',
      entry: true,
      deps: {
        'choo-bundles': runtime.id,
        bundle: entry.id
      },
      indexDeps: {
        'choo-bundles': runtime.index,
        bundle: entry.index
      }
    }
  }
}

var splitter = factory(impl)

module.exports = plugin
