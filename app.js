var mongojs = require("mongojs");
var db = mongojs('localhost:27017/jomAndTerry', ['account']);

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
var MAP_WIDTH = 1200;
var MAP_HEIGHT = 800;
var TILE_SIZE = 32;

var isValidPassword = function(data, cb) {
  db.account.find({username:data.username, password:data.password}, function(err, res) {
    if(res[0])
      cb(true);
    else
      cb(false);
  });
}

var isUsernameTaken = function(data, cb) {
  db.account.find({username:data.username}, function(err, res) {
    if(res[0])
      cb(true);
    else
      cb(false);
  });
}

var addUser = function(data, cb) {
  db.account.insert({username:data.username, password:data.password}, function(err, res) {
    cb();
  });
}

var count = 0;
var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
  // Give the client an ID (temporary functionality)
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  socket.on('signUp', function(data) {
    isUsernameTaken(data, function(res) {
      if(res)
        socket.emit('signUpResponse', {success:false});
      else {
        addUser(data, function() {
          socket.emit('signUpResponse', {success:true});
        });
      }
    });
  });

  socket.on('login', function(data) {
    isValidPassword(data, function(res) {
      if(res) {
        socket.emit('loginResponse', {success:true});
        var assignment = "M";
        var clients = "";
        for(var i in Player.list) {
          clients += Player.list[i].assignment;
        }

        // If the String contains both a C and an M, don't assign the client to anything
        if(clients.indexOf("M") > -1 && clients.indexOf("C") > -1) {
          console.log("Already have two clients");
          removePack.player.push(socket.id);
          delete Player.list[socket.id];
        } else if(clients.indexOf("M") > -1)
            assignment = "C";

        Player.onConnect(socket, assignment);

      } else
          socket.emit('loginResponse', {success:false});
    });
  });

  // If the client disconnects
  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
    removePack.player.push(socket.id);
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

});

