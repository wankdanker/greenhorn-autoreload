var shoe = require('shoe');
var dnode = require('dnode');

var stream = shoe('/dnode');

var d = dnode();

d.on('remote', function (remote) {
  remote.register(function () {
    var url = new URL(window.location);

    url.search = 't=' + (new Date()).getTime();

    window.location = url.toString();
  });
});

d.pipe(stream).pipe(d);
