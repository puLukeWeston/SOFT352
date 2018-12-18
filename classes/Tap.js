var entity = require('./Entity.js');
var projectile = require('./Projectile.js');

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
  return self;
}

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
