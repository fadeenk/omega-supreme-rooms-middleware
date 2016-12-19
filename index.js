'use strict';

//
// Expose the module.
//
module.exports = middleware;

/**
 * Middleware constructor
 * @return {Function} middleware parser
 */
function middleware() {

  /**
   * The middleware itself, overwrites the defaultParser with our custom parser and handles the request before handing
   * it to our parser.
   * All parameters are passed in from omega-supreme
   * @param {Object} primus - primus instance
   * @param {Object} defaultParser - the parser logic
   * @param {Object} req - the HTTP request
   * @param {Object} res - the HTTP response
   * @param {Object} next - the next function
   */
  function parser(primus, defaultParser, req, res, next) {
    defaultParser = require('./parser');
    var raw = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
      raw += chunk;
    }).on('end', function () {
      defaultParser(primus, raw, res);
    });
  }
  
  return parser;
}
