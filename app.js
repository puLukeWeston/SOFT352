var express = require('express');
var app = express();
var serv = require('http').Server(app);
var entity = require('./classes/Entity.js');

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

  Tap(1, "M", 100, 100);

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

  //  When a Player clicks on a Tap that belongs to their assignment, it emits a 'twistTap'
  socket.on('twistTap', function(data) {
    var targetTap;
    for(var i in Tap.list) {
      if(data.id === Tap.list[i].id)
        targetTap = Tap.list[i];
    }
    // Turn the Taps running condition to true or false depending on the direction passed
    if(data.direction === "on") {
      targetTap.running = true;
    } else if(data.direction === "off") {
      targetTap.running = false;
    }
  });

  // If a Player collides with a wall, it emits a 'playerCollision'
  socket.on('playerCollision', function(data) {
    // The ID of the player who has collided
    var id = data.playerId;
    // The X and the Y position before they had collided with a wall
    var x = data.playerX;
    var y = data.playerY;
    // Revert the Players X/Y to back before they hit a wall
    for(var i in Player.list) {
      var player = Player.list[i];
      if(player.id === id) {
        player.x = x;
        player.y = y;
      }
    }
  });

});

var contentPack = {tap:[]};
var initPack = {player:[], projectile:[], tap:[]};
var removePack = {player:[], projectile:[]};

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

},1000/20);


// Create a new Player object
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
  self.spd = 10;
  self.maxSpd = 10;
  self.score = 0;

  // Overwrite the update function
  var superUpdate = self.update;
  self.update = function() {
    self.updateSpd();
    superUpdate();
  }

  // Used to move the players character based on recieved key press info
  self.updateSpd = function() {
    // X Axis
    if(self.pressingRight)
      self.spdX = self.spd;
    else if(self.pressingLeft)
      self.spdX = -self.spd;
    else
      self.spdX = 0;
    // Y Axis
    if(self.pressingUp)
      self.spdY = -self.spd;
    else if(self.pressingDown)
      self.spdY = self.spd;
    else
      self.spdY = 0;

    // Reverts the effects of being slowed down after 7.5 seconds
    if(self.spd < self.maxSpd) {
      setTimeout(function() {
        if(self.spd + 0.2 <= self.maxSpd)
          self.spd += 0.2;
      }, 7500);
      }
    }

    // Returns the status' for the Player (sent once)
    self.getInitPack = function() {
      return {
        id:self.id,
        x:self.x,
        y:self.y,
        assignment:self.assignment,
        spd:self.spd,
        maxSpd:self.maxSpd,
        score:self.score
      };
    }

    // Returns the status' for the Player (called frequently, so will require more condencing)
    self.getUpdatePack = function() {
      return {
        id:self.id,
        x:self.x,
        y:self.y,
        assignment:self.assignment,
        spd:self.spd,
        score:self.score
      };
    }
  // Add the newly created Player to the Player.list
  Player.list[id] = self;
  // Also add their info to the initialisation package
  initPack.player.push(self.getInitPack());

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

  // Send the client an initialisation pack of all of the items needed to draw
  socket.emit('init', {
    selfId:socket.id,
    player:Player.getAllInitPack(),
    projectile:Projectile.getAllInitPack(),
    tap:Tap.getAllInitPack()
  });
}
Player.list = {};

// Get and return the initialisation package for all of the connected players
Player.getAllInitPack = function() {
  var players = [];
  for(var i in Player.list)
    players.push(Player.list[i].getInitPack());
  return players;
}

Player.onDisconnect = function(socket) {
  delete Player.list[socket.id];
}

// Get and return the most up to date information about a players status'
Player.update = function() {
  // Data to send back to the client
  var pack = [];
  // Loop through the clients and move their character
  for(var i in Player.list) {
    var player = Player.list[i];
    player.update();
    pack.push(player.getUpdatePack());
  }
  return pack;
}

var Projectile = function(parent, angle, xPos, yPos) {
  var self = Entity();
  self.id = Math.random();
  self.x = xPos;
  self.y = yPos;
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
      // If the projectile is in contact with a Player that can be targeted by its creator
      if(self.getDistance(p) < 16 && self.parent !== p.assignment) {
        // Decrease the players speed by 0.2 until it's at 2/3rds
        if(p.spd > p.maxSpd * 0.66) {
          p.spd -= 0.2;
        }
        // Remove the projectile
        self.toRemove = true;
        // If the projectile is in contact with a Player that can't be targeted
      } else if(self.getDistance(p) < 16 && self.parent === p.assignment){
        // Remove the projectile, but don't adjust speed
        self.toRemove = true;
      }
    }
  }

  self.getInitPack = function() {
    return {
      id:self.id,
      x:self.x,
      y:self.y
    };
  }

  self.getUpdatePack = function() {
    return {
      id:self.id,
      x:self.x,
      y:self.y
    };
  }

  if(self.toRemove) {
    delete Projectile.list[self.id];
    removePack.projectile.push(self.id);
  } else
    Projectile.list[self.id] = self;
    initPack.projectile.push(self.getInitPack());

  return self;
}
Projectile.list = {};

Projectile.getAllInitPack = function() {
  var projectiles = [];
  for(var i in Projectile.list)
    projectiles.push(Projectile.list[i].getInitPack());
  return projectiles;
}

Projectile.update = function() {
  var pack = [];
  for(var i in Projectile.list) {
    var projectile = Projectile.list[i];
    projectile.update();

    if(projectile.toRemove) {
      delete Projectile.list[i];
      removePack.projectile.push(projectile.id);
    } else
      pack.push(projectile.getUpdatePack());
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

  // If the Tap is "running" it should randomly generate projectiles to spray out
  self.checkRunning = function() {
    if(self.running){
      var projectile = Projectile(self.owner, Math.random()*360, self.x, self.y);
    }
  }

  self.getInitPack = function() {
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      running:self.running,
      recharging:self.recharging,
      owner:self.owner
    };
  }

  self.getUpdatePack = function() {
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      running:self.running,
      recharging:self.recharging,
      owner:self.owner
    };
  }

  Tap.list[id] = self;
  contentPack.tap.push(self.getInitPack());
  return self;
}
Tap.list = {};

Tap.getAllInitPack = function() {
  var tap = [];
  for(var i in Tap.list)
    tap.push(Tap.list[i].getInitPack());
  return tap;
}

Tap.update = function() {
  // Data to send back to the client
  var pack = [];
  for(var i in Tap.list) {
    var tap = Tap.list[i];
    tap.update();

    pack.push(tap.getUpdatePack());
  }
  return pack;
}
