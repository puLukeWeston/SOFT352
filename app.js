var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server Started.");

var SOCKET_LIST = {};

var Entity = function() {
  var self = {
    x:250,
    y:250,
    spdX:0,
    spdY:0,
    id:"",
  }
  self.update = function() {
    self.updatePosition();
  }
  self.updatePosition = function() {
    self.x += self.spdX;
    self.y += self.spdY;
  }

  return self;
}

var Player = function(id, assignment) {
  var self = Entity();
  // Overwrite the default entity attributes
  self.x = 250;
  self.y = 250;
  self.id = id;
  // Add Player specific defaults
  self.assignment = assignment;
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.maxSpd = 10;

  // Overwrite the update function
  var superUpdate = self.update;
  self.update = function() {
    self.updateSpd();
    superUpdate();
  }

  // Used to move the players character based on recieved key press info
  self.updateSpd = function() {
    if(self.pressingRight)
      self.spdX = self.maxSpd;
    else if(self.pressingLeft)
      self.spdX = -self.maxSpd;
    else
      self.spdX = 0;

    if(self.pressingUp)
      self.spdY = -self.maxSpd;
    else if(self.pressingDown)
      self.spdY = self.maxSpd;
    else
      self.spdY = 0;
    }

  Player.list[id] = self;

  return self;
}
Player.list = {};

Player.onConnect = function(socket, assignment) {
  // Create the client a new Player object based on the socket id
  var player = Player(socket.id, assignment);

  // Then add a listener for keypresses to update the position
  socket.on('keyPress', function(data){
    if(data.inputId === 'right')
      player.pressingRight = data.state;
    if(data.inputId === 'left')
      player.pressingLeft = data.state;
    if(data.inputId === 'up')
      player.pressingUp = data.state;
    if(data.inputId === 'down')
      player.pressingDown = data.state;
  });
}

Player.onDisconnect = function(socket) {
  delete Player.list[socket.id];
}

Player.update = function() {
  // Data to send back to the client
  var pack = [];
  // Loop through the clients and move their character
  for(var i in Player.list) {
    var player = Player.list[i];
    player.update();
    pack.push({
      x:player.x,
      y:player.y,
      assignment:player.assignment
    });
  }
  return pack;
}

var Projectile = function(angle) {
  var self = Entity();
  self.id = Math.random();
  // Calculate X & Y speeds
  self.spdX = Math.cos(angle/180*Math.PI) * 10;
  self.spdY = Math.sin(angle/180*Math.PI) * 10;

  // Set up timer to remove the projectile after 100 frames
  self.timer = 0;
  self.toRemove = false;
  var superUpdate = self.update;
  self.update = function() {
    if(self.timer++ > 100)
      self.toRemove = true;
    superUpdate();
  }

  Projectile.list[self.id] = self;
  return self;
}
Projectile.list = {};

Projectile.update = function() {
  //Create random bullets with random directions (testing)
  if(Math.random() < 0.1){
    Projectile(Math.random()*360);
  }

  // Data to send back to the client
  var pack = [];
  for(var i in Projectile.list) {
    var projectile = Projectile.list[i];
    projectile.update();

    if(projectile.toRemove)
      delete Projectile.list[i];
    else
      pack.push({
        x:projectile.x,
        y:projectile.y,
      });
  }
  return pack;
}

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
    for(var i in Player.list)
      clients += Player.list[i].assignment;

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
});

setInterval(function() {
  var pack = {
    player:Player.update(),
    projectile:Projectile.update()
  }

  // Send the updated info back to update the clients screen
  for(var i in SOCKET_LIST) {
    var socket = SOCKET_LIST[i];
    socket.emit('newPositions', pack);
  }
},1000/20);
