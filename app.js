var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var crypto = require('crypto');

var routes = require('./routes/index');
var users = require('./routes/users');

var Session = require('express-session');
var RedisStore = require('connect-redis')(Session);
var redisStore = new RedisStore();

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

//TODO: move to config
cookieSecret = 'LrG23_uWZHNCweEXDxkAQGFUmXFjNxidr77jbHRbjsDkw4-k29uAx4Sg5QdUEhEz';

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(require('node-compass')({mode: 'expanded'}));
app.use(express.static(path.join(__dirname, 'public')));

app.use(Session({store: redisStore, secret: cookieSecret}));

app.use('/*', routes);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

var getHTTPSession = function(socket, next) {
  if (!socket.sessionID) {
    next(new Error('sessionID must be set'));
    return;
  }
  redisStore.get(socket.sessionID, function(err, session) {
    if (err) {
      next(new Error(err));
      return;
    }
    socket.session = session;
    next(null, session);
  });
};

io.use(function(socket, next) {
  var handshake = socket.handshake;
  //socket.io-client (from gulp) の場合はセッション気にせん
  if (handshake.headers['user-agent'] === 'node-XMLHttpRequest') {
    next();
    return;
  }
  if (!handshake.headers.cookie) {
    next(new Error('cookie must be set'));
    return;
  }
  cookieParser(cookieSecret)(handshake, {}, function(err) {
    if (err) {
      next(new Error(err));
      return;
    }
    socket.sessionID = socket.handshake.signedCookies['connect.sid'];
    next();
  });
});

var channelFiles = {};

io.on('connection', function(socket) {
  console.log('new connect!');
  socket.on('createNewChannel', function() {
    // TODO: ちゃんとIDつくる
    var channelID = (new Date()).getTime();
    socket.join('/channel/' + channelID, function() {
      socket.emit('channelCreated', channelID);
    });
  });
  socket.on('joinChannel', function(channelID) {
    var channelNamespace = '/channel/' + channelID;
    var roomConnections = io.sockets.adapter.rooms[channelNamespace];
    var msg = 'joined.';
    if (!roomConnections || roomConnections.length <= 0) {
      msg += ' but this channel connection has no connections without you.';
    }
    socket.join(channelNamespace, function() {
      socket.emit('channelJoined', msg);
    });
  });
  socket.on('getCurrentFiles', function(channelID){
    socket.emit('currentFiles', channelFiles['/channel/' + channelID] || {});
  });
  socket.on('fileChanged', function(data) {
    var channel = '/channel/' + data.channelID;
    if(!channelFiles[channel]){
      channelFiles[channel] = {};
    }
    if(!channelFiles[channel][data.path]){
      channelFiles[channel][data.path] = {
        id: crypto.createHash('sha512').update(data.path).digest('hex'),
        path: data.path,
        name: path.basename(data.path),
        extension: path.extname(data.path).replace(/^\./, ''),
        data: null
      }
    }

    channelFiles[channel][data.path].data = data.diff;

    if(data.isSnapshot){
      console.log('snapshot');
      socket.broadcast.to(channel).emit('addSnapshot', channelFiles[channel][data.path]);
    }else{
      socket.broadcast.to(channel).emit('addPatch', channelFiles[channel][data.path]);
    }
  });
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = server;