setInterval(function() {
  var pack = {
    player:Player.update(),
    projectile:Projectile.update(),
    tap:Tap.update(),
    cheese:Cheese.update()
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
  initPack.cheese = [];
  removePack.player = [];
  removePack.projectile = [];
  removePack.cheese = [];

},1000/20);

Maps = function(id, width, height, grid) {
  var self = {
    id:id,
    width:width,
    height:height,
    grid:grid
  };

  self.isPositionWall = function(givenX, givenY) {
    var gridX = Math.floor(givenX / TILE_SIZE);
    var gridY = Math.floor(givenY / TILE_SIZE);

    // If the given bounds are colliding with a 1 in the map grid there must be a collision
    if(gridX < 0 || gridX >= self.grid[0].length)
      return true;
    if(gridY < 0 || gridY >= self.grid.length)
      return true;
    return self.grid[gridY][gridX];

  }

  return self;
}


// Create a new Player object
var Player = function(id, assignment) {
  var self = Entity();
  // Overwrite the default entity attributes
  if(assignment === "C") {
    self.x = 480;
    self.y = 580;
  } else if(assignment === "M") {
    self.x = 1125;
    self.y = 965;
  }
  self.id = id;
  // Add Player specific defaults
  self.assignment = assignment;
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.spd = 12;
  self.maxSpd = 15;
  self.score = 0;
  self.lives = 3;
  self.cooldown = false;

  // Overwrite the super update function
  self.update = function() {
    self.updateSpd();
    if(!currentMap.isPositionWall(self.x + self.spdX, self.y + self.spdY)) {
      self.x += self.spdX;
      self.y += self.spdY;
    }

    for(i in Player.list) {
      var p = Player.list[i];
      // If the Cat touches the Mouse
      if(p.assignment === "M") {
        if(self.getDistance(p) < TILE_SIZE / 2 && self.assignment === "C" && !self.cooldown) {
          console.log("The cooldown = " + self.cooldown);
          p.lives--;
          if(p.lives == 0) {
            console.log("Mouse has been caught! Their score was: " + p.score);
          } else {
            console.log("Touch!");
            self.x = 480;
            self.y = 580;
            self.cooldown = true;
            setTimeout(function() {
              self.cooldown = false;
              console.log("Cooldown over! Get catching");
            }, 5000);

          }
          // Life system? Cat touches mouse three times & wins?
          // Cooldown on touches
        }
      }
    }
  }

  // Used to move the players character based on recieved key press info
  self.updateSpd = function() {
    // X Axis
    if(self.pressingRight)
      self.spdX = self.spd;
     else if(self.pressingLeft)
      self.spdX =- self.spd;
     else
      self.spdX = 0;

    // Y Axis
    if(self.pressingUp)
      self.spdY =- self.spd;
     else if(self.pressingDown)
      self.spdY = self.spd;
     else
      self.spdY = 0;

    // Reverts the effects of being slowed down after 7.5 seconds
    if(self.spd < self.maxSpd) {
      setTimeout(function() {
        if(self.spd + 0.5 <= self.maxSpd)
          self.spd += 0.5;
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
    tap:Tap.getAllInitPack(),
    cheese:Cheese.getAllInitPack(),
    map:{id:currentMap.id, width:currentMap.width, height:currentMap.height, grid:currentMap.grid}
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

  self.update = function() {
    if(self.timer++ > 10)
      self.toRemove = true;

    if(!currentMap.isPositionWall(self.x + self.spdX, self.y + self.spdY)) {
      self.x += self.spdX;
      self.y += self.spdY;
    } else {
      self.toRemove = true;
    }

    for(i in Player.list) {
      var p = Player.list[i];
      // If the projectile is in contact with a Player that can be targeted by its creator
      if(self.getDistance(p) < TILE_SIZE / 2 && self.parent !== p.assignment) {
        // Decrease the players speed by 0.5 until it's at 3/5ths
        if(p.spd > p.maxSpd * 0.6) {
          p.spd -= 0.5;
        }
        // Remove the projectile
        self.toRemove = true;
        // If the projectile is in contact with a Player that can't be targeted
      } else if(self.getDistance(p) < TILE_SIZE / 2 && self.parent === p.assignment){
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

  self.update = function() {
    self.checkRunning();
  }

  // If the Tap is "running" it should randomly generate projectiles to spray out
  self.checkRunning = function() {
    if(self.running){
      var projectile = Projectile(self.owner, Math.random()*180, self.x, self.y);
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

var Cheese = function(id, x, y) {
  var self = Entity();
  self.id = id;
  self.x = x;
  self.y = y;
  self.consumed = false;

  self.update = function() {

    for(i in Player.list) {
      var p = Player.list[i];
      // If the cheese is in contact with a Mouse
      if(self.getDistance(p) < 16 && p.assignment === "M") {
        // Inrease the players score by 1
        p.score++;
        // Remove the cheese
        self.consumed = true;
      }
    }

    self.checkConsumed();
  }

  self.checkConsumed = function() {
    if(self.consumed) {
      delete Cheese.list[i];
      removePack.cheese.push(self.id);
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

  Cheese.list[self.id] = self;
  initPack.cheese.push(self.getInitPack());
  return self;
}
Cheese.list = {};

Cheese.getAllInitPack = function() {
  var cheese = [];
  for(var i in Cheese.list)
    cheese.push(Cheese.list[i].getInitPack());
  return cheese;
}

Cheese.update = function() {
  var pack = [];
  for(var i in Cheese.list) {
    var cheese = Cheese.list[i];
    cheese.update();

    if(cheese.consumed) {
      delete Cheese.list[i];
      removePack.cheese.push(cheese.id);
    }
  }
  return pack;
}


currentMap = Maps('blueprints', MAP_WIDTH, MAP_HEIGHT,
[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,1,1,1,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]]);

var contentPack = {tap:[]};
var initPack = {player:[], projectile:[], tap:[], cheese:[], map:{id:currentMap.id, width:currentMap.width, height:currentMap.height, grid:currentMap.grid}};
var removePack = {player:[], projectile:[], cheese:[]};

createItems = function() {
  for(var i = 50; i < 100 * 2; i += 80){
    for(var j = 50; j < 100 *2; j += 80) {
      if(!currentMap.isPositionWall(i, j))
        var cheese = Cheese(i + " " + j, i, j);
    }
  }
  //Tap(1, 1584, 448, "M");
  //Tap(2, 100, 100, "M");
}
createItems();
