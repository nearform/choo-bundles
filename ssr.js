const fs = require('fs')
const path = require('path')
// const mime = require('mime')
const inline = require('inline-critical-css')

function plugin (options) {
  options.http2 = options.http2 || false
  options.public = options.public || '.'
  options.bundles = options.bundles || []
  options.manifest = options.manifest || {}

  var manifest = typeof options.manifest === 'string' ? require(options.manifest) : options.manifest

  // The files are pushed to stream here
  // async function push (stream, basename) {
  //   const { HTTP2_HEADER_PATH } = require('http2').constants
  //   const filepath = path.join(options.public, basename)
  //   const file = getFile(filepath)
  //   if (!file) {
  //     throw new Error(`file ${filepath} not found`)
  //   }

  //   const headers = { [HTTP2_HEADER_PATH]: basename }

  //   await new Promise((resolve, reject) => {
  //     stream.pushStream(headers, (err, push) => {
  //       if (err) {
  //         reject(err)
  //         return
  //       }
  //       push.respondWithFD(file.content, file.headers)
  //       resolve()
  //     })
  //   })
  // }

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

  // async function pushHTTP2 (bundles, reply) {
  //   if (options.http2 && reply.res.stream) {
  //     const js = bundles.map(bundle => push(reply.res.stream, bundle.js))
  //     const css = bundles.filter(bundle => bundle.css).map(bundle => push(reply.res.stream, bundle.css))
  //     await Promise.all([ ...js, ...css ])
  //   }
  // }

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
    async post (state, reply) {
      const bundles = state.bundles.loaded
      const [ stream ] = await Promise.all([
        inlineCSS(bundles)
        // pushHTTP2(bundles, reply)
      ])
      return stream
    }
  }
}

// function getFile (filepath) {
//   try {
//     const content = fs.openSync(filepath, 'r')
//     const contentType = mime.getType(filepath)
//     return {
//       content,
//       headers: {
//         'content-type': contentType
//       }
//     }
//   } catch (e) {
//     console.log(e)
//     return null
//   }
// }

module.exports = plugin
