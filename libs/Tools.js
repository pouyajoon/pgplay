(function() {
  'use strict';

  exports.distance = function(lat1, lon1, lat2, lon2) {
    // console.log('distance', lat1, lon1, lat2, lon2);
    var p, a;
    p = 0.017453292519943295; // Math.PI / 180
    a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 +
      Math.cos(lat1 * p) * Math.cos(lat2 * p) *
      (1 - Math.cos((lon2 - lon1) * p)) / 2;
    // console.log('calc', a, Math.cos((lat2 - lat1) * p), lat2 - lat1, lat2, lat1, Math.cos(lat1 * p) * Math.cos(lat2 * p), (1 - Math.cos((lon2 - lon1) * p)) / 2, 12742 * Math.asin(Math.sqrt(a)));
    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  };

  exports.getPrettyPokemonName = function(p) {
    return p.reference.name + ' (' + p.cp + ')';
  };

}());
