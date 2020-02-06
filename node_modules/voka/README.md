# Voka

Reliabe pub-sub broker, using Redis and Nodejs


## TL;DR

Create a subscriber

```
var voka = require("voka");
voka.subscriber(function(e, sub) {
  if(e) {
    return console.error(e);
  }
  sub.subscribe("channel1", function(data) {
    console.log(data);
  });
});
```

Create a publisher

```
var voka = require("voka");
voka.publisher(function(e, pub) {
  if(e) {
    return console.error(e);
  }
  setInterval(function() {
    pub.publish("channel1", Date.now());
  });
});
```

Create a hub that can send and recieve message

```
voka.hub(function(e, hub) {
  //publish
  hub.publish("foo", "bar");
  //subscribe
  hub.subscribe("foo", function(message) {
    //messages won't be sent to the hub itself
    //so no `bar` will get here
  });
});
```

## Redis

Tell `voka` how to connect to a Redis server:

```
voka.publisher({
  redis: {
    //redis host
    host: "localhost",
    //redis port
    port: 6379,
    //redis authpass
    authpass: "helloworld"
  }
}, function(e, pub) {
  //TODO
});
```

## Reliability

### Slow joiner

#### Delay to publish

```
voka.publisher({ delay: 5000 }, function() {
  //delay 5 seconds to run this callback
  //TODO
});
```

#### Wait for subscribers

```
voka.publisher({ least: 4 }, function(e, pub) {
  //wait for at least 4 subscribers before running this callback
  
  //There are some related events:
  pub.on("least:match", function(numberOfLivingSubscribers) {
    //the least amount of subscribers are connected
  });
  
  pub.on("least:unmatch", function(numberOfLivingSubscribers) {
    //one or more subscribers are disconnected and the number of subscribers doesn't match
  });
  
  
  pub.on("reject", function(channel, data) {
    //messages are rejected if the number of subscribers doesn't match
  });
  
});
```

### Heartbeat

Subscribers are required to send heartbeat to broadcast their existences.

A publisher can report the changes:

```
pub.on("report", function(data) {

  data.livingList; //names of the connected subscribers
  data.dropList; //names of disconnected subscribers since the last heartbeat

});
```

## Producer & consumer

* multiple `subscirber`s can be assigned with an identical name for load balance
* multiple `publisher`s can be assigned with an identical name for more horsepower

## Notes

1. `hiredis` doesn't compile in node v0.11.x, so pure javascript implementation is used if you are running `v0.11.x`
2. For back-compatibilities, traditional promise-based style is used

## License 

MIT