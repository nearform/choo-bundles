(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({"bundle5":[function(require,module,exports){
require("choo-bundles")._loaded("/build/bundle.5.js", require("bundle"));
},{"bundle":5,"choo-bundles":1}],5:[function(require,module,exports){
const h = require('choo/html')

function lazy (state, emit) {
  return h`
    <div>I was lazy loaded</div>
  `
}

module.exports = lazy

},{"choo/html":15}]},{},["bundle5"]);
