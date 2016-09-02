(function () {
  'use strict';

  var locations = {
    points: {},
    circuits: {},
    gyms: {}
  };

  locations.points.scribe = {
    lat: 48.871146,
    lng: 2.330233
  };

  locations.points.avron = {
    lat: 48.852846,
    lng: 2.409021
  };

  // gym madelaine
  // pos_lat = 48.869420;
  // pos_lon = 2.324004;

  // gym vendom
  // pos_lat = 48.867530;
  // pos_lon = 2.329288;


  locations.points.gym_vendom = {
    lat: 48.867480,
    lng: 2.32943
  };
  locations.gyms.vendom = {
    FortId: '6ba630e22557489692ee3c76db5bd1cd.12',
    Latitude: 48.867481,
    Longitude: 2.329427,
    IsInBattle: null
  };


  // gym valmy

  locations.points.gym_valmy = {
    lat: 48.850900,
    lng: 2.416024800
  };

  locations.gyms.valmy = {
    FortId: '25ad87add18548e8bc0d19e79f1c3fef.16',
    Latitude: 48.850906,
    Longitude: 2.416029,
    IsInBattle: null
  };

  locations.points.gym_porte_montreuil = {
    lat: 48.853911,
    lng: 2.410743
  };

  locations.gyms.porte_montreuil = {
    FortId: '04a0c55837a0482993841f440c0f495c.16',
    Latitude: 48.853911,
    Longitude: 2.410742,
    IsInBattle: null
  };


  locations.gyms.jim_morison = {
    FortId: 'ff4b2a7fca2a477f8a886c8870b7694f.12',
    Latitude: 48.859241,
    Longitude: 2.393809,
    IsInBattle: null
  };

  locations.points.jim_morison = {
    lat: locations.gyms.jim_morison.Latitude,
    lng: locations.gyms.jim_morison.Longitude
  };


  locations.gyms.place_reunion = {
    FortId: '9011af7d19174037b63478156306eaa9.11',
    Latitude: 48.855746,
    Longitude: 2.40101,
    IsInBattle: null
  };

  locations.points.gym_place_reunion = {
    lat: 48.85583,
    lng: 2.400990
  };



  // pos_lat = 48.850906;
  // pos_lon = 2.416029;



  // rue scribe round
  locations.circuits.scribe1 = [{
    lat: 48.870495,
    lng: 2.330228
  }, {
    lat: 48.8723199,
    lng: 2.3284151
  }, {
    lat: 48.8702046,
    lng: 2.3278585
  }, {
    lat: 48.8675866,
    lng: 2.3335069
  }, {
    lat: 48.8706952,
    lng: 2.3319797
  }];

  // paris
  locations.circuits.paris1 = [{
    lat: 48.870521,
    lng: 2.330565
  }, {
    lat: 48.863534,
    lng: 2.325200
  }, {
    lat: 48.853899,
    lng: 2.351872
  }, {
    lat: 48.854654,
    lng: 2.347795
  }, {
    lat: 48.857012,
    lng: 2.340682
  }, {
    lat: 48.845476,
    lng: 2.363502
  }, {
    lat: 48.844085,
    lng: 2.359790
  }, {
    lat: 48.846606,
    lng: 2.337088
  }, {
    lat: 48.845914,
    lng: 2.311875
  }, {
    lat: 48.857153,
    lng: 2.312776
  }, {
    lat: 48.854640,
    lng: 2.314879
  }, {
    lat: 48.855445,
    lng: 2.298893
  }, {
    lat: 48.861741,
    lng: 2.289001
  }];

  // home round
  locations.circuits.avron1 = [{
    lat: 48.8530701,
    lng: 2.4089785
  }, {
    lat: 48.8515537,
    lng: 2.4099224
  }, {
    lat: 48.8537921,
    lng: 2.4111323
  }, {
    lat: 48.8529217,
    lng: 2.4064246
  }, {
    lat: 48.8526173,
    lng: 2.4079283
  }];

  exports.locations = locations;


}());
