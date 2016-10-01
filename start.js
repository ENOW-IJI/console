const http = require('http');
const express = require('express');
const mongo = require('mongodb');
const fs = require('fs');
const ascoltatori_kafka = require('ascoltatori')
var assert = require('assert')
const bodyparser = require('body-parser');
var ascoltatori_mqtt = require('ascoltatori');
var mqtt = require('mqtt');
const BSON = require('bson').BSONPure;
var path = require('path');
var MongoClient = mongo.MongoClient;
var Server = mongo.Server;
var expressapp = express();
var mongoUrl;
var mongoPort;
var kafkaUrl;
var kafkaPort;
var roadmapNum;
var timeoutLimit,
    roadMapIdTemp,
    db,
    latestOffset,
    mqttHost,
    mqttPort;
var MyDate = new Date();
var MyDateString;
var consumer;
var trafficArray= new Array(1000);

var errorArray= new Array(1000);
errorArray.fill(0);
trafficArray.fill(0);
var trafficPin = 0;
// trafficArray.fill(0);
var kafka = require('kafka-node'),
Producer = kafka.Producer,
Consumer = kafka.Consumer,
client = new kafka.Client(),
producer = new Producer(client),
payloads = [
    {
        // topic:'event',
        messages: '',
        partition: 0
    }
],
offset = new kafka.Offset(client);

var settings_kafka = {
  type: 'kafka',
  json: false,
  kafka: require('kafka-node'),
  connectString: "127.0.0.1:2181",
  clientId: "ascoltatori",
  groupId: "ascoltatori",
  defaultEncoding: "utf8",
  encodings: {
    image: "buffer"
  }
};

var brokerList = new Array()
var functions = new Array()

var findbrokers = function(db, callback) {
   var cursor =db.collection('brokerList').find( );
   cursor.each(function(err, doc) {
      assert.equal(err, null);
      if (doc != null) {
         makeFunction(doc.brokerId,doc.ipAddress,doc.port)
         console.log("made connection to brokerId : " + doc.brokerId + " ipAddress : " + doc.ipAddress + " port : "  + doc.port);
      } else {
         callback();
      }
   });
};

MongoClient.connect('mongodb://localhost:27017/connectionData', function(err, db) {
  assert.equal(null, err);
  findbrokers(db, function() {
      db.close();
  });
});

ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
  ascoltatori_kafka.subscribe('brokerAdd', function(topic, message) {
    console.log("added broker : " + message);

    var jsonMessage = JSON.parse(message);

    var brokerId = jsonMessage.brokerId
    var ipAddress = jsonMessage.ipAddress
    var port = jsonMessage.port

    makeFunction(brokerId,ipAddress,port)
  });
});

ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
  ascoltatori_kafka.subscribe('brokerSub', function(topic, message) {
    for(i = 0 ; i<brokerList.length ; i++){
      if(message == brokerList[i].brokerId){
        console.log("delete" + message);
        console.log("deleting broker is not succeed")
        brokerList.splice(i,1);
        functions.splice(i,1);
      }
    }
  });
});


ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
  ascoltatori_kafka.subscribe("feed", function(topic, message) {
    var jsonMessage = JSON.parse(message);

    var topicName = jsonMessage.topic
    var payload = jsonMessage.payload
    var callback = payload.callback


    var arr = topicName.split("/");
    var brokerId = arr[2];

    for(i = 0 ; i<brokerList.length ; i++){
      if(brokerId == brokerList[i].brokerId){
        brokerList[i].broker.publish(topicName + "/feed",JSON.stringify(callback))
        console.log("messaging to a message " + JSON.stringify(callback)+" to topic name : " + topicName + "/feed succeed");
      }
    }
  });
});

ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
  ascoltatori_kafka.subscribe('sslAdd', function(topic, message) {
    addSSLFunction(message)

    console.log("adding ssl option to topic : " + topic + " succeed");
  });
});

ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
  ascoltatori_kafka.subscribe('sslSub', function(topic, message) {
    subSSLFunction(message)

    console.log("subtracting ssl option to topic : " + topic + " succeed");
  });
});

