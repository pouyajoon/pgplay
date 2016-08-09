var socket = io();


var app = angular.module('myApp', [])
app.controller('MainController', function($scope) {

  $emit = function(key, callback) {
    socket.emit(key, function(res) {
      $scope.$apply(function() {
        return callback(res);
      })
    });
  }


  $emit('get-profile', function(res) {
    $scope.pokemons = res.pokemons;
    
    console.log(res);
  });

});