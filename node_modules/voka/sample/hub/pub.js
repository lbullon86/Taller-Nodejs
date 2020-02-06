var voka = require("../..");

voka.publisher(function(e, pub) {
  if(e) {
    console.log(e);
    process.exit(1);
  }
  
  setInterval(function() {
    var time = Date.now();
    console.log("pub %s says %s", pub.name, time);
    pub.publish("chat", {
      name: pub.name,
      time: time
    });
  }, 1000 * 2);
  
});