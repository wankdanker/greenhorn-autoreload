var debug = require('debug')('greenhorn-autoreload');
var argv = require('optimist').argv;
var clientjs = require('fs').readFileSync(__dirname + '/client.build.js', 'utf8');
var shoe = require('shoe');
var dnode = require('dnode');
var gaze = require('gaze');
var parse = require('url').parse;

var watch = (argv.w || argv.watch || '*.*').split(/,/gi).join(' ');

module.exports = function (app) {
  var clients = [];

  var sock = shoe(function (stream) {
    debug('New Client');

    var d = dnode({
      register : function (cb) {
        debug('Client Registered.');
        d.callback = cb;
      }
    });

    clients.push(d);

    d.pipe(stream).pipe(d);

    stream.on('end', function () {
      clients.splice(clients.indexOf(d), 1);
      debug('client ended.')
    });
  });

  app.events.on('server', function (server) {
    sock.install(server, '/dnode')
  });

  gaze(watch, function (err, watcher) {
    debug('watching', watcher.watched())
    watcher.on('all', function () {
      debug('change event')
      clients.forEach(function (d) {
        d.callback();
      })
    });
  });

  app.use(function (req, res, next) {
    //set path property which is required by autoreload
    req.path = req.url.split('?')[0];
    req.query = parse(req.url, true);
    return next();
  });

  app.use(function (req, res, next) {
    var buffer = '';

    //proxy res.write
    var _write = res.write;
    var _end = res.end;
    var _writeHead = res.writeHead;

    var script = '<script type="text/javascript">' + clientjs + '</script>';

    res.writeHead = writeHead;

    res.end = function (val) {
      //if val is not a string then
      if (typeof val !== 'string') {
        return end(val);
      }

      buffer += val;

      end(val);
    }

    res.write = function (val) {
      //if val is not a string then
      if (typeof val !== 'string') {
        return write(val);
      }

      buffer += val;

      //if val contains </head> then insert script into it
      var i = val.indexOf('</head>');

      if (!~i) {
        // /head not found
        return write(val)
      }

      var split = val.split('</head>');

      split[0] += script;

      return write(split.join('</head>'));
    };

    function write(val) {
      _write.call(res, val);
    }

    function end(val) {
      _end.call(res, val);
    }

    function writeHead(statusCode, statusMessage, headers) {
      headers = headers || {};

      headers['content-length'] = (headers['content-length'] || buffer.length) + script.length;

      _writeHead.call(res, statusCode, statusMessage || "", headers);
    }

    return next();
  });
};
