'use strict';

module.exports = parser;

/**
 * The parser function, parses the data
 * @param {Object} primus - primus instance
 * @param {String} raw - the HTTP request raw data
 * @param {Object} res - the HTTP response
 * @return {Object} response.end status
 */
function parser(primus, raw, res) {

  var called = 0
    , data
    , err
    , metroplexForwarded;

  try {
    data = JSON.parse(raw);
  } catch (e) {
    err = e;
  }

  res.setHeader('Content-Type', 'application/json'); // set response content type

  if (
    err                              // No error..
    || 'object' !== typeof data         // Should be an object.
    || Array.isArray(data)              // A real object, not array.
    || !data.msg                        // The data we send should be defined.
  ) {
    res.statusCode = 500;
    return res.end('{ "ok": false, "reason": "invalid data structure" }');
  }

  if (data.msg.hasOwnProperty('metroplexForwarded')) {
    metroplexForwarded = true;
    data.msg = data.msg.msg;
  } else {
    metroplexForwarded = false;
  }


  var callingRooms = primus.$ && primus.$.rooms && (Array.isArray(data.rooms) || typeof data.rooms === 'string');
  //
  // Process the incoming messages in four different modes:
  //
  // Rooms:  If primus-rooms is being used. Takes in rooms array or a string for
  //         the room to broadcast to. Also an optional except array or a string of
  //         sparkIDs to exclude.
  // Sparks: The data.sparks is an array with spark id's which we should write
  //         the data to.
  // Spark:  The data.sparks is the id of one single individual spark which
  //         should receive the data.
  // All:    Broadcast the message to every single connected spark if no
  //         `data.sparks` has been provided.
  //
  if (callingRooms) {
    // initialize except array
    data.except = data.except || [];
    if (typeof data.except === 'string') {
      data.except = [data.except];
    }
    //get the sparks in the rooms
    primus.room(data.rooms).clients(function (err, sparks) {
      // check if the return is multiple rooms with array of sparks for each room
      if (!Array.isArray(sparks)) {
        var rooms = sparks;
        sparks = []; // reset sparks array
        var uniqueSparks = {}; // set up hash table to prevent multiple msgs sent to the same spark if in multiple rooms
        Object.keys(rooms).forEach(function (room) {
          rooms[room].forEach(function (spark) {
            if (!uniqueSparks.hasOwnProperty(spark)) { // if the spark is not in the hash add it to sparks array
              if (data.except.indexOf(spark) === -1) { // filter while checking for unique
                sparks.push(spark);
              }
              uniqueSparks[spark] = true;
            }
          })
        })
      }
      if (Array.isArray(data.except) && data.except.length > 0) {  // exclude sparks in except array
        sparks = sparks.filter(function (id) {
          return data.except.indexOf(id) === -1;
        });
      }
      return send(sparks);
    });
  } else if (Array.isArray(data.sparks)) {
    return send(data.sparks);
  } else if ('string' === typeof data.sparks && data.sparks) {
    return send([data.sparks]);
  } else {
    return send([]);
  }

  /**
   * The function responsible for sending the msg to all different sparks specified in the sparks array
   * @param {Array} sparks - array of sparks to send the msg to. If empty transmit to all unless it is an empty room.
   * @return {Object} res.end, responds with status of ok and send just like omega-supreme
   */
  function send(sparks) {
    // if no sparkIDs provided
    if (sparks.length === 0) {
      if (callingRooms) { // if no sparks found in a room  return
        res.statusCode = 200;
        return res.end('{ "ok": true, "send":' + called + ' }')
      } else if (primus.forward.broadcast && !metroplexForwarded) { // else broadcast to all in a cluster (if in a cluster)
        data.msg = {msg: data.msg, metroplexForwarded: true};
        primus.forward.broadcast(data.msg, function(err, status) {
          if (err) {
            res.statusCode = 400;
            return res.end(JSON.stringify(err));
          }
          res.statusCode = 200;
          return res.end(JSON.stringify(status));
        })
      } else { // broadcast to all locally
        primus.forEach(function each(spark) {
          spark.write(data.msg);
          called++;
        });
        res.statusCode = 200;
        return res.end('{ "ok": true, "send":' + called + ' }');
      }
    } else { // sparkIDs provided
      if (primus.forward.sparks) { // if metroplex cluster is set up use forward instead
        primus.forward.sparks(sparks, data.msg, function (err, status) {
          if (err) {
            res.statusCode = 400;
            return res.end(JSON.stringify(err));
          }
          res.statusCode = 200;
          return res.end(JSON.stringify(status));
        })
      } else { // brodacst to the specified sparks locally
        sparks.forEach(function (sparkID) {
          var spark = primus.spark(sparkID);

          if (spark) {
            spark.write(data.msg);
            called++;
          }
        });
        res.statusCode = 200;
        return res.end('{ "ok": true, "send":' + called + ' }');
      }
    }
  }
}

