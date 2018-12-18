var entity = require('./Entity.js');
var projectile = require('./Projectile.js');

Tap = function(id) {
  var self = Entity();
  // Overwrite the default entity attributes
  self.id = id;
// Add Tap specific defaults
  self.recharging = false;
  self.running = false;

  var superUpdate = self.update;
  self.update = function() {
    self.checkSpraying();
    superUpdate();
  }

  self.checkSpraying = function() {
    if(self.running){
      var projectile = Projectile(Math.random()*180);
      projectile.x = self.x;
      projectile.y = self.y;
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
      running:tap.running
    });
  }
  return pack;
}
