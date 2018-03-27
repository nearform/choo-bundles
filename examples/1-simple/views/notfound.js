const h = require('choo/html')

function notfound (state, emit) {
  return h`
    <div>Not found :(</div>
  `
}

module.exports = notfound
