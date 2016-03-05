var zookeeper = require('node-zookeeper-client'),
    influx = require('influx'),
    io = require('socket.io-client'),
    constants = require('./constants');

var Promise = require('bluebird');
var extend = require('util')._extend;

var harvester = function () {

    this.servers = [];
    this.ios = {};
    this.infos = {};
    this.summary = {};
    this.serverIds = {};
};

harvester.prototype.start = function (config, cb) {

    this.dbInflux = influx({
        host: config.influxdb.host,
        port: config.influxdb.port,
        username: config.influxdb.username,
        password: config.influxdb.password,
        database: config.influxdb.database
    });

    var address = config.zookeeper.address || 'localhost:2181';

    this.zkClient = zookeeper.createClient(address);
    this.zkClient.connect();

    this.watchingNodes(config);

    if (cb) {
        cb(null, {
            host: config.influxdb.host,
            port: config.influxdb.port
        });
    }

};

harvester.prototype.watchingNodes = function (config) {

    var self = this;

    this.zkClient.getChildren(constants.BASE_ZNODE_PATH + constants.SERVERS_PATH, function (event) {
        self.watchingNodes(config);
    }, function (error, nodes, stats) { // > watching callback START

        if (error) {
            console.error('Error watching zookeeper nodes: ', error);
            process.exit(1);
        }
        
        self.servers = [];

        var max = nodes.length;
        var connectSocket = function (ninfo){
          return new Promise(function (resolve, reject) {

            var query = '1=1';
            if(config.token) query = 'token='+config.token;

            self.ios[ninfo[1]] = io.connect(
              'https://'+ninfo[1]+'/admin?'+query,
              { transsessionPorts: ['websocket'] ,'force new connection': true }
            );

            console.log('https://'+ninfo[1]+'/admin?'+query);

            self.ios[ninfo[1]].on( 'connect', function (){
              console.log( 'connected : ' + ninfo[1] );
              var id = ninfo[0];
              self.servers.push({
                id  : ninfo[0],
                url : ninfo[1]
              });

              self.serverIds[id] = id;

              return resolve(ninfo);
            });

            self.ios[ninfo[1]].on( 'connect_error', function (){
              return reject({'status':'error'});
            });
          });
        };

        var resultCallback = function( arr ){
          return new Promise((resolve, reject) => {
            self.collect(config);
            resolve({'status':'ok'});
          });
        };

        var funcArr = [];
        for( var inx = 0 ; inx < max ; inx++ ){
          var ninfo = extend({}, nodes[inx].split('^'));
          funcArr.push( connectSocket( ninfo ) );
        }

        Promise.all(funcArr)
          .then(resultCallback)
          .then(result => console.log(result));


    }); // < watching callback END

};

harvester.prototype.collect = function (config) {

    var self = this;

    var interval = 5000 || config.interval;

    setInterval(function () {

        var _temp = new Date().getTime();
        for (var key in self.summary) {
            // if (self.summary.hasOwnProperty(key))
            if (_temp - Number(self.summary[key].t) > 10000) {
                delete self.summary[key];
            }
        }

        var arrayLength = self.servers.length;

        for (var i = 0; i < arrayLength; i++) {

            if (self.ios[self.servers[i].url]) {

                //console.log(' ------- '+self.servers[i].url);

                self.ios[self.servers[i].url].emit('usage', function (data) {

                    self.summary[data.name] = {
                        t: new Date().getTime(),
                        s: Number(data.client.socket),  // socket
                        c: Number(data.client.channel)  // channel
                    };

                    var tname = 'xpush.channel.' + data.name;
                    //console.log(' >>> ',tname, data);

                    self.dbInflux.writePoint(tname, {
                        time: new Date(),  // reserved key for influxDB
                        host: data.host,
                        server: data.name,
                        uptime: data.uptime,
                        memory_rss: data.memory.rss,        // Resident set size
                        memory_total: data.memory.heapTotal,  // Heap size sampled immediately after a full garbage collection
                        memory_used: data.memory.heapUsed,   // Current heap size
                        memory_usage: data.memory.heapUsed / data.memory.rss * 100,   // Current memory rate per RSS
                        client_socket: data.client.socket,
                        client_channel: data.client.channel,
                        client_bigchannel: data.client.bigchannel
                    }, null, function (err) {
                        if (err) throw err;
                    });

                });
            }

        }

    }, interval);

    setInterval(function () {

        var _data = {
            time: new Date(),
            socket: 0,
            channel: 0
        };

        for (var key in self.summary) {
            _data.socket = _data.socket + self.summary[key].s;
            _data.channel = _data.channel + self.summary[key].c;
        }
        //console.log(_data);
        self.dbInflux.writePoint('xpush.summary', _data, null, function (err) {
            if (err) throw err;
        });

    }, interval);
};

module.exports = new harvester();
