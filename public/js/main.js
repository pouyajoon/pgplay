(function() {
  'use strict';
  /*global io, angular, google, moment*/

  var socket, app, map, me, fortMarkers = {},
    list = [];
  socket = io();



  socket.on('user-new-position', function(position) {
    // console.log('user position', position);
    if (me) {
      me.setPosition(new google.maps.LatLng(position.lat, position.lng));
    }
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


  function removeAllFortMarkers(fortsById) {
    var fortId, fm, removeList = [];
    for (fortId in fortMarkers) {
      if (fortMarkers.hasOwnProperty(fortId)) {
        fm = fortMarkers[fortId];
        if (fortsById[fortId] === undefined) {
          removeList.push(fortId);
        }
      }
    }
    removeList.forEach(function(fId) {
      fm = fortMarkers[fId];
      fm.setMap(null);
      delete fortMarkers[fId];
    });
  }

  socket.on('get-forts', function(fortsById) {
    var f, fortId, marker;
    removeAllFortMarkers(fortsById);
    for (fortId in fortsById) {
      if (fortsById.hasOwnProperty(fortId)) {
        f = fortsById[fortId];
        if (fortMarkers[f.FortId] === undefined) {
          fortMarkers[f.FortId] = addMarker(map, f.Latitude, f.Longitude, f.Latitude + ', ' + f.Longitude, 'blue', JSON.stringify(f, null, 2));
        }
        marker = fortMarkers[f.FortId];

        if (f.FortType !== 1) {
          setMarkerColor(marker, 'yellow');
        } else {
          fortMarkers[f.FortId].setOpacity(0.25);
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

  var directionsDisplay = new google.maps.DirectionsRenderer;
  directionsDisplay.setMap(map);


  var getPathForDirection = function(start, end, callback) {
    var directionsService = new google.maps.DirectionsService();
    var request = {
      origin: start,
      destination: end,
      travelMode: google.maps.TravelMode.WALKING
    };
    directionsService.route(request, function(response, status) {

      if (status === google.maps.DirectionsStatus.OK) {
        if (response.routes && response.routes[0]) {
          var points = decodePolyline(response.routes[0].overview_polyline.points);
          // return callback && callback(points);
          console.log(points, response, status);
          directionsDisplay.setDirections(response);

        }
        // directionsDisplay.setDirections(response);
      }
    });


    // var from, to;
    // from = sourceLatLng.lat + ',' + sourceLatLng.lng;
    // to = targetLatLng.lat + ',' + targetLatLng.lng;
    // this.gmAPI.directions({
    //   origin: from,
    //   destination: to,
    //   mode: 'walking'
    // }, function(err, data) {
    //   if (err || data.error_message) {
    //     console.log(err, data);
    //   }
    //   if (data.routes && data.routes[0]) {
    //     var points = decodePolyline(data.routes[0].overview_polyline.points);
    //     return callback && callback(points);
    //   }
    // });
  };

  function decodePolyline(encoded) {
    if (!encoded) {
      return [];
    }
    var poly = [];
    var index = 0,
      len = encoded.length;
    var lat = 0,
      lng = 0;

    while (index < len) {
      var b, shift = 0,
        result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result = result | ((b & 0x1f) << shift);
        shift += 5;
      } while (b >= 0x20);

      var dlat = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result = result | ((b & 0x1f) << shift);
        shift += 5;
      } while (b >= 0x20);

      var dlng = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      var p = {
        lat: lat / 1e5,
        lng: lng / 1e5,
      };
      poly.push(p);
    }
    return poly;
  }


  function setMap(lat, lon) {
    var options;
    options = {
      zoom: 17,
      center: new google.maps.LatLng(lat, lon),
      mapTypeControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.TOP_RIGHT
      }
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
    me.setZIndex(1000);

    google.maps.event.addListener(map, 'click', function(event) {
      var target = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };

      // list.push(target);
      // if (list.length > 1) {
      //   getPathForDirection(list[0], list[1]);
      // }
      // console.log(list, JSON.stringify(list));

      socket.emit('move-to', target, function(res) {
        console.log('move-to', 'done', res);
      });
    });
  }

  app = angular.module('myApp', []);
  app.directive('singlePokemon', function() {
    return {
      restrict: 'A',
      templateUrl: '/templates/single.pokemon.ng.html'
    };
  });

  app.directive('tableList', function() {
    return {
      restrict: 'A',
      templateUrl: '/templates/table-list.ng.html'
    };
  });

  app.controller('MainController', function($scope, $http, $rootScope) {

    $rootScope.moment = moment;
    $scope.logs = [];

    $http.get('https://raw.githubusercontent.com/Armax/Pokemon-GO-node-api/master/items.json').success(function(res) {
      var items = {};
      res.items.forEach(function(i) {
        items[i.id] = i;
      });
      $scope.itemsReference = items;
      console.log('GET ITEM REFERENCES', items);
      // console.log('OK', $scope.itemsReference, items);
    });

    $http.get('https://raw.githubusercontent.com/Biuni/PokemonGO-Pokedex/master/pokedex.json').success(function(res) {
      var pokemonsReference = {},
        candiesReference = {};
      res.pokemon.forEach(function(i) {
        pokemonsReference[i.id] = i;
        if (candiesReference[i.candy] === undefined) {
          candiesReference[i.candy] = -1;
        }
        if (i.prev_evolution === undefined) {
          candiesReference[i.candy] = i.id;
        }
      });
      $scope.pokemonsReference = pokemonsReference;
      $scope.allPokemonsReferenceList = res.pokemon;
      $scope.candiesReference = candiesReference;
      console.log('GET POKEMON REFERENCES', pokemonsReference, candiesReference);

    });

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
          return callback && callback(res);
        });
      });
    };

    $on('catch-pokemon', function(info) {
      // console.log('catch-pokemon', info);
      $scope.logs.unshift(info);
    });


    function getCandyCountFor(pId) {
      return $scope.candies[$scope.candiesReference[$scope.pokemonsReference[pId].candy]];
    }


    function updateAllPokemonsById() {
      $scope.allPokemonsById = {};
      $scope.allPokemonsReferenceList.forEach(function(p) {
        if ($scope.pokemonsById[p.id] === undefined) {
          $scope.allPokemonsById[p.id] = p;
        } else {
          $scope.allPokemonsById[p.id] = $scope.pokemonsById[p.id];
        }
      });
    }

    function updateNextEvolutions(data) {
      var nextPokemon, nextId;
      if ($scope.pokemonsReference) {
        Object.keys(data.pokemonsById).forEach(function(pId) {
          var currentPokemonRef, candyCountForPId, candyCountForNextPId;
          currentPokemonRef = $scope.pokemonsReference[pId];
          if (currentPokemonRef && currentPokemonRef.next_evolution) {
            nextPokemon = currentPokemonRef.next_evolution[0];
            nextId = parseInt(nextPokemon.num, 10);
            candyCountForPId = getCandyCountFor(pId);
            if (currentPokemonRef.candy_count) {
              if (data.pokemonsById[nextId] === undefined) {
                $scope.nextEvolutions[pId] = {
                  p: $scope.pokemonsReference[nextId],
                  can: candyCountForPId > currentPokemonRef.candy_count,
                  candy_available: candyCountForPId,
                  candy_count_required: currentPokemonRef.candy_count
                };
              }
            } else {
              if (data.pokemonsById[nextId] === undefined) {
                candyCountForNextPId = getCandyCountFor(pId);
                $scope.nextEvolutions[pId] = {
                  p: $scope.pokemonsReference[nextId],
                  can: candyCountForNextPId >= currentPokemonRef.candy_count,
                  candy_available: candyCountForPId,
                  candy_count_required: currentPokemonRef.candy_count
                };
              }
            }
          }
        });
      }
    }

    function updateScopeWithData(data) {

      $scope.pokemons = data.pokemons;


      $scope.pokemonsById = data.pokemonsById;
      $scope.allPokemons = data.all_pokemons;
      $scope.candies = data.candies;
      $scope.data = data;
      $scope.nextEvolutions = {};
      $scope.maximunPokemonsStorage = data.maximunPokemonsStorage;
      $scope.candidateForEvolution = data.candidateForEvolution;

      updateNextEvolutions(data);
      updateAllPokemonsById();

      $scope.pokemons_sorted_by_capture_date = JSON.parse(JSON.stringify(data.pokemons));

      $scope.pokemons_sorted_by_capture_date.sort(function(a, b) {
        return b.creation_time_ms_Timestamp - a.creation_time_ms_Timestamp;
      });

      $scope.pokemons_sorted_by_capture_date.forEach(function(p) {
        p.catched_time_from_now = moment(p.creation_time_ms_Timestamp).fromNow();
      });

      $scope.pokemons_sorted_by_cp = JSON.parse(JSON.stringify(data.pokemons));

      $scope.pokemons_sorted_by_cp.sort(function(a, b) {
        return b.cp - a.cp;
      });

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
      console.log('get-user-position', res);
      setMap(res.lat, res.lng);
    });

    $scope.evolvePokemon = function(p) {
      console.log('evolve-pokemon', p);
      socket.emit('evolve-pokemon', p);
    };

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
