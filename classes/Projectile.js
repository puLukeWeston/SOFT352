var entity = require('./Entity.js');
var player = require('./Player.js');

Projectile = function(parent, angle, posX, posY) {
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

    var playerList = Player.getLocations();

    for(var i in playerList) {
      var p = playerList[i];

      if(self.getDistance(p) < 16 && self.parent !== p.assignment) {
         //TODO: sort out speed adjustments
         self.toRemove = true;
         console.log("Hit!");
      }
    }
  }
  if(self.toRemove)
    delete Projectile.list[self.id];
  else
    Projectile.list[self.id] = self;
  return self;
}

Projectile.update = function() {

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