function makeFunction(brokerId,ipAddress,port){
  functions.push(function(){
    var brokerSetting = "mqtt://"+ ipAddress+":"+port
    var brokerStatus = mqtt.connect(brokerSetting)
    var brokerOrder = mqtt.connect(brokerSetting)

    brokerList.push({"brokerId":brokerId,"brokerStatus":brokerStatus,"brokerOrder":brokerOrder,"brokerSetting":brokerSetting})

    brokerStatus.subscribe("enow/server0/"+brokerId+"/+/status");
    brokerStatus.on('message', function (topic, message) {
      console.log("succeed subscribing to mqtt topic " + topic);

      ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
        ascoltatori_kafka.publish("status", message, function() {
          console.log("succeed publishing to kafka topic status");
        });
      });
    });

    brokerOrder.subscribe("enow/server0/"+brokerId+"/+/order");
    brokerOrder.on('message', function (topic, message) {
      console.log("succeed subscribing to mqtt topic " + topic);

      ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
        ascoltatori_kafka.publish("order", message, function() {
          console.log("succeed publishing to kafka topic order");
        });
      });
    });


  })

  functions[functions.length-1]()
}

function addSSLFunction(brokerId){
  var index
  for(i = 0 ; i<brokerList.length ; i++){
    if(brokerId == brokerList[i].brokerId){
      var options = {
        key: fs.readFileSync('/Users/leegunjoon/Documents/downloadSpace/tools/TLS/iui-MacBook-Air.local.key'),
        cert: fs.readFileSync('/Users/leegunjoon/Documents/downloadSpace/tools/TLS/iui-MacBook-Air.local.crt'),
        rejectUnauthorized: true,
        // The CA list will be used to determine if server is authorized
        ca: fs.readFileSync('/Users/leegunjoon/Documents/downloadSpace/tools/TLS/ca.crt')
      }

      var brokerStatusSSL = mqtt.connect(brokerList[i].brokerSetting,options)
      var brokerOrderSSL = mqtt.connect(brokerList[i].brokerSetting,options)

      brokerList[i] = {"brokerId":brokerId,"brokerStatusSSL":brokerStatusSSL,"brokerOrderSSL":brokerOrderSSL,"brokerSetting":brokerList[i].brokerSetting,"options":options}

      functions[i] = function(){

        brokerStatusSSL.subscribe("enow/server0/"+brokerId+"/+/status");
        brokerStatusSSL.on('message', function (topic, message) {
          console.log("succeed subscribing to mqtt topic " + topic);

          ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
            ascoltatori_kafka.publish("status", message, function() {
              console.log("succeed publishing to kafka topic status");
            });
          });
        });

        brokerOrderSSL.subscribe("enow/server0/"+brokerId+"/+/order");
        brokerOrderSSL.on('message', function (topic, message) {
          console.log("succeed subscribing to mqtt topic " + topic);

          ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
            ascoltatori_kafka.publish("order", message, function() {
              console.log("succeed publishing to kafka topic order");
            });
          });
        });

      }

      index = i;
    }
  }


  functions[index]()
}

function subSSLFunction(brokerId){
  var index
  for(i = 0 ; i<brokerList.length ; i++){
    if(brokerId == brokerList[i].brokerId){
      var brokerStatus = mqtt.connect(brokerList[i].brokerSetting)
      var brokerOrder = mqtt.connect(brokerList[i].brokerSetting)

      brokerList[i] = {"brokerId":brokerId,"brokerStatus":brokerStatus,"brokerOrder":brokerOrder,"brokerSetting":brokerList[i].brokerSetting}

      functions[i] = function(){

        brokerStatus.subscribe("enow/server0/"+brokerId+"/+/status");
        brokerStatus.on('message', function (topic, message) {
          console.log("succeed subscribing to mqtt topic " + topic);

          ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
            ascoltatori_kafka.publish("status", message, function() {
              console.log("succeed publishing to kafka topic status");
            });
          });
        });

        brokerOrder.subscribe("enow/server0/"+brokerId+"/+/order");
        brokerOrder.on('message', function (topic, message) {
          console.log("succeed subscribing to mqtt topic " + topic);

          ascoltatori_kafka.build(settings_kafka, function (err, ascoltatori_kafka){
            ascoltatori_kafka.publish("order", message, function() {
              console.log("succeed publishing to kafka topic order");
            });
          });
        });
      }

      index = i;
    }
  }

  functions[index]()
}

