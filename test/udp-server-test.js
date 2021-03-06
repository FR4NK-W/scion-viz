/*
 * Copyright 2016 ETH Zurich
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 *  Node.js UDP echo server
 *
 *  This demonstration shows a basic echo server that has randomly drops responses.
 *  The drop factor is `threshold` 0.99 = 99% chance of success, 1% dropped packets
 * 
 *  Additionally each response is delayed by 1/2 seconds.
 * 
 *  Pass in a desired address and port as cmdline argument.
 */

// UDP request commands
var ReqCmds = {
    GET_URL_STATS : 'LOOKUP',
    GET_URLS : 'LIST',
    GET_TOPOLOGY : 'TOPO',
    GET_LOCATIONS : 'LOCATIONS',
    SET_ISD_WHITELIST : 'ISD_WHITELIST',
    GET_ISD_WHITELIST : 'GET_ISD_WHITELIST',
    GET_ISD_ENDPOINTS : 'GET_ISD_ENDPOINTS',
    CLEAR_URLS : 'CLEAR',
};

var dgram = require('dgram');
var server = dgram.createSocket('udp4');

var DEF_TOPOLOGY = "d";
var DEF_THRESHOLD = 0.99;
var DEF_ADDR = '127.0.0.1';
var DEF_PORT = 7777;

if (process.argv.length <= 5) {
    console.log("Usage: " + __filename
            + " address port d|w|t[topology] 0-1[drop rate<float>]");
    process.exit(-1);
}

var args = process.argv.slice(2);
var address = (args.length > 0) ? args[0] : DEF_ADDR;
var port = (args.length > 1) ? parseInt(args[1]) : DEF_PORT;
var test = (args.length > 2) ? args[2] : DEF_TOPOLOGY;
var threshold = (args.length > 3) ? parseFloat(args[3]) : DEF_THRESHOLD;
console.log('Param: ' + address + ' ' + port + ' ' + test + ' ' + threshold);

server.on("listening", function() {
    var address = server.address();
    console.log("Listening on " + address.address);
});

server.on("message", function(message, rinfo) {
    var delay = 500 + Math.random() * 1000;
    // Echo the message back to the client.
    var dropped = Math.random();
    if (dropped > threshold) {
        console.log("Received message from: " + rinfo.address + ", DROPPED");
        return;
    }
    console.log("Received message from: " + rinfo.address + "," + message + ","
            + message.length);
    var jLen = message.readUInt32BE(0);
    var jData = message.toString("utf-8", 4);

    // check length
    if (jLen != jData.length) {
        console.error("Lengths not equal, discarding: " + jLen + ","
                + jData.length);
        return;
    }

    // parse the json
    var rc = JSON.parse(jData);
    var jData = '';
    var dataRoot = __dirname + '/data/';

    // add dummy parameters before echoing back
    if (rc.command == ReqCmds.GET_URL_STATS) {
        switch (getRandomInt(0, 2)) {
        default:
        case 0:
            jData = loadTestData(dataRoot + 'lookup-' + test + '.json');
            break;
        case 1:
            jData = loadTestData(dataRoot + 'lookup-' + test + '-isd1.json');
            break;
        }
    } else if (rc.command == ReqCmds.GET_URLS) {
        var reqs = JSON.parse(loadTestData(dataRoot + 'list.json'));
        var lu = [];
        lu.push(reqs[getRandomInt(0, 15)]);
        lu.push(reqs[getRandomInt(0, 15)]);
        lu.push(reqs[getRandomInt(0, 15)]);
        jData = JSON.stringify(lu);
    } else if (rc.command == ReqCmds.SET_ISD_WHITELIST) {
        jData = loadTestData(dataRoot + 'isd_whitelist.json');
    } else if (rc.command == ReqCmds.GET_ISD_WHITELIST) {
        jData = loadTestData(dataRoot + 'get_isd_whitelist-' + test + '.json');
    } else if (rc.command == ReqCmds.GET_ISD_ENDPOINTS) {
        jData = loadTestData(dataRoot + 'get_isd_endpoints-' + test + '.json');
    } else if (rc.command == ReqCmds.GET_TOPOLOGY) {
        jData = loadTestData(dataRoot + 'topo-' + test + '.json');
    } else if (rc.command == ReqCmds.GET_LOCATIONS) {
        jData = loadTestData(dataRoot + 'locations-' + test + '.json');
    } else if (rc.command == ReqCmds.CLEAR_URLS) {
        jData = loadTestData(dataRoot + 'list_clear.json');
    }

    var buf = new Buffer(4);
    buf.writeUInt32BE(jData.length, 0);

    var resp = Buffer.concat([ buf, new Buffer(jData) ]);

    setTimeout(function() {
        server.send(resp, 0, resp.length, rinfo.port, rinfo.address, function(
                err, bytes) {
            console.log(err, bytes);
        });
    }, delay);
});

server.on("error", function(err) {
    console.error('server error:\n${err.stack}');
    server.close();
});

server.on("close", function() {
    console.log("Socket closed");
});

server.bind({
    address : address,
    port : port,
    exclusive : false,
});

function createRandomLookup() {
    var u = {};
    var paths = getRandomInt(5, 10);
    u.sent_packets = getRandomIntArray(0, 100, paths);
    u.received_packets = getRandomIntArray(0, 100, paths);
    u.acked_packets = getRandomIntArray(0, 100, paths);
    u.rtts = getRandomIntArray(10000, 99999, paths);
    u.loss_rates = getRandomDoubleArray(paths);
    u.if_lists = [];
    u.if_counts = [];
    for (c = 0; c < paths; c++) {
        u.if_counts.push(getRandomInt(10, 16));
        var col = [];
        for (r = 0; r < u.if_counts[c]; r++) {
            var n = {};
            n.IFID = getRandomInt(1, 5);
            n.ISD = getRandomInt(1, 2);
            n.AS = getRandomInt(10, 25);
            col.push(n);
        }
        u.if_lists.push(col);
    }
    return JSON.stringify(u);
}

function loadTestData(filePath) {
    var fs = require("fs");
    var data = fs.readFileSync(filePath);
    return data.toString();
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function getRandomIntArray(min, max, total) {
    var arr = [ total ];
    for (var i = 0; i < total; i++) {
        arr[i] = getRandomInt(max, min);
    }
    return arr;
}

function getRandomDoubleArray(total) {
    var arr = [ total ];
    for (var i = 0; i < total; i++) {
        arr[i] = Math.random();
    }
    return arr;
}
