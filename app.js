var express = require('express');
var app = express();
var serv = require('http').Server(app);
var player = require('./classes/Player.js');
var projectile = require('./classes/Projectile.js');
var tap = require('./classes/Tap.js');

app.get('/',function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server Started.");

var SOCKET_LIST = {};
Player.list = {};
Projectile.list = {};
Tap.list = {};

// Constant to allow debugging of values server-side
var DEBUG = true;
var count = 0;
var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
  // Give the client an ID (temporary functionality)
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  // Either a cat or a mouse
  var assignment = "";
  // If this was the first connection to the server, default to cat
  if(count === 0) {
    assignment = "C";
    count++;
    // If its the second, default to mouse
  } else if(count < 2) {
    assignment = "M";
    count++;
    // If there have been more than 2 connections
  } else {
    // Loop through the clients and string them together
    var clients = "";
    for(var i in Player.list) {
      clients += Player.list[i].assignment;
    }

    // If the String contains both a C and an M, don't assign the client to anything
    if(clients.indexOf("M") > -1 && clients.indexOf("C") > -1)
      console.log("Already have two clients");
    // If just an M exists, assign the client to cat (and vice versa)
    else if(clients.indexOf("M") > -1)
      assignment = "C";
    else
      assignment = "M";
  }

  // When a player connects, call this function to create a new Player
  Player.onConnect(socket, assignment);

  var tap = Tap(1);
  tap.x = 100;
  tap.y = 100;

  var pack = {
    tap:Tap.update()
  }
  for(var i in SOCKET_LIST) {
    var socket = SOCKET_LIST[i];
    socket.emit('startPositions', pack);
  }

  // If the client disconnects
  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
  });

  // User input for evaluation variables server-side for debugging
  socket.on('evalServer', function(data){
    // If the debugging constant is false then we don't want user input being evaluated
    if(!DEBUG)
      return;
    // If the input can be evaluated then respond with the info
    try {
      var res = eval(data);
    } catch(e) {
      res = e.message;
    }
    // Return the eval
    socket.emit('evalAnswer',res);
  });

  socket.on('twistTap', function(data) {
    var targetTap;
    for(var i in Tap.list) {
      if(data.id === Tap.list[i].id)
        targetTap = Tap.list[i];
    }
    if(data.direction === "on") {
      targetTap.running = true;
      console.log("Tap on");
    } else if(data.direction === "off") {
      targetTap.running = false;
      console.log("Tap off");
    }
  });
});

setInterval(function() {
  var pack = {
    player:Player.update(),
    projectile:Projectile.update(),
    tap:Tap.update()
  }

  // Send the updated info back to update the clients screen
  for(var i in SOCKET_LIST) {
    var socket = SOCKET_LIST[i];
    socket.emit('newPositions', pack);
  }
},1000/20);
