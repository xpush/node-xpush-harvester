'use strict';

var fs = require('fs');
var path = require('path');
var harvester = require('./xpush-harvester');
var influx = require('influx');

var VERSION = (function () {
    var data = fs.readFileSync(path.join(__dirname, '../package.json')).toString();
    return JSON.parse(data).version;
})();

var welcome = function () {

    return [
        "",
        "                         _     ",
        "  HARVESTER             | |    ",
        "   __  ___ __  _   _ ___| |__  ",
        "   \\ \\/ / '_ \\| | | / __| '_ \\ ",
        "    >  <| |_) | |_| \\__ \\ | | |",
        "   /_/\\_\\ .__/ \\__,_|___/_| |_|",
        "        | |                    ",
        "        |_|         V " + VERSION,
        ""
    ].join('\n');
};

function createHarvester(options) {


    var serverInflux = influx({
            host: config.influxdb.host,
            port: config.influxdb.port
        }
    );

    function startApp() {

        harvester.start(config, cb);

    }

    if (config.influxdb.dropandrun) {
        console.log("Drop Database");
        serverInflux.deleteDatabase(config.influxdb.database, function (err, result) {
            createDatabaseAndUser();
        });
    } else {
        createDatabaseAndUser();
    }

    function createDatabaseAndUser() {
        serverInflux.getDatabaseNames(function (err, dbs) {
            if (err) throw err;
            if (dbs.indexOf(config.influxdb.database) === -1) {
                console.log('Creating Database');
                serverInflux.createDatabase(config.influxdb.database, function (err) {
                    if (err) throw err;
                    console.log('Creating User');
                    serverInflux.createUser(config.influxdb.database, config.influxdb.username, config.influxdb.password, function (err) {
                        if (err) throw err;
                        startApp();
                    });
                });
            } else {
                startApp();
            }
        });
    }

    return (server);
}

module.exports.createHarvester = createHarvester;
