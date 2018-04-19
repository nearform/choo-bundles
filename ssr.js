const fs = require('fs')
const path = require('path')
const mime = require('mime')
const inline = require('inline-critical-css')

function plugin (options) {
  options.http2 = options.http2 || false
  options.public = options.public || '.'
  options.bundles = options.bundles || []
  options.manifest = options.manifest || {}

  var manifest = typeof options.manifest === 'string' ? require(options.manifest) : options.manifest

  // The files are pushed to stream here
  function push (stream, basename) {
    const { HTTP2_HEADER_PATH } = require('http2').constants
    const filepath = path.join(options.public, basename)
    const file = getFile(filepath)
    if (!file) {
      throw new Error(`file ${filepath} not found`)
    }

    const headers = { [HTTP2_HEADER_PATH]: basename }

    stream.pushStream(headers, (err, push) => {
      if (err) return
      console.log('PUSED')
      push.respondWithFD(file.content, file.headers)
    })
  }

  function getPublicFile (basename) {
    return new Promise((resolve, reject) => {
      const filepath = path.join(options.public, basename)
      fs.readFile(filepath, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }

  async function inlineCSS (bundles) {
    const files = await Promise.all(bundles.map(bundle => getPublicFile(bundle.css)))
    const css = Buffer.concat(files)
    return inline(css)
  }

  function pushHTTP2 (bundles, stream) {
    if (options.http2push && stream) {
      bundles.forEach(bundle => push(stream, bundle.js))
      bundles.filter(bundle => bundle.css).forEach(bundle => push(stream, bundle.css))
    }
  }

  return {
    async pre (state) {
      var loaded = options.bundles.map(bundle => {
        bundle.id = bundle.id || 0
        return bundle
      })
      state = Object.assign(state, {
        bundles: {
          loaded: loaded,
          manifest: manifest
        }
      })
    },
    async post (state, request, reply) {
      const bundles = state.bundles.loaded
      pushHTTP2(bundles, request.raw.stream)
      const stream = await inlineCSS(bundles)
      return stream
    }
  }
}

function getFile (filepath) {
  try {
    const content = fs.openSync(filepath, 'r')
    const contentType = mime.getType(filepath)
    return {
      content,
      headers: {
        'content-type': contentType
      }
    }
  } catch (e) {
    console.log(e)
    return null
  }
}

module.exports = plugin
