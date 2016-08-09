(function() {
  'use strict';
  /*global io, angular, google, moment*/

  var socket, app, map, me, fortMarkers = {};
  socket = io();


  socket.on('user-new-position', function(position) {
    console.log('user position');
    me.setPosition(new google.maps.LatLng(position.lat, position.lon));
  });


  function setMarkerColor(marker, color) {
    marker.setIcon('http://maps.google.com/mapfiles/ms/icons/' + color + '-dot.png');
  }

  socket.on('fort-taken', function(fortId) {
    console.log('fort-taken', fortId);
    setMarkerColor(fortMarkers[fortId], 'red');
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



  function addMarker(map, lat, lon, title, color, infoContent) {
    var marker, infowindow;
    // console.log('add marker', lat, lon, color);
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

  // function getListOfPoints(source, target) {
  //   var points = [],
  //     dist = 2 / 1e6,
  //     move = dist,
  //     total_distance = distance(source.lat, source.lon, target.lat, target.lon);

  //   while (Math.abs(source.lat - target.lat) > dist || Math.abs(source.lon - target.lon) > dist) {
  //     console.log('still work');
  //     if (source.lat > target.lat) {
  //       source.lat -= move;
  //     } else {
  //       source.lat += move;
  //     }
  //     if (source.lon > target.lon) {
  //       source.lon -= move;
  //     } else {
  //       source.lon += move;
  //     }
  //     points.push({
  //       lat: source.lat,
  //       lon: source.lon
  //     });
  //   }
  //   console.log(points.length, source, target);

  //   var start = Date.now();

  //   var interval = setInterval(function() {
  //     var first = points.shift();
  //     if (first) {
  //       me.setPosition(new google.maps.LatLng(first.lat, first.lon));
  //     }
  //     // console.log('move', first);
  //     if (points.length === 0) {
  //       console.log('end of move', me.position.lat() - target.lat, me.position.lng() - target.lon);
  //       var duration = Date.now() - start;
  //       console.log('timing', (total_distance * 1000).toFixed(2), duration, total_distance / (duration / (1000 * 60 * 60)));
  //       clearInterval(interval);
  //     }
  //   }, 60);
  // }

  function setMap(lat, lon) {
    var options;
    options = {
      zoom: 18,
      center: new google.maps.LatLng(lat, lon),
      mapTypeControl: false
    };
    // init map
    map = new google.maps.Map(document.getElementById('map'), options);
    me = addMarker(map, lat, lon, 'myPosition', 'green', 'Me!!');
    // user_pos = {
    //   lat: lat,
    //   lon: lon
    // };

    google.maps.event.addListener(map, 'click', function(event) {
      var target = {
        lat: event.latLng.lat(),
        lon: event.latLng.lng()
      };
      console.log(target);
      socket.emit('move-to', target, function(res) {
        console.log('move-to', 'done', res);
      });

      // getListOfPoints(user_pos, target);
    });
  }



  // setTimeout(setMap, 500);

  app = angular.module('myApp', []);
  app.controller('MainController', function($scope) {

    var $emit = function(key, callback) {
      socket.emit(key, function(res) {
        $scope.$apply(function() {
          return callback(res);
        });
      });
    };

    $emit('get-user-position', function(res) {
      console.log('set map', res);
      setMap(res.lat, res.lon);
    });

    $emit('get-profile', function(res) {
      console.log(res);

      $scope.pokemons = res.data.pokemons;

      res.data.forts.forEach(function(f) {
        var marker = addMarker(map, f.Latitude, f.Longitude, f.Latitude + ', ' + f.Longitude, 'blue', f.FortId);
        fortMarkers[f.FortId] = marker;
        if (f.CooldownCompleteMs && f.CooldownCompleteMs_TimeStamp) {
          console.log(f.CooldownCompleteMs_TimeStamp);
          if (Date.now() > f.CooldownCompleteMs_TimeStamp) {
            console.log(f, Date.now(), parseInt(f.CooldownCompleteMs.toString(), 10));
            setMarkerColor(marker, 'yellow');
          }
        }
      });
    });

  });

}());
