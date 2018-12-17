var entity = require('./Entity.js');

Player = function(id, assignment) {
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
