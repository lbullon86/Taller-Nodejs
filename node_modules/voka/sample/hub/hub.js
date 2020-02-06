var voka = require("../..");

voka.hub(function(e, hub) {
  if(e) {
    console.log(e);
    process.exit(1);
  }
  
  setInterval(function() {
    hub.publish("chat", {
      name: hub.name,
      time: Date.now(),
      hub: true
    });
  }, 1000 * 2);
  

  hub.subscribe("chat", function(message) {
    console.log("hub %s receives %s", hub.name, require("util").inspect(message));
  });
});