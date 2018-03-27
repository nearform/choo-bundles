const fs = require('fs')
const path = require('path')
const fastify = require('fastify')()
const browserify = require('browserify')

browserify('app.js')
  .plugin(require('choo-bundles/browserify'), {
    output: path.resolve(__dirname, 'build'),
    manifest: path.resolve(__dirname, 'build/manifest.json'),
    prefix: '/build'
  })
  .bundle()
  .pipe(fs.createWriteStream('./build/bundle.js'))

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'build'),
  prefix: '/build'
})

fastify.register(require('choo-ssr/fastify'), {
  app: require('./app'),
  plugins: [[
    require('choo-bundles/ssr'), {
      manifest: path.resolve(__dirname, 'build/manifest.json'),
      bundles: [{
        name: 'common',
        js: '/build/bundle.js'
      }]
    }
  ]]
})

fastify.listen(8080, function (err) {
  if (err) {
    console.log(err)
  }
  console.log('listening on 8080')
})
