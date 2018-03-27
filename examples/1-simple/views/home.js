const h = require('choo/html')

function home (state, emit) {
  return h`
    <div>
      <h1>Welcome!</h1>
      <a href="/lazy">Load lazy view</a>
    </div>
  `
}

module.exports = home
