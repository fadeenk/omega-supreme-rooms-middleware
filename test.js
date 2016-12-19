/* istanbul ignore next */
describe('omega supreme middleware', function () {
  'use strict';

  var url = require('url').resolve
    , request = require('request')
    , assume = require('assume')
    , Primus = require('primus')
    , async = require('async')
    , http = require('http')
    , omega = require('omega-supreme')
    , middleware = require('./index')
    , metroplex = require('metroplex')
    , Rooms = require('primus-rooms')
    , ioredis = new require('ioredis')()
    , roomsAdapter = new (require('primus-rooms-redis-adapter'))(ioredis, {omegaSupreme: true, metroplex: true});

  var port = 1024
    , primus2
    , server2
    , primus
    , server
    , connections = [];

  it('is exposed as function', function () {
    assume(middleware).to.be.a('function');
  });

  it('exposes a the parser as a function', function () {
    assume(middleware()).to.be.a('function');
  });
  
  describe('rooms integration & original parser functionality', function () {
    beforeEach(function each(next) {
      server = http.createServer();

      primus = new Primus(server, {
        transformer: 'websockets'
      });

      primus.options.middleware = middleware();
      primus.plugin('rooms', Rooms);
      primus.plugin('omega', omega);

      server.port = port++;
      server.url = 'http://localhost:'+ server.port;

      server.listen(server.port, function () {
        for (var i = 0; i < 15; i++) {
          connections.push(primus.Socket(server.url));
        }
        next();
      });
    });

    afterEach(function each(next) {
      primus.destroy(function () {
        connections = [];
        next();
      });
    });

    var rooms = ["test1", "test2"];

    it('handles requests with an invalid body', function (next) {
      request({
        url: url(server.url, '/primus/omega/supreme'),
        auth: { user: 'omega', pass: 'supreme' },
        method: 'PUT',
        body: 'foo'
      }, function (err, res, body) {
        if (err) return next(err);

        assume(res.statusCode).to.equal(500);
        assume(body).to.contain('invalid data structure');
        next();
      });
    });
    it('handles single spark broadcast', function (next) {
      var client = primus.Socket(server.url);
      client.id(function(id) {
        request({
          url: url(server.url, '/primus/omega/supreme'),
          auth: {user: 'omega', pass: 'supreme'},
          method: 'PUT',
          json: {msg: 'foo', sparks: id}
        }, function (err, res, body) {
          if (err) return next(err);
          assume(body.send).to.equal(1);
          next();
        });
      });
    });
    it('does not send a request when the sparks are all local', function (next) {
      var client = primus.Socket(server.url);
      client.id(function get(id) {
        primus.forward(server.url, 'foo', id, function (err, data) {
          if (err) return next(err);
          assume(data.send).to.equal(1);
          assume(data.local).to.equal(true);
          next();
        });
      });
    });

    it('should broadcast to all users in a room', function (done) {
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            primus.join(id, rooms[0], next);
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms[0]}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length);
            done();
          });
        });
      });
    });
    it('should broadcast to all users in a room except one', function (done) {
      var excluded;
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            excluded = id;
            primus.join(id, rooms[0], next);
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms[0], except: excluded}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length - 1);
            done();
          });
        });
      });
    });
    it('should broadcast to all users in a room except excluded users', function (done) {
      var counter = 0, except = [];
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            counter++;
            if (counter % 2 === 0) {
              except.push(id);
              primus.join(id, rooms[0], next);
            } else {
              primus.join(id, rooms[1], next);
            }
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms, except: except}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length - except.length);
            done();
          });
        });
      });
    });
    it('should not broadcast to any users in an empty room', function (done) {
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            primus.join(id, rooms[0], next);
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms[1]}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(0);
            done();
          });
        });
      });
    });
    it('should broadcast to all unique users in multiple rooms (if user is in multiple rooms should only get 1 message)'
      , function (done) {
      var counter = 0;
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            counter++;
            if (counter % 2 === 0) {
              if (counter === 10) {
                primus.join(id, rooms, next);
              } else {
                primus.join(id, rooms[0], next);
              }
            } else {
              primus.join(id, rooms[1], next);
            }
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length);
            done();
          });
        });
      });
    });
  });

  describe('rooms and metroplex integration', function () {
    beforeEach(function(next) {
      server = http.createServer();
      server2 = http.createServer();
      server.port = port++;
      server2.port = port++;

      server.url = 'http://localhost:'+ server.port;
      server2.url = 'http://localhost:'+ server2.port;

      primus = new Primus(server, {
        transformer: 'websockets',
        rooms: { adapter: roomsAdapter },
        plugin: {
          'rooms': Rooms,
          'omega-supreme': omega,
          'metroplex': metroplex,
        },
        redis: ioredis
      });
      primus.options.middleware = middleware();
      primus2 = new Primus(server2, {
        transformer: 'websockets',
        rooms: { adapter: roomsAdapter },
        plugin: {
          'rooms': Rooms,
          'omega-supreme': omega,
          'metroplex': metroplex,
        },
        redis: ioredis
      });
      primus2.options.middleware = middleware();

      server.listen(server.port, function () {
        server2.listen(server2.port, function(){
          for (var i = 0; i < 15; i++) {
            if (i < 7) {
              connections.push(primus.Socket(server.url));
            } else {
              connections.push(primus2.Socket(server2.url));
            }
          }
          next();
        });
      });
    });

    afterEach(function(next) {
      primus.destroy(function () {
        primus2.destroy(function () {
          connections = [];
          next();
        });
      });
    });

    it('should broadcast to all users in a room on different servers', function(done){
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            if (this.url.href === server.url) {
              primus.join(id, "test", next);
            } else {
              primus2.join(id, "test", next);
            }
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: "test"}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length);
            done();
          });
        });
      });
    });

    it('should broadcast to all users on different servers if no ids provided', function(done){
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            if (this.url.href === server.url) {
              primus.join(id, "test", next);
            } else {
              primus2.join(id, "test", next);
            }
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo'}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length);
            done();
          });
        });
      });
    })

  });
});
