var fs = require('fs');

var gulp = require('gulp');
var watch = require('gulp-watch');
var _ = require('underscore');
var diff = require('diff');

var argv = require('yargs').argv;
var src = argv.w || null;
var channelID = argv.c || null;
var host = argv.u || 'http://localhost:3000';

if (!src) {
  throw new Error('-w must be set');
}

if (!channelID) {
  throw new Error('-c must be set');
}

var isReady = false;
var io = require('socket.io-client');
var socket = io(host);
socket.on('connect', function() {
  console.log('connected');
  socket.emit('joinChannel', channelID);
  socket.on('channelJoined', function(msg) {
    console.log(msg);
    isReady = true;
  });
  socket.on('addPatch', function(){
    console.log('addPatch', arguments);
  });
});

var files = {};

// TODO: gulp-watchでpipeするように変更する（新規ファイル作成に対応するため）
module.exports = function() {
  gulp.watch(src, function(modified) {
    if (!isReady) {
      return;
    }
    var type = modified.type;
    var path = modified.path;

    if (!_.has(files, path)) {
      files[path] = null;
    }
    try {
      fs.readFile(path, {encoding: 'utf8', flag: 'r'}, function(err, data) {
        if (err) {
          console.error('read changed file error:', err);
          return;
        }

        var isSnapshot = files[path] === null;
        var patch = (!isSnapshot && files[path]) ? diff.createPatch(path, files[path], data) : null;
        socket.emit('fileChanged', {
          channelID: channelID,
          path: path,
          isSnapshot: true || isSnapshot,
          diff: data //isSnapshot ? data : patch
        });
        files[path] = data;
      });
    } catch (err) {
      console.log(err);
    }
  });
};