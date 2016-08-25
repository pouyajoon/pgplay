(function() {
  'use strict';



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


  var GMap = function() {

    var GoogleMapsAPI = require('googlemaps'),
      publicConfig;

    console.log('setup gmap');
    publicConfig = {
      key: 'AIzaSyANeH7BcfpYR4E36ZHpmrRWjZEW83hZdew',
      stagger_time: 1000, // for elevationPath
      encode_polylines: false,
      secure: true // use https
        // proxy: 'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
    };
    this.gmAPI = new GoogleMapsAPI(publicConfig);

    // getLatLngForAddressList(['5 rue scribe, 75009 Paris, France',
    //   '8 Rue Boudreau, 75009 Paris, France',
    //   '1 Rue de Caumartin, 75009 Paris, France',
    //   '2 Rue Danielle Casanova, 75002 Paris, France',
    //   '3 Bis Place de l\'Opéra, 75009 Paris, France'
    // ], function(latlng) {
    //   console.log('round1', latlng);
    // });

    // getLatLngForAddressList(['132 Rue d\'Avron, 75020 Paris',
    //   '9-11 Rue Henri Tomasi, 75020 Paris',
    //   '1 Avenue de la Porte de Montreuil, 75020 Paris',
    //   '103 Rue d\'Avron, 75020 Paris', '48 Rue du Volga, 75020 Paris'
    // ], function(latlng) {
    //   console.log('round1', latlng);
    // });
  };

  GMap.prototype.getPathForDirection = function(sourceLatLng, targetLatLng, callback) {
    var from, to;
    from = sourceLatLng.lat + ',' + sourceLatLng.lng;
    to = targetLatLng.lat + ',' + targetLatLng.lng;
    this.gmAPI.directions({
      origin: from,
      destination: to,
      mode: 'walking'
    }, function(err, data) {
      if (err || data.error_message) {
        console.log(err, data);
      }
      if (data.routes && data.routes[0]) {
        var points = decodePolyline(data.routes[0].overview_polyline.points);
        return callback && callback(points);
      }
    });
  };

  GMap.prototype.getGeoCode = function(address, callback) {
    console.log(address);
    this.gmAPI.geocode({
      address: address
    }, function(err, data) {
      console.log(err);
      console.log('geolocation', address, data.results[0].geometry.location);
      return callback && callback(data.results[0].geometry.location);
    });
  };

  GMap.prototype.getLatLngForAddressList = function(address_list, callback) {
    var latLngList = [],
      that = this;

    function next(index) {
      console.log(index, address_list.length);
      if (index >= address_list.length - 1) {
        return callback && callback(latLngList);
      }
      // else
      index += 1;
      that.getGeoCode(address_list[index], function(pos) {
        latLngList.push(pos);
        next(index);
      });
    }
    next(-1);
  };



  module.exports = GMap;



}());
