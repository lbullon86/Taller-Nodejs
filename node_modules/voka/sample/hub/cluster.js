var cluster = require("cluster");


if(cluster.isMaster) {
  var numberOfSub = 4, numberOfHub = 2, numberOfPub = 2;
  
  while(numberOfSub--) {
    cluster.fork({
      TYPE: "sub",
      DEBUG: process.env.DEBUG
    });
  }
  while(numberOfHub--) {
    cluster.fork({
      TYPE: "hub",
      DEBUG: process.env.DEBUG
    });
  }
  while(numberOfPub--) {
    cluster.fork({
      TYPE: "pub",
      DEBUG: process.env.DEBUG
    });
  }
} else {
  var type = process.env.TYPE;
  if(type) {
    require("./" + type);
  }
}