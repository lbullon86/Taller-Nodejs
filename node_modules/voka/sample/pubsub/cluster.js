var fs = require('fs');

var cluster = require("cluster");

var numsub = 2, i;

if(cluster.isMaster) {
  // agent.metrics.startCpuProfiling();
  // setTimeout(function() {
  //   var data = agent.metrics.stopCpuProfiling();
  //   fs.writeFileSync("./profile.cpuprofile", data);
  //   process.exit();
  // }, 1000 * 10);
  for(i=0; i<numsub; i++) {
    cluster.fork({
      DEBUG: process.env.DEBUG
    });
  }
  require("./pub");
  
  cluster.on("online", function(worker) {
    console.log("worker is online, pid %s", worker.process.pid);
  });
} else {
  require("./sub");
}