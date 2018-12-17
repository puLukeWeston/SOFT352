var entity = require('./Entity.js');

Projectile = function(angle) {
  var self = Entity();
  self.id = Math.random();
  // Calculate X & Y speeds
  self.spdX = Math.cos(angle/180*Math.PI) * 10;
  self.spdY = Math.sin(angle/180*Math.PI) * 10;

  // Set up timer to remove the projectile after 10 frames
  self.timer = 0;
  self.toRemove = false;
  var superUpdate = self.update;
  self.update = function() {
    if(self.timer++ > 10)
      self.toRemove = true;
    superUpdate();
  }

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
