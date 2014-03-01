/****************************** APP DECLARATION ******************************/

var app = angular.module("App", ["ngRoute" /* Dependencies */ ]); //TODO: rename App

/****************************** ROUTING DECLARATIONS *************************/

app.config(function($routeProvider) {
	$routeProvider.when("/", {
		templateUrl: "templates/template.html", //TODO: use a real template
		controller: "Ctrl" //TODO: use a real controller
	}).otherwise({
		redirectTo: "/"
	});
});

/*************************** CONTROLLER DECLARATIONS *************************/

app.controller("AppCtrl", function($scope) {
	$scope.title = 'you should make a real title'; //TODO use a real title
});

app.controller("Ctrl", function($scope) { //TODO: give controller a real name, insert other injected params as needed
	//TODO: controller logic (assign values needed for UI to $scope)
});


/*************************** SERVICE DECLARATIONS ***************************/

app.service("Svc", function() { //TODO: give service a real name
	//TODO: service logic (use this.<param name> to assign values)
});