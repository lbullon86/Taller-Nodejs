var debug = require("debug")("client"),
    // domain = require("domain"),
    Q = require("q"),
    short = require("shortid"),
    redis = require("redis"),
    util = require("util"),
    EE = require("events").EventEmitter,
    _ = require("lodash");

var Client = function(options) {
  EE.call(this);
  
  this.name = options.name || short.generate();
  this.type = options.type || "client";
  this.namespace = (options.namespace || "voka").split(".");
  this.redisOpts = options.redis || {};
  //IMPORTANT: timeout in seconds
  this.timeout = (options.timeout / 1000) || 2;
  this.heartbeatInterval = options.heartbeatInterval || 500;
  this._error = this.emitError.bind(this);
  this.heartbeatClient = options.heartbeatClient;
  this.client = options.client;
};

util.inherits(Client, EE);

Client.prototype.connect = function () {
  debug("connect");
  var self = this;
  
  return Q.all([
    this.client ? Q.fulfill(this.client) : this.createClient(this.redisOpts),
    this.heartbeatClient ? Q.fulfill(this.heartbeatClient) : this.createClient(this.redisOpts)
  ]).then(function(clients) {
    self.client = clients[0];
    self.heartbeatClient = clients[1];
    self.heartbeat();
  });
};

Client.prototype.createClient = function (options) {
  var deferred = Q.defer(), client, self = this;
 client = redis.createClient(options.port || 6379, options.host || "localhost", {
    "auth_pass": options.authpass
  });
  client.once("connect", function() {
    self.emit("connect");
    deferred.resolve(client);
  });
  client.once("error", function(e) {
    deferred.reject(e);
  });
  client.on("error", this._error);
  return deferred.promise;
};

Client.prototype.disconnect = function (callback) {
  this.removeAllListeners();
  this.client.quit();
  this.heartbeatClient.quit();
  if(callback) { callback(); }
};

Client.prototype.key = function() {
  return this.namespace.concat(Array.prototype.slice.call(arguments)).join(".");
};

Client.prototype.keyForSubscribers = function() {
  return this.keyForTypeSet("subscriber");
};

Client.prototype.keyForTypeSet = function (type) {
  return this.key(type);
};

Client.prototype.keyForDroplist = function (type) {
  return this.key("droplist", type);
};

Client.prototype.channel = function (name) {
  return "channel:" + name;
};

Client.prototype.keyForMessage = function (subscriber, id) {
  return this.key(subscriber, "messages", id);
};

Client.prototype.keyForQueue = function (subscriber, channel) {
  return this.key(subscriber, channel);
};

Client.prototype.keyForHeartbeat = function (type, name) {
  return this.key("heartbeat", type || this.type, name || this.name);
};

Client.prototype.emitError = function (e) {
  this.emit("error", e);
};

Client.prototype.heartbeat = function () {
  var i,len, multi, key, deferred, self = this;
  deferred = Q.defer();
  multi = this.heartbeatClient.multi();
  key = this.keyForHeartbeat();
  // debug("heartbeat %s", key);
  multi.set(key, Date.now());
  multi.expire(key, this.timeout);
  multi.exec(function(e) {
    setTimeout(self.heartbeat.bind(self), self.heartbeatInterval);
    if(e) {
      self._error(e);
      return deferred.reject(e);
    }
    deferred.resolve();
  });
  return deferred.promise;
};

Client.prototype.liveCheck = function (type) {
  debug("livecheck for %s", type);
  var key = this.keyForHeartbeat(type, "*"),
      multi = this.heartbeatClient.multi(),
      self = this,
      setKey = this.keyForTypeSet(type),
      deferred = Q.defer();
      
  multi.keys(key);
  multi.smembers(setKey);
  multi.exec(function(e, replies) {
    if(e) {
      return deferred.reject(e);
    }
    var keys = replies[0],
        members = replies[1],
        dropList, liveList,
        args = [setKey],
        data;

    liveList = keys.map(function(k) {
      return k.split(".").pop();
    });
    dropList = _.xor(liveList, members);
    data = {
      type: type,
      dropList: dropList,
      livingList: liveList
    };
    self.emit("report", data);
    if(dropList.length) {
      debug("found timeouts %o", dropList);
      self.evict(type, dropList).then(function() {
        deferred.resolve(data);
      }, function(e) {
        deferred.reject(e);
      });
    } else {
      deferred.resolve(data);
    }
  });
  return deferred.promise;
};

Client.prototype.evict = function (type, list) {
  var deferred = Q.defer(),
      self = this,
      multi = this.heartbeatClient.multi();

  multi.sadd.apply(multi, [this.keyForDroplist(type)].concat(list));
  multi.srem.apply(multi, [this.keyForTypeSet(type)].concat(list));
  multi.exec(deferred.makeNodeResolver());
  return deferred.promise;
};

module.exports = Client;