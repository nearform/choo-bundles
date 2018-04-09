const choo = require('choo')
const ssr = require('choo-ssr')
const async = require('choo-async')
const bundles = require('choo-bundles')

const home = require('./views/home')
const notfound = require('./views/notfound')

function main () {
  const app = async(choo())

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
