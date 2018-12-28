var maps = require('./Map.js');

var currentMap = Maps("blueprints");
var initPack = {player:[], projectile:[], tap:[], cheese:[], map:{id:currentMap.id, width:currentMap.width, height:currentMap.height, grid:currentMap.grid}};
var removePack = {player:[], projectile:[], cheese:[]};

Entity = function() {
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

  self.getDistance = function(pt) {
    return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2));
  }

  return self;
}

Entity.getFrameUpdateData = function() {

  var pack = {
    initPack:{
      player:initPack.player,
      projectile:initPack.projectile,
      tap:initPack.tap,
      cheese:initPack.cheese,
      map:initPack.map
    },
    removePack:{
      player:removePack.player,
      projectile:removePack.projectile,
      cheese:removePack.cheese
    },
    updatePack:{
      player:Player.update(),
      projectile:Projectile.update(),
      tap:Tap.update(),
      cheese:Cheese.update()
    }
  }

  initPack.player = [];
  initPack.projectile = [];
  initPack.tap = [];
  initPack.cheese = [];
  removePack.player = [];
  removePack.projectile = [];
  removePack.cheese = [];

  return pack;
}

// Create a new Player object
Player = function(socket, id, assignment) {
  var self = Entity();
  // Overwrite the default entity attributes
  if(assignment === "C") {
    self.x = 480;
    self.y = 580;
  } else if(assignment === "M") {
    self.x = 1125;
    self.y = 965;
  }
  self.socket = socket;
  self.id = id;
  // Add Player specific defaults
  self.assignment = assignment;
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.spd = 16;
  self.maxSpd = 16;
  self.score = 0;
  self.lives = 3;
  self.cooldown = false;

  // Overwrite the super update function
  var superUpdate = self.update;
  self.update = function() {
    self.updateSpd();
    if(!currentMap.isPositionWall(self.x + self.spdX, self.y + self.spdY)) {
      superUpdate();
    }

    for(i in Player.list) {
      var p = Player.list[i];
      // If the Cat touches the Mouse
      if(p.assignment === "M") {
        if(self.getDistance(p) < TILE_SIZE / 2 && self.assignment === "C" && !self.cooldown) {
          p.lives--;
          if(p.lives == 0) {
            self.score++;
            p.socket.emit('died', {score:p.score})
            removePack.player.push({id:p.id, score:p.score});
            delete Player.list[i];
          } else {
            self.x = 480;
            self.y = 580;
            self.cooldown = true;
            setTimeout(function() {
              self.cooldown = false;
            }, 5000);

          }
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

Player.onConnect = function(socket, id, assignment) {
  // Create the client a new Player object based on the socket id
  var player = Player(socket, id, assignment);

  // Then add a listener for keypresses to update the position
  socket.on('keyPress', function(data) {
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

Player.onDisconnect = function(id) {
  delete Player.list[id];
  removePack.player.push({id:id});

}

Player.listSize = function() {
    var size = 1;
    for (var i in Player.list){
      size++;
    }
    return size;
};

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

Projectile = function(parent, angle, xPos, yPos) {
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

    if(!currentMap.isPositionWall(self.x + self.spdX, self.y + self.spdY)) {
      superUpdate();
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

Tap = function(id, owner, xPos, yPos) {
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
      running:self.running,
      recharging:self.recharging,
      owner:self.owner
    };
  }

  Tap.list[id] = self;
  initPack.tap.push(self.getInitPack());
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

Cheese = function(id, x, y) {
  var self = Entity();
  self.id = id;
  self.x = x;
  self.y = y;
  self.consumed = false;

  self.update = function() {

    for(i in Player.list) {
      var p = Player.list[i];
      // If the cheese is in contact with a Mouse
      if(self.getDistance(p) < TILE_SIZE/2 && p.assignment === "M") {
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

Cheese.listSize = function() {
    var size = 0;
    for (var i in Cheese.list){
      size++;
    }
    return size;
};