//make server starts from latest logs
offset.fetchLatestOffsets(['log'], function (error, offsets) {
    if (error)
    return handleError(error);
    console.log('start from...\n\tkafka topic: log\n\toffset : '+offsets['log'][0]);
    latestOffset = offsets['log'][0];
    consumer = new Consumer(
        client,
        [
            {
                topic: 'log',
                partition: 0,
                offset: latestOffset
            }
        ],
        {
            autoCommit: false,
            fromOffset: true

        }
    );
    consumer.on('message', function (message) {
        MyDate = new Date();
        var temp = message['value'].substr(message['value'].search("roadMapId")+12, 10).split(' ')[0];
        var errorCheck = message['value'].substr(message['value'].search("message")+12, 10).split(' ')[0];
        MyDate.setDate(MyDate.getDate() + 20);
        MyDateString = MyDate.getFullYear() + '/'
        +('0' + MyDate.getMonth()).slice(-2) + '/'
        +('0' + MyDate.getDate()).slice(-2) + '   '
        +('0' + MyDate.getHours()).slice(-2) + ':'
        +('0' + MyDate.getMinutes()).slice(-2) + ':'
        +('0' + MyDate.getSeconds()).slice(-2);
        console.log(MyDateString+"   "+temp);
        console.log(temp);
        if(errorCheck=="ERROR"){
            console.log('error in');
            console.log(++errorArray[temp]);
        }

            console.log('traffic in');
        console.log(++trafficArray[temp]);
        fs.appendFile('.log', '['+MyDateString+']  '+ JSON.stringify(message['value'])+'\r\n', 'utf8', function(err) {
        });
    });
});

expressapp.use(bodyparser.json());
expressapp.use(function(req,res,next){
    res.setTimeout(15000, function(){
        console.log('time out..');
        res.sendStatus(408);
    });
    next();
});
expressapp.use(express.static(path.join(__dirname+"/../", 'ENOW-console')));
const port = 1111;
expressapp.set('port', port);

expressapp.post('/post_db', function(req, res){
    connectDB(req.body, 'enow', 'recipes', 'save', res);
});

var sendKafka = function(req, topic, messages){
    payloads[0]['topic'] = topic
    payloads[0]['messages']= JSON.stringify(messages);
    setTimeout(function () {
        producer.send(payloads, function (err, data) {
            console.log(payloads);
        });
        producer.on('error', function (err) {
            console.log(err);
        });
    }, 1000);
}

var reserve = function(cb) {
    process.nextTick(function() {
        cb();
    });
}
var makeReserve = function(key, value, res) {
    reserve(function() {
        var obj = new Object();
        var aliveAsk = 0;
        obj['brokerId'] = key;
        connectDB(obj, 'connectionData', 'brokerList', 'findBroker2', null);
        setTimeout(function(){
            if(mqttHost != null){
                var client = mqtt.connect('mqtt://'+mqttHost+':'+mqttPort);
                client.on('connect', function(){
                    client.publish('enow/server0/'+key+'/'+value+'/alive/request', '{"topic":'+'"enow/server0/'+key+'/'+value+'"}');
                    client.subscribe('enow/server0/'+key+'/'+value+'/alive/response');
                })
                var waitAck = setInterval(function(){
                    console.log(client.connected);
                    if(++aliveAsk>3){
                        clearInterval(waitAck);
                        res.write('0');
                        client.end();
                    }
                }, 2000);
                client.on('message', function(topic, message){
                    console.log(topic + ' sent ack.');
                    client.end();
                    res.write('1');
                    clearInterval(waitAck);
                });
            }else{
                res.write('1');
            }


        }, 2000);
    });
}
expressapp.post('/alive_check', function(req, res){
    var obj = new Object();
    console.log('Running RoadMap!');

    setTimeout(function(){
        for(var i=1; i<= Object.keys(req.body['nodeIds']).length ; ++i){
            obj[req.body['nodeIds'][i]['brokerId']] = obj[req.body['nodeIds'][i]['brokerId']] || [];
            obj[req.body['nodeIds'][i]['brokerId']].push(req.body['nodeIds'][i]['deviceId']);
        }
        for(key in obj){
            for(val in obj[key]){
                makeReserve(key, obj[key][val], res);
            }
        }
        setTimeout(function(){
            res.end();
        }, timeoutLimit || 12000)
    }, 3000);
});
expressapp.post('/run_db', function(req, res){
        connectDB(req.body, 'enow', 'execute', 'run', res);
        setTimeout(function(){
            var obj = {};
            obj['roadMapId'] = roadmapNum.toString();
            sendKafka(req, 'event', obj);
        },3000);
});
expressapp.post('/kill_db', function(req, res){
    console.log('kill execute...');
    connectDB(req.body, 'enow', 'execute', 'kill', res)
});
expressapp.post('/add_broker', function(req, res){
    console.log('add broker...');
    console.log(req.body);
    connectDB(req.body, 'connectionData', 'brokerList', 'saveBroker', res);
    sendKafka(req, 'brokerAdd', req.body);
});
expressapp.post('/add_device', function(req, res){
    console.log('add device...');
    connectDB(req.body, 'connectionData', 'brokerList', 'saveDevice', res);
});
expressapp.post('/find_device', function(req, res){
    console.log('find device...');
    connectDB(req.body, 'connectionData', 'brokerList', 'findDevice', res);
});
expressapp.post('/find_broker', function(req, res){
    console.log('find broker...');
    connectDB(req.body, 'connectionData', 'brokerList', 'findBroker', res);
});
expressapp.post('/post_url_settings', function(req, res){
    console.log('setting url...');
    console.log(req.body);
    mongoUrl = req.body['mongoUrl'];
    mongoPort = req.body['mongoPort'];
    kafkaUrl = req.body['kafkaUrl'];
    kafkaPort = req.body['kafkaPort'];
    // timeoutLimit = req.body['timeoutLimit']*1000;
    producer.client.connectionString = kafkaUrl+':'+kafkaPort;
    if(db){
        db.close();
    }
    MongoClient.connect('mongodb://'+ mongoUrl+'/'+mongoPort, function(err, database, callback) {
        if(err){
            console.log(err);
            res.send('no_connect');
            return;
        }
        db = database;
        console.log('connected to mongodb://'+ mongoUrl+'/'+mongoPort);
        res.send("done");
    });
});
expressapp.post('/load_roadmap', function(req, res){
    console.log('load roadmap...');
    console.log(req.body['db']);
    connectDB(req.body, req.body['db'], req.body['collection'], 'findTarget', res);
});
expressapp.post('/get_broker', function(req, res){
    console.log('get broker...');
    connectDB(req.body, 'connectionData', 'brokerList', 'findBroker', res);
});

