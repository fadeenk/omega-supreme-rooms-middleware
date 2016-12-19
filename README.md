# Omega Supreme Rooms Middleware

[![Version npm](https://img.shields.io/npm/v/omega-supreme-rooms-middleware.svg?style=flat-square)](http://browsenpm.org/package/omega-supreme-rooms-middleware)
[![Build Status](https://img.shields.io/travis/fadeenk/omega-supreme-rooms-middleware/master.svg?style=flat-square)](https://travis-ci.org/fadeenk/omega-supreme-rooms-middleware)
[![Dependencies](https://img.shields.io/david/fadeenk/omega-supreme-rooms-middleware.svg?style=flat-square)](https://david-dm.org/fadeenk/omega-supreme-rooms-middleware)
[![Coverage Status](https://img.shields.io/coveralls/fadeenk/omega-supreme-rooms-middleware/master.svg?style=flat-square)](https://coveralls.io/r/fadeenk/omega-supreme-rooms-middleware?branch=master)

This middleware adds support for `primus-rooms` and automatically integrates it with `metroplex` if included.
you **_MUST_** have `primus-rooms` installed.

## Installation

```js
npm install --save omega-supreme-rooms-middleware
```

## Using the middleware

Just set the middleware in primus options so omega-primus can use it, see example below:

```js
'use strict';

var Primus = require('primus')
  , server = require('http').createServer()
  , middleware = require('omega-supreme-rooms-middleware');

var primus = new Primus(server, {
  /* Add the options here, in the Primus's options */
});

primus.plugin('omega-supreme', require('omega-supreme'));
primus.options.middleware = middleware();

server.listen(8080);
```

### Messaging

The middleware follows and maintains all functionality of [`omega-supreme`](https://github.com/primus/omega-supreme).
The middleware adds the ability to make requests with the following properties:

- The `rooms` property can be an array or a string of room names. Message will be
 broadcasted to all the sparks connected to the rooms.
- The `except` property can be an array or a string of spark ids. Message will ***not***
 be broadcasted to the sparks in the except property. This property will ***only*** be
 used when rooms property is provided

### Metroplex integration

The middleware automatically handles metroplex. If using metroplex and [`primus-rooms-redis-adapter`](https://github.com/fadeenk/primus-rooms-redis-adapter).

