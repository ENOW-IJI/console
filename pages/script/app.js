
var app = angular.module('mainModule', []);
// var app = angular.module('mainModule',[]);
app.controller('myCtrl', function($scope, $http){
    $scope.name = "kihwan";
    // $http.get("/get_db").then(function(response, error){
    //     $scope.list = response.data;
    // })
    // stages.html
    $scope.listOfDevice = {};
    $scope.listOfInitNode = [];
    $scope.listOfLastNode = [];
    $scope.list = [];
    $scope.tree;
    $scope.mapIds;
    // settings.html
    $scope.brokerList=[];
    $scope.settings={};
    $scope.newnode ={};
    // ------------------------------------------
    $scope.saveDataBase = function(){
        $http({
            withCredentials: false,
            method: 'post',
            url: "/post_db",
            headers: {'Content-Type': 'application/json'},
            data: $scope.tree,
            contentType : 'application/json',
            dataType: "json"
        });
    }
    $scope.runRoadMap = function(){
        $http({
            withCredentials: false,
            method: 'post',
            url: "/run_db",
            headers: {'Content-Type': 'application/json'},
            data: $scope.tree,
            contentType : 'application/json',
            dataType: "json"
        });
    }
    $scope.killRoadMap = function(){
        $http({
            withCredentials: false,
            method: 'post',
            url: "/kill_db",
            headers: {'Content-Type': 'application/json'},
            data: $scope.tree,
            contentType : 'application/json',
            dataType: "json"
        });
    }
    $scope.addBroker = function(){
        console.log($scope.newnode);
        $http({
            withCredentials: false,
            method: 'post',
            url: "/add_broker",
            headers: {'Content-Type': 'application/json'},
            data: $scope.newnode,
            contentType : 'application/json',
            dataType: "json"
        });
    }
    $scope.getBroker = function(){
        $http({
            withCredentials: false,
            method: 'get',
            url: "/get_broker"
        }).then(function(response){
            // this.brokerList = response.data;
            $scope.brokerList = response.data;
        });
    }
    $scope.getSettings = function(){
        $http({
            withCredentials: false,
            method: 'get',
            url: "/get_settings"
        }).then(function(response){
            // this.brokerList = response.data;
            $scope.brokerList = response.data;
        });
    }
    $scope.changeToTree = function (arrayList) {
        Object.setPrototypeOf(arrayList, Object.prototype);
        var rootNodes = {};

        var insert_incoming = function (list){
            rootNodes.incomingNode[list.target] = rootNodes.incomingNode[list.target] || [];
            rootNodes.incomingNode[list.target].push(list.source);
        }
        var insert_outcoming = function (list){
            rootNodes.outingNode[list.source] = rootNodes.outingNode[list.source] || [];
            rootNodes.outingNode[list.source].push(list.target);
        }

        // rootNodes.roadMapId = "1";
        rootNodes.clientId = "1";
        rootNodes.initNode = this.listOfInitNode;
        rootNodes.lastNode = this.listOfLastNode;
        rootNodes.incomingNode = rootNodes.incomingNode || {};
        rootNodes.outingNode = rootNodes.outingNode || {};
        rootNodes.isInput = false;
        rootNodes.isOutput = false;
        rootNodes.mapIds = this.mapIds || {};
        for(var i=0; i<arrayList.length; ++i){
            insert_incoming(arrayList[i]);
            insert_outcoming(arrayList[i]);
        }
        // $scope.tree = rootNodes;
        $scope.tree = JSON.stringify(rootNodes, null, '   ');
        return rootNodes;
    };

});
