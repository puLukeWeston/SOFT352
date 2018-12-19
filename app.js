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

  createElements(assignment, socket.id);

  // If the client disconnects
  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
    removePack.player.push(socket.id);
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

function createElements(assignment, id) {
  var tap = Tap(1, "M", 100, 100);
  var socket = SOCKET_LIST[id];
  socket.emit('startPositions', assignment);
}


var initPack = {player:[], projectile:[], tap:[]};
var removePack = {player:[], projectile:[], tap:[]};

setInterval(function() {
  var pack = {
    player:Player.update(),
    projectile:Projectile.update(),
    tap:Tap.update()
  }

  // Send the updated info back to update the clients screen
  for(var i in SOCKET_LIST) {
    var socket = SOCKET_LIST[i];
    socket.emit('init', initPack);
    socket.emit('update', pack);
    socket.emit('remove', removePack);
  }

  initPack.player = [];
  initPack.projectile = [];
  initPack.tap = [];
  removePack.player = [];
  removePack.projectile = [];
  removePack.tap = [];

},1000/20);


// Start of a long days work:

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

  initPack.player.push({
    id:self.id,
    x:self.x,
    y:self.y,
    assignment:self.assignment
  });

  return self;
}

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
Player.list = {};


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
      id:player.id,
      x:player.x,
      y:player.y,
      assignment:player.assignment
    });
  }
  return pack;
}

var Projectile = function(parent, angle, posX, posY) {
  var self = Entity();
  self.id = Math.random();
  self.x = posX;
  self.y = posY;
  // Calculate X & Y speeds
  self.spdX = Math.cos(angle/180*Math.PI) * 10;
  self.spdY = Math.sin(angle/180*Math.PI) * 10;

  self.parent = parent;

  // Set up timer to remove the projectile after 10 frames
  self.timer = 0;
  self.toRemove = false;
  var superUpdate = self.update;
  self.update = function() {
    if(self.timer++ > 10)
      self.toRemove = true;
    superUpdate();

    for(i in Player.list) {
      var p = Player.list[i];
      if(self.getDistance(p) < 16 && self.parent !== p.assignment) {
         //TODO: sort out speed adjustments
         self.toRemove = true;
         console.log("Owch!");
      } else if(self.getDistance(p) < 16 && self.parent === p.assignment){
        self.toRemove = true;
        console.log("Immunity");
      }
    }
  }

  if(self.toRemove) {
    delete Projectile.list[self.id];
    removePack.projectile.push(self.id);
  } else
    Projectile.list[self.id] = self;
    initPack.projectile.push({
      id:self.id,
      x:self.x,
      y:self.y
    });
  return self;
}
Projectile.list = {};

Projectile.update = function() {

  // Data to send back to the client
  var pack = [];
  for(var i in Projectile.list) {
    var projectile = Projectile.list[i];
    projectile.update();

    if(projectile.toRemove) {
      delete Projectile.list[i];
      removePack.projectile.push(projectile.id);
    } else
      pack.push({
        id:projectile.id,
        x:projectile.x,
        y:projectile.y,
      });
  }
  return pack;
}

var Tap = function(id, owner, xPos, yPos) {
  var self = Entity();
  // Overwrite the default entity attributes
  self.id = id;
  self.x = xPos;
  self.y = yPos;
  // Add Tap specific defaults
  self.recharging = false;
  self.running = false;
  self.owner = owner;

  var superUpdate = self.update;
  self.update = function() {
    self.checkRunning();
    superUpdate();
  }

  self.checkRunning = function() {
    if(self.running){
      var projectile = Projectile(self.owner, Math.random()*180, self.x, self.y);
    }
  }
  Tap.list[id] = self;

  initPack.tap.push({
    id:self.id,
    x:self.x,
    y:self.y,
    running:self.running,
    recharging:self.recharging,
    owner:self.owner
  });

  return self;
}
Tap.list = {};

Tap.update = function() {
  // Data to send back to the client
  var pack = [];
  for(var i in Tap.list) {
    var tap = Tap.list[i];
    tap.update();

    pack.push({
      x:tap.x,
      y:tap.y,
      id:tap.id,
      running:tap.running,
      owner:tap.owner
    });
  }
  return pack;
}
