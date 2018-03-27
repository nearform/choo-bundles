const h = require('choo/html')

function lazy (state, emit) {
  return h`
    <div>I was lazy loaded</div>
  `
}

module.exports = lazy
