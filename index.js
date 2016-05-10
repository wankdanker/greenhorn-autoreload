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
    var d = dnode({
      register : function (cb) {
        debug('Client Registered.');
        d.callback = cb;
      }
    });

    clients.push(d);
    debug('New Client. Clients: %s', clients.length);

    d.pipe(stream).pipe(d);

    stream.on('close', function () {
      clients.splice(clients.indexOf(d), 1);

      debug('Client ended. Clients: %s', clients.length);
    });
  });

  app.events.on('server', function (server) {
    sock.install(server, '/dnode')
  });

  gaze(watch, function (err, watcher) {
    debug('watching', watcher.watched())
    watcher.on('all', function (ev, filepath) {
      debug('Change event: %s, %s', ev, filepath);

      clients.forEach(function (d) {
        d.callback();
      })
    });
  });

  app.use(function (req, res, next) {
    var buffer = '';
    var ending = false;

    //proxy res.write
    var _write = res.write;
    var _end = res.end;
    var _writeHead = res.writeHead;

    var script = '\n<script type="text/javascript">\n' + clientjs + '\n</script>\n';

    res.writeHead = function (statusCode, statusMessage, headers) {
      debug('writeHead here');

      headers = headers || {};

      headers['content-length'] = (headers['content-length'] || buffer.length) + script.length;;

      writeHead(statusCode, statusMessage, headers);
    };

    res.end = function (val) {
      debug('end here', typeof val);

      ending = true;

      //if val is not a string then
      if (typeof val !== 'string') {
        return end(val);
      }

      buffer += val;

      end(val);
    }

    res.write = function (val) {
      debug('write here', typeof val);

      //if val is not a string then
      if (typeof val !== 'string') {
        return write(val);
      }

      debug('write here', val);

      buffer += val;

      //if val contains </head> then insert script into it
      var i = val.indexOf('</head>');

      if (!~i && !ending) {

        // /head not found
        return write(val)
      }

      var split = val.split('</head>');

      split[0] += script;

      return write(split.join('</head>'));
    };

    function write(val) {
      debug('write2 here');
      _write.call(res, val);
    }

    function end(val) {
      debug('end2 here');
      _end.call(res, val);
    }

    function writeHead(statusCode, statusMessage, headers) {
      debug('writeHead2 here', arguments);
      _writeHead.call(res, statusCode, statusMessage || "", headers);
    }

    return next();
  });
};
