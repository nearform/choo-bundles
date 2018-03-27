# choo-bundles

Bundle splitting with HTTP2 push support for [`choo-ssr`](https://github.com/nearform/choo-ssr) (server-side rendering with Choo).

Lazy load the parts of your app that are not immediately used, to make the
initial load faster.

This module works without a compile step on the server, and in the browser with
the browserify plugin.

[Usage](#usage) -
[Install](#install) -
[Plugin CLI](#browserify-plugin-cli-usage) -
[Plugin API](#browserify-plugin-api-usage) -
[License: MIT](#license)

[![stability][stability-image]][stability-url]
[![standard][standard-image]][standard-url]

[stability-image]: https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square
[stability-url]: https://nodejs.org/api/documentation.html#documentation_stability_index
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard

## Usage

This plugin exposes a `load` function on a `bundles` object in the Choo instance:

```js
// app.js
const choo = require('choo')
const ssr = require('choo-ssr')
const bundles = require('choo-bundles')

const home = require('./views/home')
const notfound = require('./views/notfound')

function main () {
  const app = choo()

  const page = view => (
    ssr.html(
      ssr.head(
        ssr.state(),
        bundles.assets()
      ),
      ssr.body(view)
    )
  )

  app.use(ssr())
  app.use(bundles())

  app.route('/', page(home))
  app.route('/lazy', page(lazy))
  app.route('*', page(notfound))
  
  app.mount('html')

  async function lazy (state, emit) {
    const view = await app.bundles.load('./views/lazy')
    return view(state, emit)
  }

  return app
}

if (typeof window !== 'undefined') {
  main()
}

module.exports = main
```

```js
// server.js
const path = require('path')
const fastify = require('fastify')()

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

fastify.listen(8080, function () {
  console.log('listening on 8080')
})
```

```js
// build.js
const fs = require('fs')
const path = require('path')
const browserify = require('browserify')

browserify('app.js')
  .plugin(require('choo-bundles/browserify'), {
    output: path.resolve(__dirname, 'build'),
    manifest: path.resolve(__dirname, 'build/manifest.json'),
    prefix: '/build'
  })
  .bundle()
  .pipe(fs.createWriteStream('./build/bundle.js'))
```

This will split the `load`ed files into their own bundles so they can be
dynamically loaded at runtime. 
In this case, a common bundle would be created including `choo`, `choo/html`, `choo-bundles` and the file above. A second bundle will be created for the `lazyView.js` file and its dependencies.

See [examples](https://github.com/nearform/choo-bundles/tree/master/examples) for more

## Install

```
npm install choo-bundles
```

## Browserify Plugin

Works with Browserify v16 and newer

### CLI Usage
```bash
browserify ./app.js -p [ choo-bundles/browserify --output ./bundles/ --manifest ./bundles/manifest.json ]
  > ./bundles/common.js
```

#### Options

##### `--output`

Set the output directory for dynamic bundles. Use a folder path to place dynamic bundles in that folder.

The default is `.`, outputting in the current working directory.

##### `--manifest`

Set the output path for manifest file. 

The default is `./bundles.manifest.json`, outputting in the current working directory.

##### `--filename`

Filename for the dynamic bundles. You must use %f in place of the bundle id
```
-p [ choo-bundles/browserify --filename bundle.%f.js ]
```
Defaults to `bundle.%f.js`, so the filename of dynamic bundle #1 is `bundle.1.js`.

##### `--prefix`

URL prefix for the dynamic bundles.

Defaults to `/`, so the URL of dynamic bundle #1 is `/bundle.1.js`.

### API Usage

```js
var bundles = require('choo-bundles/browserify')

browserify('./entry')
  .plugin(bundles, {
    output: '/output/bundles',
    manifest: '/output/manifest.json',
  })
  .pipe(fs.createWriteStream('/output/bundles/common.js'))
```

#### Options

##### `output`

Set the output directory for dynamic bundles, if a string is passed.

Also accepts a function that returns a stream and takes `filename` as argument. The dynamic bundle will be written to the
stream:

```js
b.plugin(bundles, {
  output: filename => fs.createWriteStream(`/output/bundles/${filename}`)
})
```

Defaults to `.`.

##### `manifest`

Set the output path for manifest file, if a string is passed.

Also accepts a function that takes `manifest` object as argument:

```js
b.plugin(bundles, {
  manifest: manifest => fs.writeFileSync('/output/manifest.json', JSON.stringify(manifest))
})
```

Defaults to `./bundles.manifest.json`

##### `filename`

Filename for the dynamic bundles.
If string is passed you must use %f in place of the bundle id.

Also accepts a function that takes the entry point `entry` as argument:

```js
b.plugin(bundles, {
  filename: entry => 'bundle.' + entry.index + '.js'
})
```

##### `prefix`

URL prefix for the dynamic bundles.

Defaults to `/`, so dynamic bundle #1 will have `/bundle.1.js` as URL.

### Events

#### `b.on('choo-bunldes.pipeline', function (pipeline, entry, filename, manifest) {})`

`choo-bunlde` emits an event on the browserify instance for each pipeline it
creates.

`pipeline` is a [labeled-stream-splicer](https://github.com/browserify/labeled-stream-splicer) with labels:

 - `'pack'` - [browser-pack](https://github.com/browserify/browser-pack)
 - `'wrap'` - apply final wrapping

`entry` is the browserify row object for the entry point of the dynamic bundle.
`filename` is the name of the dynamic bundle file.
`manifest` is an object with an `add` function to add entries to the manifest

```js
b.on('choo-bundles.pipeline', function (pipeline, entry, filename, manifest) {
  manifest.add('css', '/' + filename.replace('.js', '.css')) // URL of the CSS file
  pipeline.get('pack').unshift(extractcss(`/output/bundles/${filename.replace('.js', '.css')}`))
})
```

## Notes

Browserify plugin heavily inspired on [`@goto-bus-stop`](https://github.com/goto-bus-stop)'s [`split-require`](https://github.com/goto-bus-stop/split-require)

## License

[MIT](LICENSE.md)
