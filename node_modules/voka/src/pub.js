var reids = require("redis"),
    debug = require("debug")("pub"),
    assert = require("assert"),
    Q = require("q"),
    util = require("util"),
    Client = require("./client");

var Publisher = function(options, callback) {
  if(!(this instanceof Publisher)) {
    return new Publisher(options, callback);
  }
  debug("construct");
  if(typeof options === "function") {
    callback = options;
    options = {};
  }
  options = options || {};
  options.type = "publisher";
  Client.call(this, options);
  
  
  //blacklist
  this.blacklist = options.blacklist || [];
  //wait for x seconds before publishing
  this.delay = options.delay;
  //wait for at least x subscribers
  this.least = options.least;
  // should reject to publish
  this.shouldReject = !!(this.delay || this.least);
  //auto connect
  this.bootstrap(callback);
  //content serializer
  this.serializer = options.serializer || JSON.stringify;
};

util.inherits(Publisher, Client);

Publisher.prototype.bootstrap = function (callback) {
  debug("bootstrap");
  var self = this;
  this.connect().then(function() {
    process.on("SIGINT", function() {
      self.teardown();
      process.exit();
    });
    process.on("SIGTERM", function() {
      self.teardown();
      process.exit();
    });
    //wait for `self.timeout` seconds to ensure all subscribers at least have sent one heartbeat
    return Q.delay(self.timeout * 1000).then(self.checkSubscribers()).then(function(data) {
      self.loopCheck();
      return self.wait();
    });
  }).catch(function(e) {
    self.emit("error", e);
    if(callback) { callback(e); }
  }).done(function() {
    self.emit("ready");
    if(callback) { callback(null, self); }
  });
};

Publisher.prototype.wait = function() {
  if(this.delay) {
    debug("delay %sms before publish", this.delay);
    return Q.delay(this.delay);
  }
  var timer, self = this, deferred = Q.defer(), handler;
  if(this.least) {
    debug("wait for %s subscribers before publish", self.least);
    handler = function(data) {
      if(data.type === "subscriber" && data.livingList.length >= self.least) {
        self.removeListener("report", handler);
        deferred.resolve();
      }
    };
    this.on("report", handler);
    return deferred.promise;
  }
  return Q.fulfill();
};

Publisher.prototype.incrementMessageID = function (channel) {
  var counterKey = this.key(channel, "nextID");
  debug("incr next id at %s", counterKey);
  return Q.ninvoke(this.client, "incr", counterKey);
};

Publisher.prototype.checkSubscribers = function () {
  return this.liveCheck("subscriber");
};

Publisher.prototype.loopCheck = function () {
  var self = this;
  this.checkSubscribers().fin(function() {
    setTimeout(self.loopCheck.bind(self), self.timeout * 1000);
  }).done(function(data) {
    debug("timeout: %o; living %o", data.dropList, data.livingList);
    if(self.least) {
      if(data.livingList.length < self.least) {
        if(!self.shouldReject) {
          self.shouldReject = true;
          self.emit("least:unmatch", data.livingList.length);
        }
      } else {
        if(self.shouldReject) {
          self.shouldReject = false;
          self.emit("least:match", data.livingList.length);
        }
      }
    }
  });
};

Publisher.prototype.getSubscribers = function () {
  var key = this.keyForSubscribers();
  debug("get subscribers from %s", key);
  return Q.ninvoke(this.client, "smembers", key);
};

Publisher.prototype.saveMessage = function (id, subscribers, channel, message) {
  var deferred = Q.defer(), i, len, multi, messageKey, listKey, counterKey;
  debug("save message to %d subscriber(s): %o", subscribers.length, subscribers);
  multi = this.client.multi();
  for(i=0,len=subscribers.length; i<len; i++) {
    //scoped by subscriber's name
    messageKey = this.keyForMessage(subscribers[i], id);
    //scoped by subscirber's name and channel name
    listKey = this.keyForQueue(subscribers[i], channel);
    //save message to subscirber's queue
    debug("save message %s to %s, with id %s", messageKey, listKey, id);
    //push message id to channel queue in the subscriber's scope
    multi.rpush(listKey, id);
    try {
      message = this.serializer(message);
    } catch(e) {}
    multi.set(messageKey, message);
  }
  multi.exec(deferred.makeNodeResolver());
  return deferred.promise;
};

Publisher.prototype.teardown = function(callback) {
  debug("teardown");
  this.disconnect(callback);
};

Publisher.prototype.publish = function (channel, message) {
  if(this.shouldReject) {
    this.emit("reject", channel, message);
    return Q.reject();
  }
  var self = this;
  assert(channel, "should provide a publish channel");
  debug("publish to %s", channel);
  
  return self.getSubscribers().then(function(subscribers) {
    if(self.blacklist.length) {
      debug("handle blacklist %o", self.blacklist);
      subscribers = subscribers.filter(function(s) {
        return self.blacklist.indexOf(s) === -1;
      });
    }
    if(subscribers.length) {
      return self.incrementMessageID(channel).then(function(id) {
        return self.saveMessage(id, subscribers, channel, message);
      });
    } {
      return Q.fulfill();
    }
  });
};

module.exports = Publisher;