expressapp.post('/add_secure', function(req, res){
    console.log('add secure...');
    console.log(req.body);
    connectDB(req.body, 'connectionData', 'brokerList', 'addSecure', res);
    var obj = {};
    obj['brokerId'] = req.body['brokerId'];
    if(req.body['caFile']==null){
        sendKafka(req, 'sslSub', obj);
    }else{
        obj['caFile'] = req.body['caFile'];
        obj['certFile'] = req.body['certFile'];
        obj['keyFile'] = req.body['keyFile'];
        sendKafka(req, 'sslAdd', obj);
    }
});


expressapp.post('/get_traffic', function(req, res){
    console.log('get traffics...');
    console.log(req.body);
    setTimeout(function(){
        console.log(trafficArray[req.body['brokerId']])
        res.send(trafficArray[req.body['brokerId']].toString());
        trafficArray[req.body['brokerId']] = 0;
    }, 1000);
});
expressapp.post('/get_error', function(req, res){
    console.log('get error...');
    console.log(req.body);
    var obj = new Object();
    if(trafficArray[req.body['brokerId']] > trafficPin){
        obj['traffic'] = trafficArray[req.body['brokerId']] - trafficPin;
        trafficPin = trafficArray[req.body['brokerId']];
    }else{
        obj['traffic'] = trafficArray[req.body['brokerId']];
        trafficPin = 0;
    }
    obj['error'] = errorArray[req.body['brokerId']];
    setTimeout(function(){
        res.send(obj);
        errorArray[req.body['brokerId']] = 0;
    }, 1000);
});

expressapp.get('/get_brokers', function(req, res){
    console.log('get brokers...');
    connectDB(null, 'connectionData', 'brokerList', 'find', res);
});
expressapp.get('/get_settings', function(req, res){
    console.log('get settings...');
    connectDB(null, 'connectionData', 'settings', 'find', res);
});
expressapp.get('/get_roadmaps', function(req, res){
    console.log('get roadmaps...');
    connectDB(null, 'enow', 'recipes', 'find', res);
});
expressapp.get('/get_running_roadmaps', function(req, res){
    console.log('get running roadmaps...');
    connectDB(null, 'enow', 'execute', 'find', res);
});
expressapp.get('/get_devices', function(req, res){
    console.log('get devices...');
    connectDB(null, 'connectionData', 'brokerList', 'find', res);
});

