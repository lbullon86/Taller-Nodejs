var voka = require("../..");

voka.publisher({ least: 2 }, function(e, pub) {
  if(e) {
    console.log(e);
    process.exit();
  }
  var timer;
  var start = function() {
    console.log("start");
    timer = setInterval(function() {
      console.log("Process %s, publish time", process.pid);
      pub.publish("time", Date.now());
    }, 1000 * 1);
  };
  var stop = function() {
    console.log("stop");
    clearInterval(timer);
  };
  pub.on("least:match", start);
  pub.on("least:unmatch", stop);
  pub.on("reject", function() {
    console.log("reject to publish", arguments);
  });
  
  pub.on("error", function(e) {
    console.log(e);
  });
  
});