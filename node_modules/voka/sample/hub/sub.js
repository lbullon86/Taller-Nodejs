var voka = require("../..");

voka.subscriber(function(e, sub) {
  if(e) {
    console.log(e);
    process.exit(1);
  }
  
  sub.subscribe("chat", function(message) {
    console.log("sub %s receieves %s ",sub.name, JSON.stringify(message));
  });
  
});