var server = expressapp.listen(expressapp.get('port'), function(){
    console.log(
        "\n\n\n  ███████╗███╗   ██╗ ██████╗ ██╗    ██╗\
        \n  ██╔════╝████╗  ██║██╔═══██╗██║    ██║  ENOW Started!\
        \n  █████╗  ██╔██╗ ██║██║   ██║██║ █╗ ██║  Connect to 127.0.0.1:1111\
        \n  ██╔══╝  ██║╚██╗██║██║   ██║██║███╗██║\
        \n  ███████╗██║ ╚████║╚██████╔╝╚███╔███╔╝  Version 0.0.1\
        \n  ╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚══╝╚══╝   Copyright © 2016 ENOW. All rights reserved.");
    });

    function connectDB(source, dbName, collectionName, command, response){
        console.log('connecting to '+mongoUrl+':'+mongoPort+'...'+dbName+'.'+collectionName);
        var findDocument = function(callback){
            db.db(dbName).collection(collectionName).find({}).toArray(function(err,result){
                response.send(result);
            });
        };
        var findBroker = function(callback){
            db.db(dbName).collection(collectionName).find({brokerId:source['brokerId']}).toArray(function(err,result){
                    response.send(result);
            });
        };
        var findBroker_2 = function(callback){
            if(source['brokerId']!='null' && source['lambda']==true){
                db.db(dbName).collection(collectionName).find({brokerId:source['brokerId']}).toArray(function(err,result){
                        mqttHost = result[0]['ipAddress'];
                        mqttPort = result[0]['port'];

                });
            }else{
                mqttHost = null;
                mqttPort = null;
            }

        };
        var findTarget = function(callback){
            var o_id = BSON.ObjectID.createFromHexString(source['_id']);
            db.db(dbName).collection(collectionName).find({_id:o_id}).toArray(function(err,result){
                response.send(result);
                o_id = null;
            });
        }
        var findDevice = function(callback){
            db.db(dbName).collection(collectionName).find({deviceId:source['deviceId']}).toArray(function(err,result){
                response.send(result);
            });
        }
        var insertDocument = function(callback){
            var cursor = db.db(dbName).collection(collectionName).find({}).toArray(function(err,result){
                if(result.length!=0){
                    roadmapNum = roadMapIdTemp = parseInt(result[result.length-1]['roadMapId'])+1;
                }
                else{
                    roadmapNum = roadMapIdTemp = 1;
                }
                db.db(dbName).collection(collectionName).insertOne({
                    "roadMapId" : roadMapIdTemp.toString(),
                    "clientId" : source['clientId'],
                    "orderNode" : source['orderNode'],
                    "initNode" : source['initNode'],
                    "lastNode" : source['lastNode'],
                    "incomingNode" : source['incomingNode'],
                    "outingNode" : source['outingNode'],
                    "isInput" : source['isInput'],
                    "isOutput" : source['isOutput'],
                    "nodeIds" : source['nodeIds']
                },function(err, result){
                    response.send("done");
                });
            });

        };


        var insertDocumentDevice = function(callback){
            db.db(dbName).collection(collectionName).updateOne({'brokerId':source['brokerId']},{
                '$push' : { 'deviceId': source['deviceId']}
            }, function(err,result){
                response.send("done");
            });
        };

        var insertDocumentBroker = function(callback){
            db.db(dbName).collection(collectionName).count({}, function(err, cnt) {
                db.db(dbName).collection(collectionName).insertOne({
                    "brokerNum" : (cnt+1).toString(),
                    "brokerId" : source['brokerId'],
                    "ipAddress" : source['ipAddress'],
                    "port" : source['port'],
                    "deviceId" : source['deviceId'],
                },function(err, result){
                    response.send("done");
                });
            });
        };

        var updateBroker = function(callback){
            db.db(dbName).collection(collectionName).updateOne({'brokerId':source['brokerId']},{
                '$set' : { 'ca': source['ca'], 'hostCrt': source['hostCrt'], 'hostKey': source['hostKey']}
            }, function(err,result){
                response.send("done");
            });
        };

        var deleteDocument = function(callback){
            db.db(dbName).collection(collectionName).deleteOne({
            },function(err, result){
                response.send("done");
            });
        };

        if(command=="save" || command=="run"){
            insertDocument(db, function(){
            });
        }else if(command=="saveBroker"){
            insertDocumentBroker(db, function(){
            });
        }else if(command=="saveDevice"){
            insertDocumentDevice(db, function(){
            });
        }else if(command=="findDevice"){
            findDevice(db, function(){
            });
        }else if(command=="kill"){
            deleteDocument(db,function(){
            });
        }else if(command=="find"){
            findDocument(db, function(){
            });
        }else if(command=="findTarget"){
            findTarget(db, function(){
            });
        }else if(command=="findBroker"){
            findBroker(db, function(){
            });
        }else if(command=="findBroker2"){
            findBroker_2(db, function(){
            });
        }else if(command=="addSecure"){
            updateBroker(db, function(){
            });
        }
    };
