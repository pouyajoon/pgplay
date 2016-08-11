(function() {
  'use strict';
  /*global io, angular, google, moment*/

  var socket, app, map, me, fortMarkers = {};
  socket = io();


  socket.on('user-new-position', function(position) {
    // console.log('user position', position);
    me.setPosition(new google.maps.LatLng(position.lat, position.lng));
  });

  function setMarkerColor(marker, color) {
    marker.setIcon('http://maps.google.com/mapfiles/ms/icons/' + color + '-dot.png');
  }

  socket.on('fort-taken', function(fortId) {
    console.log('fort-taken', fortId);
    if (fortMarkers) {
      setMarkerColor(fortMarkers[fortId], 'red');
    }
  });

  function addMarker(map, lat, lon, title, color, infoContent) {
    var marker, infowindow;
    infowindow = new google.maps.InfoWindow({
      content: '<h5>' + title + '</h5>' + infoContent
    });

    marker = new google.maps.Marker({
      position: new google.maps.LatLng(lat, lon),
      map: map,
      title: title,
      icon: 'http://maps.google.com/mapfiles/ms/icons/' + color + '-dot.png'
    });

    marker.addListener('click', function() {
      infowindow.open(map, marker);
    });
    return marker;
  }


  socket.on('get-forts', function(fortsById) {
    var f, fortId, marker;
    for (fortId in fortsById) {
      if (fortsById.hasOwnProperty(fortId)) {
        f = fortsById[fortId];
        if (fortMarkers[f.FortId] === undefined) {
          fortMarkers[f.FortId] = addMarker(map, f.Latitude, f.Longitude, f.Latitude + ', ' + f.Longitude, 'blue', f.FortId);
        }
        marker = fortMarkers[f.FortId];

        if (f.FortType !== 1){
          setMarkerColor(marker, 'yellow');
        } else {
          if (f.CooldownCompleteMs_TimeStamp) {
            if (Date.now() < f.CooldownCompleteMs_TimeStamp) {
              setMarkerColor(marker, 'red');
            } else {
              setMarkerColor(marker, 'purple');
            }
          }
        }
      }
    }
  });


  // var streetPoints = [];
  var paths = {};

  socket.on('g-move-path', function(positions) {
    // console.log('g-move-path', positions);

    var flightPath, flightPath2;

    if (paths.old) {
      paths.old.setMap(null);
    }
    if (paths.new) {
      paths.new.setMap(null);
    }

    flightPath = new google.maps.Polyline({
      path: positions.oldPositions,
      geodesic: true,
      strokeColor: '#00FF00',
      strokeOpacity: 0.5,
      strokeWeight: 10
    });
    flightPath.setMap(map);
    paths.old = flightPath;

    flightPath2 = new google.maps.Polyline({
      path: positions.newPositions,
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 2
    });
    flightPath2.setMap(map);
    paths.new = flightPath2;


    // streetPoints.forEach(function(p) {
    //   p.setMap(null);
    // });
    // streetPoints = [];

    // positions.oldPositions.forEach(function(pos) {
    // var marker = addMarker(map, pos.lat, pos.lng, 'inital position', 'blue');
    // streetPoints.push(marker);
    // })
  });

  // function distance(lat1, lon1, lat2, lon2) {
  //   var p, a;
  //   p = 0.017453292519943295; // Math.PI / 180
  //   a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 +
  //     Math.cos(lat1 * p) * Math.cos(lat2 * p) *
  //     (1 - Math.cos((lon2 - lon1) * p)) / 2;
  //   // console.log('calc', a, Math.cos((lat2 - lat1) * p), lat2 - lat1, lat2, lat1, Math.cos(lat1 * p) * Math.cos(lat2 * p), (1 - Math.cos((lon2 - lon1) * p)) / 2, 12742 * Math.asin(Math.sqrt(a)));
  //   return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  // }

  function setMap(lat, lon) {
    var options;
    options = {
      zoom: 17,
      center: new google.maps.LatLng(lat, lon),
      mapTypeControl: true
    };
    // init map
    map = new google.maps.Map(document.getElementById('map'), options);

    map.setOptions({
      styles: [{
        'featureType': 'poi',
        'stylers': [{
          'visibility': 'off'
        }]
      }]
    });

    me = addMarker(map, lat, lon, 'myPosition', 'green', 'Me!!');

    google.maps.event.addListener(map, 'click', function(event) {
      var target = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      socket.emit('move-to', target, function(res) {
        console.log('move-to', 'done', res);
      });
    });
  }

  app = angular.module('myApp', []);
  app.controller('MainController', function($scope, $http) {


    $http.get('https://raw.githubusercontent.com/Armax/Pokemon-GO-node-api/master/items.json').success(function(res) {
      var items = {};
      res.items.forEach(function(i) {
        items[i.id] = i;
      })
      $scope.itemsReference = items;
      // console.log('OK', $scope.itemsReference, items);
    })

    var $on = function(key, callback) {
      socket.on(key, function(res) {
        $scope.$apply(function() {
          return callback(res);
        });
      });
    };

    var $emit = function(key, callback) {
      socket.emit(key, function(res) {
        $scope.$apply(function() {
          return callback(res);
        });
      });
    };

    $on('catch-pokemon', function(pokedex, pokemon) {
      console.log(pokedex, pokemon);
    });

    function updateScopeWithData(data) {
      $scope.pokemons = data.pokemons;
      $scope.pokemonsById = data.pokemonsById;
      $scope.allPokemons = data.all_pokemons;
      $scope.candies = data.candies;
      $scope.data = data;

      $scope.pokemons_sorted_by_capture_date = data.pokemons.sort(function(a, b) {
        return b.creation_time_ms_Timestamp - a.creation_time_ms_Timestamp;
      });

      $scope.pokemons_sorted_by_capture_date.forEach(function(p) {
        p.catched_time_from_now = moment(p.creation_time_ms_Timestamp).fromNow();
      })

      // console.log(data.user_stats.km_walked);
      // console.log(data.incubators.map(function(inc) {
      //   return inc.target_km_walked;
      // }));
    }

    $on('get-inventory', function(data) {
      console.log('get-inventory', data);
      updateScopeWithData(data);
    });

    $emit('get-user-position', function(res) {
      console.log('set map', res);
      setMap(res.lat, res.lng);
    });

    $emit('get-profile', function(res) {
      console.log(res);
      updateScopeWithData(res.data);
      // res.data.inventory.inventory_delta.inventory_items.forEach(function(i) {
        // if (i.inventory_item_data.pokemon_family) {
        //   console.log(i.inventory_item_data);
        // }
        // if (i.inventory_item_data.player_stats) {
        //   console.log(i.inventory_item_data.player_stats.km_walked);
        // }
        // if (i.inventory_item_data.applied_items) {
        //   console.log(i.inventory_item_data);
        // }

        // if (i.inventory_item_data.egg_incubators) {
        //   console.log(i.inventory_item_data.egg_incubators.egg_incubator.map(function(inc) {
        //     return inc.target_km_walked;
        //   }));
        // }
      // });

    });

  });

}());