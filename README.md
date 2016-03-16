# node-xpush-harvester

=====

This is monitoring module for xpush.

This module will store xpush usage data into InfluxDB.

## 1. Prepare

### InfluxDB

Install and run InfluxDB with reference [InfluxDB Installation](https://influxdata.com/downloads/)

The follow is the code to install and run InfluxDB 0.10.3-1 (in linux)

    wget https://s3.amazonaws.com/influxdb/influxdb-0.10.3-1_linux_amd64.tar.gz
    tar xvfz influxdb-0.10.3-1_linux_amd64.tar.gz

## 2.  Installation

    git clone https://github.com/xpush/node-xpush-harvester.git
    npm install

## 3. Create config file of xpush-chat

#### config.json

    {
      "zookeeper": {"address":"localhost:2181"},
      "influxdb":{
      "host": "localhost",
      "port": 8086,
      "username": "username",
      "password": "password",
      "database": "xpush",
      "dropandrun": true
    }
}

## 4. Run your application with xpush module
                
    ./xpush-harvester --config /home/stalk/config/config.json

