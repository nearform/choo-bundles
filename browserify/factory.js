var fs = require('fs')
var path = require('path')
var through = require('through2')
var eos = require('end-of-stream')
var splicer = require('labeled-stream-splicer')
var pack = require('browser-pack')
var runParallel = require('run-parallel')
var deleteValue = require('object-delete-value')
var convert = require('convert-source-map')
var values = require('object-values')
var transformAst = require('transform-ast')
var resolve = require('resolve')
var acorn = require('acorn-node')

module.exports = factory

function factory (impl) {
  return splitter

  function splitter (b, opts) {
    opts.output = opts.output || '.'
    opts.prefix = opts.prefix || '/'
    opts.filename = opts.filename || 'bundle.%f.js'
    opts.manifest = opts.manifest || './bundles.manifest.json'

    var _manifest = {}
    var _runtime = {}
    var _calls = []
    var _rows = {}

    var ops = {
      // Get output stream
      output: function output (filename) {
        if (typeof opts.output === 'string') return fs.createWriteStream(path.join(opts.output, filename))
        else if (typeof opts.output === 'function') return opts.output(filename)
        else throw new Error('output option must be set with a string or function')
      },
      // Write manifest
      manifest: function manifest () {
        if (typeof opts.manifest === 'string') return fs.writeFileSync(opts.manifest, JSON.stringify(_manifest, null, '  '))
        else if (typeof opts.manifest === 'function') return opts.manifest(_manifest)
        else throw new Error('manifest option must be set with a string or function')
      },
      // Get filename for bundle
      filename: function filename (row) {
        if (typeof opts.filename === 'string' && opts.filename.indexOf('%f') !== -1 && row.id) return opts.filename.replace('%f', row.id)
        else if (typeof opts.filename === 'function') return opts.filename(row)
        else return 'bundle.' + Date.now() + '.js'
      }
    }

    return through.obj(onwrite, onend)

    function onwrite (row, enc, cb) {
      if (impl.mayContainRequires(row.source) || impl.mayContainCalls(row.source)) {
        var ast = acorn.parse(row.source)
        row.transformable = transformAst(row.source, { ast: ast })
        impl.detectRequires(ast, function (node) {
          // Mark the thing we imported as the runtime row.
          var importPath = getStringValue(node.arguments[0])
          _runtime.id = row.deps[importPath]
          if (_rows[_runtime.id]) {
            _runtime.row = _rows[_runtime.id]
          }
        })
        impl.detectCalls(ast, function (node) {
          // We need to get the `.arguments[0]` twice because at this point the call looks like
          // `splitRequire(require('xyz'))`
          var filepath = node.arguments[0].value
          var dep = row.deps[filepath]
          // If `requirePath` was already a resolved dependency index (eg. thanks to bundle-collapser)
          // we should just use that
          if (dep == null) {
            dep = filepath
          }

          var basedir = path.dirname(row.file)
          var fullpath = resolve.sync(filepath, { basedir: basedir })
          var bundlepath = path.relative(process.env.PWD, fullpath)

          // update arg to be `bundlepath`
          node.arguments[0].edit.update('\'' + bundlepath + '\'')

          _calls.push({
            row: row.id,
            dep: dep,
            path: bundlepath
          })
        })
      }

      if (_runtime.id && String(row.id) === String(_runtime.id)) {
        _runtime.row = row
      }

      _rows[row.id] = row
      cb(null)
    }

    function onend (cb) {
      var self = this

      // If no calls then there's nothing to do here
      if (_calls.length === 0) {
        values(_rows).forEach(function (row) { self.push(row) })
        cb(null)
        return
      }

      // If no runtime row found but id is set we can assume external
      if (!_runtime.row && _runtime.id) {
        _runtime.row = {
          id: _runtime.id,
          index: _runtime.id
        }
      }
      if (!_runtime.row) {
        cb(new Error(impl.name + ': the split-require runtime helper was not bundled. Most likely this means that you are using two versions of split-require simultaneously.'))
        return
      }

      // Ensure the main bundle exports the helper etc.
      b._bpack.hasExports = true

      // Remove imported modules from call row dependencies.
      _calls.forEach(function (call) {
        var row = _rows[call.row]
        var dep = _rows[call.dep]
        deleteValue(row.deps, dep.id)
        if (row.indexDeps) deleteValue(row.indexDeps, dep.index)
      })

      // Collect main (entry) rows and their dependencies
      var mainRows = values(_rows)
        .filter(function (row) { return row.entry })
        .reduce(function (acc, row) { return gatherDependencyIds(row, acc.concat(row.id)) }, [])

      // Collect dynamic (from call) bundles and their dependencies
      var bundles = _calls.map(function (call) {
        var row = _rows[call.row]
        var bundle = _rows[call.dep] // dynamic bundle to be

        // check if this dynamic bundle is also non-dynamically required by the main bundles
        if (mainRows.indexOf(bundle.id) !== -1) {
          //
          // @TODO: local import
          //
          // add the dependency back
          row.deps[bundle.id] = bundle.id
          if (row.indexDeps) row.indexDeps[bundle.id] = bundle.index
          return
        }

        // Collect dependencies of the dynamic bundle
        var deps = gatherDependencyIds(bundle)
          .filter(function (dep) {
            if (mainRows.indexOf(dep) !== -1) {
              // Except dependencies already present in the main bundle,
              // expose those deps so dynamic bundle can use them
              _rows[dep].expose = true
              return false
            }
            return true
          })

        return {
          id: bundle.id,
          path: call.path,
          deps: deps
        }
      })

      // No more source transforms after this point, save transformed source code
      values(_rows).forEach(function (row) {
        if (row.transformable) {
          row.source = row.transformable.toString()
          if (b._options.debug) {
            row.source += '\n' + convert.fromObject(row.transformable.map).toComment()
          }
          // leave no trace!
          delete row.transformable
        }
      })

      var pipelines = bundles.map(function (bundle) {
        return createPipeline.bind(null, bundle)
      })

      runParallel(pipelines, function (err, bundles) {
        if (err) return cb(err)

        // Expose the `choo-bundles` function so dynamic bundles can access it.
        _runtime.row.expose = true

        new Set(mainRows).forEach(function (id) {
          var row = _rows[id]
          // Move each other entry row by one, so our mappings are registered first.
          if (row.entry && typeof row.order === 'number') row.order++
          self.push(row)
        })

        // write manifest
        ops.manifest()

        cb(null)
      })
    }

    function createPipeline (bundle, cb) {
      var row = _rows[bundle.id]

      var pipeline = splicer.obj([
        'pack', [ pack({ raw: true }) ],
        'wrap', [ ]
      ])

      var filename = ops.filename(row)

      bundle.url = path.join(opts.prefix, filename)

      b.emit('choo-bundles.pipeline', pipeline, row, filename, {
        add: addToManifest.bind(null, bundle.path, bundle.id)
      })

      var writer = pipeline.pipe(ops.output(filename))
      // allow the output stream to assign a name asynchronously,
      // eg. one based on the hash of the bundle contents
      // the output stream is responsible for saving the file in the correct location
      writer.on('name', function (name) {
        filename = name
      })

      pipeline.on('error', cb)
      writer.on('error', cb)
      eos(writer, done)

      function done () {
        addToManifest(bundle.path, bundle.id, 'js', bundle.url)
        cb(null, bundle)
      }

      pipeline.write(impl.makeDynamicEntryRow(row, bundle.url, _runtime.row))
      pipeline.write(row)
      bundle.deps.forEach(function (dep) {
        pipeline.write(_rows[dep])
      })
      pipeline.end()
    }

    function addToManifest (filepath, id, type, url) {
      _manifest[filepath] = _manifest[filepath] || {}
      _manifest[filepath].id = id
      _manifest[filepath][type] = _manifest[filepath][type] = []
      _manifest[filepath][type] = url
    }

    function gatherDependencyIds (row, arr) {
      var deps = values(row.deps)
      arr = arr || []

      deps.forEach(function (id) {
        var dep = _rows[id]
        if (!dep || arr.indexOf(dep.id) !== -1) {
          return
        }
        // not sure why this is needed yet,
        // sometimes `id` is the helper path and that doesnt exist at this point
        // in the rowsById map
        if (dep) {
          arr.push(dep.id)
          gatherDependencyIds(dep, arr)
        }
      })

      return arr
    }
  }
}

function getStringValue (node) {
  if (node.type === 'Literal') return node.value
  if (node.type === 'TemplateLiteral' && node.quasis.length === 1) {
    return node.quasis[0].value.cooked
  }
}
