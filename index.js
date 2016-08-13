(function() {
  'use strict';



  var saveManager = require('./libs/SaveManager').SaveManager;

  var moment = require('moment');

  var evolvingPokemons = {};

  var allIntervals = [];


  var colors = require('colors');

  var candidateForEvolution = {
    10: 12,
    13: 12,
    16: 12,
    19: 25,
    21: 50,
    41: 50,
    60: 25
  };

  var inventoryItemTypes = {
    ITEM_POKE_BALL: 1,
    ITEM_GREAT_BALL: 2,
    ITEM_ULTRA_BALL: 3,
    ITEM_MASTER_BALL: 4,
    ITEM_POTION: 101,
    ITEM_SUPER_POTION: 102,
    ITEM_HYPER_POTION: 103,
    ITEM_MAX_POTION: 104,
    ITEM_REVIVE: 201,
    RAZZ_BERRY: 701,
    ITEM_LUCKY_EGG: 301
  };

  var inventoryItemTypesMax = {};
  inventoryItemTypesMax[inventoryItemTypes.ITEM_POKE_BALL] = 25;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_GREAT_BALL] = 75;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_ULTRA_BALL] = 100;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_MASTER_BALL] = 100;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_POTION] = 0;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_SUPER_POTION] = 10;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_HYPER_POTION] = 10;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_MAX_POTION] = 50;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_REVIVE] = 5;

  inventoryItemTypesMax[inventoryItemTypes.RAZZ_BERRY] = 15;


  var maximunPokemonsStorage = {
    1: 3,
    4: 3,
    7: 3,
    10: 2,
    11: 3,
    13: 2, //Weedle
    14: 2,
    15: 2,
    16: 5,
    17: 3,
    18: 2,
    19: 5,
    20: 2,
    21: 2,
    22: 3,
    23: 2,
    24: 2,
    27: 2,
    29: 2,
    30: 2,
    32: 2,
    33: 2,
    35: 2,
    39: 2,
    41: 2,
    42: 2,
    43: 2,
    46: 2,
    48: 2,
    52: 2,
    53: 2,
    54: 2,
    56: 2,
    58: 2,
    60: 2,
    61: 2,
    63: 2,
    69: 2,
    70: 2,
    72: 3,
    74: 2,
    77: 2,
    79: 2,
    84: 2,
    85: 3,
    92: 2,
    96: 2,
    98: 2,
    102: 2,
    104: 2,
    109: 2,
    111: 3,
    114: 2,
    116: 2,
    117: 2,
    118: 2,
    120: 2,
    121: 3,
    124: 3,
    126: 3,
    127: 3,
    129: 2, // magicarp
    133: 8, //evoli
    147: 2
  };



  function Timer(callback, delay) {
    var timerId, start, remaining = delay;

    this.pause = function() {
      console.log('[>] Pause Timer');
      clearTimeout(timerId);
      remaining -= new Date() - start;
    };

    this.resume = function(start) {
      if (start === undefined) {
        console.log('[>] Resume Timer');
      }
      start = new Date();
      clearTimeout(timerId);
      timerId = setTimeout(callback, remaining);
    };

    this.stop = function() {
      console.log('[>] Stop Timer');
      clearTimeout(timerId);
    };

    this.resume(true);
  }

  var Pokeio, current_pos, pos_lat, pos_lon, pokeio, g_socket, data, close_distance = 0.039,
    interval, gmAPI, consts = {
      step_distance_meter: {
        value: 2.5,
        length: 0.8
      },
      walking_interval: {
        value: 800,
        length: 400
      }
    };

  var asyncActionList = [],
    parkedAsyncActionList = [],
    executeAsyncActionList;


  function flushParkedList() {
    asyncActionList = asyncActionList.concat(parkedAsyncActionList);
    parkedAsyncActionList = [];
  }

  function setupNextAsyncCall(nextAsyncTime) {
    var nextTimeMin = nextAsyncTime || 500;
    setTimeout(executeAsyncActionList, nextTimeMin + Math.floor(Math.random() * 200) + 1);
  }

  function appendAsyncAction(action) {
    if (action.type !== 'EVOLVE' && Object.keys(evolvingPokemons).length > 0) {
      if (action.type === 'MOVE') {
        console.log('Park Action For Later', action.name);
        parkedAsyncActionList.push(action);
      }
      return console.log('Evolving Right Now ... Escape ' + action.name);
    }
    asyncActionList.push(action);
  }

  function prependAsyncAction(action) {
    if (Object.keys(evolvingPokemons).length > 0) {
      return console.log('Evolving Right Now ... Escape ' + action.name);
    }
    asyncActionList.unshift(action);
  }

  executeAsyncActionList = function() {
    var action, args;
    if (asyncActionList.length) {
      action = asyncActionList.shift();
      args = action.args;
      args.push(function(err, res) {
        if (err) {
          console.log('ASYNC ACTION ERROR'.red, (new Date(Date.now())).toISOString(), err, action.name);
        } else {
          if (action.silence === true) {
            process.stdout.write('.');
          } else {
            console.log('ASYNC ACTION DONE'.green, (new Date(Date.now())).toISOString(), action.name);
          }

          if (action.callback) {
            action.callback(err, res);
          }
        }
        setupNextAsyncCall(action.nextAsyncTime);
      });
      if (action.silence === true) {
        process.stdout.write('.');
      } else {
        console.log('APPLY ASYNC'.cyan, asyncActionList.length, action.name);
      }
      action.m.apply(pokeio, action.args);
    } else {
      setupNextAsyncCall();
    }
  };

  executeAsyncActionList();

  Pokeio = require('./Pokemon-GO-node-api/poke.io.js');

  // 5 rue scribe
  // pos_lat = 48.871146;
  // pos_lon = 2.330233;

  // gym madelaine
  // pos_lat = 48.869420;
  // pos_lon = 2.324004;

  // gym vendom
  // pos_lat = 48.867530;
  // pos_lon = 2.329288;

  // rue avron
  pos_lat = 48.852846;
  pos_lon = 2.409021;

  // rue scribe round
  // var round1 = [{
  //   lat: 48.870495,
  //   lng: 2.330228
  // }, {
  //   lat: 48.8723199,
  //   lng: 2.3284151
  // }, {
  //   lat: 48.8702046,
  //   lng: 2.3278585
  // }, {
  //   lat: 48.8675866,
  //   lng: 2.3335069
  // }, {
  //   lat: 48.8706952,
  //   lng: 2.3319797
  // }];

  // paris 
  // var round1 = [{
  //   lat: 48.870521,
  //   lng: 2.330565
  // }, {
  //   lat: 48.863534,
  //   lng: 2.325200
  // }, {
  //   lat: 48.853899,
  //   lng: 2.351872
  // }, {
  //   lat: 48.854654,
  //   lng: 2.347795
  // }, {
  //   lat: 48.857012,
  //   lng: 2.340682
  // }, {
  //   lat: 48.845476,
  //   lng: 2.363502
  // }, {
  //   lat: 48.844085,
  //   lng: 2.359790
  // }, {
  //   lat: 48.846606,
  //   lng: 2.337088
  // }, {
  //   lat: 48.845914,
  //   lng: 2.311875
  // }, {
  //   lat: 48.857153,
  //   lng: 2.312776
  // }, {
  //   lat: 48.854640,
  //   lng: 2.314879
  // }, {
  //   lat: 48.855445,
  //   lng: 2.298893
  // }, {
  //   lat: 48.861741,
  //   lng: 2.289001
  // }];

  // home round
  var round1 = [{
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

  current_pos = {
    type: 'coords',
    coords: {
      latitude: pos_lat,
      longitude: pos_lon,
      altitude: 0
    }
  };

  pokeio = new Pokeio.Pokeio();
  data = {
    all_pokemons: {},
    pokemons: [],
    profile: null,
    fortsById: {}
  };


  function getCurrentUserPosition() {
    return {
      lat: pokeio.playerInfo.latitude,
      lng: pokeio.playerInfo.longitude
    };
  }

  function distance(lat1, lon1, lat2, lon2) {
    var p, a;
    p = 0.017453292519943295; // Math.PI / 180
    a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 +
      Math.cos(lat1 * p) * Math.cos(lat2 * p) *
      (1 - Math.cos((lon2 - lon1) * p)) / 2;
    // console.log('calc', a, Math.cos((lat2 - lat1) * p), lat2 - lat1, lat2, lat1, Math.cos(lat1 * p) * Math.cos(lat2 * p), (1 - Math.cos((lon2 - lon1) * p)) / 2, 12742 * Math.asin(Math.sqrt(a)));
    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  }

  function getFortBoost(socket, fortId, lat, lon) {
    appendAsyncAction({
      m: pokeio.GetFortSearch,
      args: [fortId, lat, lon],
      silence: true,
      name: 'Get Fort Boost : ' + fortId,
      callback: function(err, res) {
        // console.log('[*] Get Fort Boost'.green, fortId);
        if (res.result !== 1) {
          // console.log('FORT BOOST RESULT IS NOT CORRECT'.red, res);
        } else {
          if (data.fortsById[fortId]) {
            // data.fortsById[fortId].CooldownCompleteMs = res.cooldown_complete_timestamp_ms;
          } else {
            console.log('FORT ID IS MISSING'.red, res, fortId);
          }
        }
      }
    });

    pokeio.GetFortSearch(fortId, lat, lon, function(err, fort) {
      if (err) {
        return console.log('getFortBoost', err, fort);
      }
      // if (g_socket) {
      //   g_socket.emit('fort-taken', fortId);
      // }
    });
  }

  function takeNearForts(callback) {
    var fortId, fort, dist,
      readyTimeStamp;
    // console.log('[*] Search Near Forts', Object.keys(data.fortsById).length);
    for (fortId in data.fortsById) {
      if (data.fortsById.hasOwnProperty(fortId)) {
        fort = data.fortsById[fortId];
        dist = distance(pokeio.playerInfo.latitude, pokeio.playerInfo.longitude, fort.Latitude, fort.Longitude);
        if (dist < close_distance) {
          // console.log('distance ok', dist, fort.FortId, fort.CooldownCompleteMs);
          if (fort.CooldownCompleteMs) {
            readyTimeStamp = parseInt(fort.CooldownCompleteMs.toString(), 10);
            if (Date.now() > readyTimeStamp) {
              getFortBoost(g_socket, fort.FortId, fort.Latitude, fort.Longitude);
            }
          } else {
            getFortBoost(g_socket, fort.FortId, fort.Latitude, fort.Longitude);
          }
        } else {
          // if (fort.CooldownCompleteMs) {
          //   fort.CooldownCompleteMs_TimeStamp = parseInt(fort.CooldownCompleteMs.toString(), 10);
          // }
        }
      }
    }
    return callback && callback(null);
    // return nearFortsId();
  }

  function catchPokemonInterval(callback) {
    // setInterval(function() {
    // takeNearForts(g_socket);

    if (g_socket) {
      g_socket.emit('get-forts', data.fortsById);
    }

    pokeio.Heartbeat(function(err, hb) {
      var alltocatch, allforts, i, o, j, currentPokemon;
      if (err || !hb) {
        // console.log('Heartbeat', err);
        return callback && callback(err, hb);
      }

      // console.log(hb.cells[0]);

      alltocatch = [];
      allforts = [];
      // Show MapPokemons (catchable) & catch
      for (i = hb.cells.length - 1; i >= 0; i -= 1) {
        // console.log(hb.cells[i].MapPokemon);
        o = hb.cells[i];
        if (o.Fort.length > 0) {
          allforts = allforts.concat(o.Fort);
        }
        for (j = hb.cells[i].MapPokemon.length - 1; j >= 0; j -= 1) {
          // use async lib with each or eachSeries should be better :)
          currentPokemon = hb.cells[i].MapPokemon[j];
          alltocatch.push(currentPokemon);
        }
      }


      if (allforts.length > 0) {
        console.log('UPDATE FORTS', allforts.length);
        data.fortsById = {};
        allforts.forEach(function(f) {
          if (f.CooldownCompleteMs) {
            f.CooldownCompleteMs_TimeStamp = parseInt(f.CooldownCompleteMs.toString(), 10);
          }
          data.fortsById[f.FortId] = f;
        });
      }


      function catchPokemon(currentPokemon, callback) {
        var pokedexInfo = pokeio.pokemonlist[parseInt(currentPokemon.PokedexTypeId, 10) - 1];
        console.log('[+] There is a ' + pokedexInfo.name + ' near!! I can try to catch it!', (new Date(Date.now())).toISOString());
        pokeio.EncounterPokemon(currentPokemon, function(err, encounterData) {
          var cp = encounterData.WildPokemon.pokemon.cp;
          var pokeball = 1;
          if (cp > 150 && data.items[inventoryItemTypes.ITEM_GREAT_BALL] && data.items[inventoryItemTypes.ITEM_GREAT_BALL] > 0) {
            pokeball = inventoryItemTypes.ITEM_GREAT_BALL;
          }
          if (cp > 500 && data.items[inventoryItemTypes.ITEM_ULTRA_BALL] && data.items[inventoryItemTypes.ITEM_ULTRA_BALL] > 0) {
            pokeball = inventoryItemTypes.ITEM_ULTRA_BALL;
          }
          console.log(('[*] Encountering pokemon ' + pokedexInfo.name + '... With CP (' + cp + ') Catch Will Ball (' + pokeball + ')').magenta);

          pokeio.CatchPokemon(currentPokemon, 1, 1.950, 1, pokeball, function(xsuc, xdat) {
            var res, status;
            if (xsuc) {
              console.log('ERROR CatchPokemon'.red, xsuc);
              return callback && callback(xsuc);
            }
            console.log(xdat);
            status = ['Unexpected error', 'Successful catch', 'Catch Escape', 'Catch Flee', 'Missed Catch'];
            res = status[xdat.Status] === 'Successful catch';
            if (res === true) {
              console.log(('[*] Pokemon Catch Result' + status[xdat.Status]).green);
              if (g_socket) {
                g_socket.emit('catch-pokemon', {
                  pokemon: pokedexInfo,
                  cp: cp,
                  when: Date.now()
                });
              }
            } else {
              console.log(('[*] Pokemon Catch Result' + status[xdat.Status]).gray);
            }
            return callback && callback(null, res);
          });
        });
      }

      function tryCatch(currentPokemon, callback) {
        catchPokemon(currentPokemon, function(err, catched) {
          return callback && callback(err, catched);
        });
      }

      if (alltocatch.length > 0) {
        alltocatch = [alltocatch[0]];
        // if (interval) {
        //   interval.pause();
        // }
        alltocatch.forEach(function(p) {
          tryCatch(p, function(err, catched) {
            // if (interval) {
            //   interval.resume();
            // }
            return callback && callback(err, catched);
          });
        });
      } else {
        return callback && callback();
      }
    });
    // }, 5000);
  }

  function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
  }


  var moveId = 0;
  var moves = {};

  function doGlobalMove(socket, source, target, callback) {
    moveId += 1;
    var myMoveId = moveId;
    moves[myMoveId] = true;


    saveManager.updateDestination(target);

    function addExtraPointsOnDirectionPoints(points) {

      var nextPos, lastPos, newPositions = [],
        oldPositions = [];

      while (points.length > 0) {
        nextPos = points.shift();
        oldPositions.push(nextPos);

        var dist_step = consts.step_distance_meter.value + Math.floor(Math.random() * consts.step_distance_meter.length) + 1;

        if (lastPos) {
          var dist = distance(lastPos.lat, lastPos.lng, nextPos.lat, nextPos.lng);
          var dist_m = (dist * 1000);
          // console.log('Distance with last point is', dist_m.toFixed(2), 'meter', dist_step);

          if (dist_m > dist_step) {
            var steps = parseInt(dist_m / dist_step, 10);
            var gap = {
              lat: nextPos.lat - lastPos.lat,
              lng: nextPos.lng - lastPos.lng
            };
            var gapStep = {
              lat: gap.lat / steps,
              lng: gap.lng / steps
            };
            // console.log('add steps', steps, gap, gapStep);
            for (var i = 0; i < steps - 1; i += 1) {

              var iPos = {
                lat: lastPos.lat + gapStep.lat * i,
                lng: lastPos.lng + gapStep.lng * i
              };

              // console.log('add position', iPos, gap, i);
              if (isFloat(iPos.lat) && isFloat(iPos.lng)) {
                newPositions.push(iPos);
              }
            }
            newPositions.push(nextPos);
          } else {
            newPositions.push(nextPos);
          }
        } else {
          newPositions.push(nextPos);

        }

        lastPos = nextPos;
      }

      return {
        oldPositions: oldPositions,
        newPositions: newPositions
      };

    }

    function getCustomPoints(source, target) {
      var points = [],
        dist = 2 / 1e6,
        move = dist;
      while (Math.abs(source.lat - target.lat) > dist || Math.abs(source.lon - target.lng) > dist) {
        if (source.lat > target.lat) {
          source.lat -= move;
        } else {
          source.lat += move;
        }
        if (source.lng > target.lng) {
          source.lng -= move;
        } else {
          source.lng += move;
        }
        points.push({
          lat: source.lat,
          lng: source.lng
        });
      }
      return points;
    }

    function doMove(points) {
      var start, duration, nextPos, lastPos;
      start = Date.now();

      console.log('[>] Start Move', points.length);

      function nextMove() {
        nextPos = points.shift();
        if (nextPos) {
          // console.log('[>] Move To', nextPos, points.length);

          appendAsyncAction({
            m: pokeio.SetLocation,
            type: 'MOVE',
            args: [{
              type: 'coords',
              coords: {
                latitude: nextPos.lat,
                longitude: nextPos.lng,
                altitude: 0
              }
            }],
            silence: true,
            name: 'Move To : ' + nextPos.lat + ', ' + nextPos.lng + ' | Remaining Points :' + points.length,
            callback: function(err, res) {
              if (g_socket) {
                g_socket.emit('user-new-position', nextPos);
              }


              saveManager.updatePosition(nextPos);

              lastPos = nextPos;

              if (points.length === 0) {
                duration = Date.now() - start;
                delete moves[myMoveId];
                console.log('[>] MoveTo Done.'.green);
                return callback && callback(null);
              } else {
                if (moves[myMoveId]) {
                  nextMove();
                }
              }
            }
          });
        }
      }
      nextMove();
    }

    // var points = getCustomPoints(source, target);
    // doMove(points, 50);

    var positionToGo;

    getPathForDirection(source, target, function(points) {
      var positions = addExtraPointsOnDirectionPoints(points);
      if (socket) {
        socket.emit('g-move-path', positions);
      }
      positionToGo = positions;
      doMove(positions.newPositions);
    });

    return myMoveId;

  }

  function setupExpress() {
    var express, app, http, io;
    express = require('express');
    app = express();
    http = require('http').Server(app);
    io = require('socket.io')(http);

    app.use(express.static('public'));

    http.listen(3000, function() {
      console.log('listening on *:3000');
    });

    io.on('connection', function(socket) {
      g_socket = socket;
      console.log('[S] User connected');
      socket.on('disconnect', function() {
        console.log('[S] User disconnected');
      });

      socket.on('get-move-path', function(callback) {
        return callback && callback(positionToGo);
      });

      socket.on('evolve-pokemon', function(pokemon) {
        console.log('evolve-pokemon'.blue, pokemon.reference.id, pokemon.id);
        evolvePokemon(pokemon.reference.id, pokemon);
      });

      socket.on('get-profile', function(callback) {
        return callback && callback({
          all: pokeio,
          info: pokeio.playerInfo,
          data: data
        });
      });

      socket.on('move-to', function(target, callback) {

        var source = {
          lat: pokeio.playerInfo.latitude,
          lng: pokeio.playerInfo.longitude
        };

        moves = {};
        doGlobalMove(socket, source, target, function() {
          currentRoundIndex = -1;
          goNextRound();
        });
      });

      socket.on('get-user-position', function(callback) {
        return callback && callback({
          lat: pokeio.playerInfo.latitude,
          lng: pokeio.playerInfo.longitude
        });
      });
    });
  }



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

  function getGeoCode(address, callback) {
    console.log(address);
    gmAPI.geocode({
      address: address
    }, function(err, data) {
      console.log(err);
      console.log('geolocation', address, data.results[0].geometry.location);
      return callback && callback(data.results[0].geometry.location);
    });
  }

  function getLatLngForAddressList(address_list, callback) {
    var latLngList = [];

    function next(index) {
      console.log(index, address_list.length);
      if (index >= address_list.length - 1) {
        return callback && callback(latLngList);
      } else {
        index += 1;
        getGeoCode(address_list[index], function(pos) {
          latLngList.push(pos);
          next(index);
        });
      }
    }
    next(-1);
  }

  function setupGMap() {
    var GoogleMapsAPI = require('googlemaps');

    console.log('setup gmap');
    var publicConfig = {
      key: 'AIzaSyANeH7BcfpYR4E36ZHpmrRWjZEW83hZdew',
      stagger_time: 1000, // for elevationPath
      encode_polylines: false,
      secure: true // use https
        // proxy: 'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
    };
    gmAPI = new GoogleMapsAPI(publicConfig);

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

  }



  function getPathForDirection(sourceLatLng, targetLatLng, callback) {
    var from = sourceLatLng.lat + ',' + sourceLatLng.lng;
    var to = targetLatLng.lat + ',' + targetLatLng.lng;
    gmAPI.directions({
      origin: from,
      destination: to,
      mode: 'walking'
    }, function(err, data) {
      if (data.routes && data.routes[0]) {
        var points = decodePolyline(data.routes[0].overview_polyline.points);
        return callback && callback(points);
      }
    });
  }


  var currentRoundIndex = -1;

  function goNextRound() {
    console.log('[>] Go Next Round', currentRoundIndex);
    if (currentRoundIndex === -1) {
      currentRoundIndex = 0;
      return doGlobalMove(g_socket, getCurrentUserPosition(), round1[0], function() {
        return goNextRound();
      });
    } else {
      currentRoundIndex += 1;
      currentRoundIndex = currentRoundIndex % round1.length;
      return doGlobalMove(g_socket, getCurrentUserPosition(), round1[currentRoundIndex], function() {
        return goNextRound();
      });

    }
  }

  var evolvingPokemonId = 0;

  function evolvePokemon(typeId, pokemon) {
    evolvingPokemonId += 1;
    console.log('TRY EVOLVE'.red, data.all_pokemons[typeId].name, '(', pokemon.cp, ')');

    function startEvolution(evolutionId, pokemon) {
      evolvingPokemons[evolutionId] = true;

      var pokemonId = pokemon.id;
      appendAsyncAction({
        m: pokeio.EvolvePokemon,
        args: [pokemonId],
        type: 'EVOLVE',
        name: 'EVOLVE POKEMON ' + data.all_pokemons[typeId].name,
        nextAsyncTime: 5000,
        callback: function(err, res) {
          if (!err) {
            console.log('EVOLUTION DONE'.green, 'ID IS', evolutionId.toString().blue, res);
          }
          delete evolvingPokemons[evolutionId];
          console.log('REMAINING EVOLUTION', Object.keys(evolvingPokemons).length);
          if (Object.keys(evolvingPokemons).length === 0) {
            console.log('**** EVOLUTION ARE DONE ****'.red);
            flushParkedList();
          }
        }
      });
    }
    startEvolution(evolvingPokemonId, pokemon);
  }

  function initPGApi() {
    var position = saveManager.getPGPosition() || current_pos;

    pokeio.init('pouyapokemon', 'pokemonGO', position, 'google', function(err) {
      if (err) {
        return console.log('initPG', err);
      }
      // console.log(err);
      pokeio.pokemonlist.forEach(function(p) {
        data.all_pokemons[p.id] = p;
      });


      function asyncCatchPokemonInterval() {
        prependAsyncAction({
          m: catchPokemonInterval,
          args: [],
          silence: true,
          name: 'Catch Pokemon'
        });
      }


      function getProfile() {
        pokeio.GetProfile(function(err, p) {
          if (err) {
            return console.error('GetProfile', err);
          }
          data.profile = p;
        });
      }


      function cleanPokemons() {
        function releaePokemons(pId, transferPokemons) {
          transferPokemons.forEach(function(p) {
            appendAsyncAction({
              m: pokeio.TransferPokemon,
              args: [p.id],
              name: 'Transfer Pokemon With Type Id ' + pId + ', CP ' + p.cp
            });
          });
        }
        var pId, samePokemons = [],
          evolutionsNum = 0;
        for (pId in data.pokemonsById) {
          if (data.pokemonsById.hasOwnProperty(pId)) {
            samePokemons = data.pokemonsById[pId];
            if (maximunPokemonsStorage[pId] !== undefined) {
              var max = maximunPokemonsStorage[pId];
              if (candidateForEvolution[pId] !== undefined) {
                max = Math.ceil(data.candies[pId] / candidateForEvolution[pId]);
                // console.log('MAX IS', pId, max, Math.max(max, maximunPokemonsStorage[pId]), samePokemons.length);
                if (samePokemons.length >= max) {
                  evolutionsNum += max;
                } else {
                  evolutionsNum += samePokemons.length;
                }
                max = Math.max(max, maximunPokemonsStorage[pId]);
              }
              if (samePokemons.length > max) {
                var transferPokemons = samePokemons.slice(max);
                releaePokemons(pId, transferPokemons);
              }
            }
          }
        }
        data.evolutionsNum = evolutionsNum;
        console.log('EVOLUTION NUM IS'.magenta, evolutionsNum);

        if (evolutionsNum >= 60) {
          evolutionTime();
        }
      }

      function evolveThemAll() {
        var pId, samePokemons;
        for (pId in data.pokemonsById) {
          if (data.pokemonsById.hasOwnProperty(pId)) {
            if (candidateForEvolution[pId] !== undefined) {
              samePokemons = data.pokemonsById[pId];
              samePokemons.forEach(function(p) {
                evolvePokemon(pId, p);
              });
            }
          }
        }
      }

      function evolutionTime() {

        console.log('***** EVOLUTION TIME *****'.red);

        saveManager.extendBoomTime(6);


        prependAsyncAction({
          m: pokeio.UseItemXpBoost,
          args: [inventoryItemTypes.ITEM_LUCKY_EGG, 1],
          name: 'USE ITEM_LUCKY_EGG',
          nextAsyncTime: 2000,
          callback: function(err, res) {
            if (!err) {
              console.log('LUGY EGG ENABLED'.green, res);
              evolveThemAll();
            }
          }
        });
      }



      function cleanItems() {
        var itemId, itemCount, diff;
        for (itemId in data.items) {
          if (data.items.hasOwnProperty(itemId)) {
            if (inventoryItemTypesMax[itemId]) {
              itemCount = data.items[itemId];
              diff = itemCount - inventoryItemTypesMax[itemId];
              // console.log(itemId, itemCount, inventoryItemTypesMax[itemId], diff)
              if (diff > 0) {
                appendAsyncAction({
                  m: pokeio.DropItem,
                  silence: true,
                  args: [parseInt(itemId, 10), diff],
                  name: 'Clean Inventory For ' + itemId + ', Remove ' + diff + ' Items'
                });
              }
            }
          }
        }
      }

      function cleanInventory() {
        cleanItems();
        cleanPokemons();
      }

      function getInventory(callback) {
        // console.log('GET INVENTORY');
        pokeio.GetInventory(function(err, inventory) {
          if (err) {
            console.error('GetInventory', err);
            return callback && callback(err);
          }
          var p, item;
          data.maximunPokemonsStorage = maximunPokemonsStorage;
          data.candidateForEvolution = candidateForEvolution;
          data.inventory = inventory;
          data.items = {};
          data.pokemons = [];
          data.eggs = {};

          data.incubators = {};
          data.user_stats = {};

          data.candies = [];
          data.pokemonsById = {};
          inventory.inventory_delta.inventory_items.forEach(function(i) {
            p = i.inventory_item_data.pokemon;
            if (p !== null) {
              if (p.is_egg === null) {
                p.creation_time_ms_Timestamp = parseInt(p.creation_time_ms.toString(), 10);
                data.pokemons.push(p);
              } else {
                if (data.eggs[p.egg_km_walked_target] === undefined) {
                  data.eggs[p.egg_km_walked_target] = [];
                }
                if (p.egg_incubator_id === null) {
                  data.eggs[p.egg_km_walked_target].push(p);
                }
              }
            }
            item = i.inventory_item_data.item;
            if (item !== null) {
              data.items[item.item_id] = item.count;
            }
            if (i.inventory_item_data.player_stats) {
              data.user_stats = i.inventory_item_data.player_stats;
            }

            if (i.inventory_item_data.egg_incubators) {
              data.incubators = i.inventory_item_data.egg_incubators.egg_incubator;
            }
            if (i.inventory_item_data.pokemon_family) {
              var candy = i.inventory_item_data.pokemon_family;
              data.candies[candy.family_id] = candy.candy;
            }

          });
          data.pokemons = data.pokemons.sort(function(a, b) {
            return a.pokemonid - b.pokemon_id;
          });
          data.pokemons.forEach(function(p) {
            p.reference = data.all_pokemons[p.pokemon_id];
            if (data.pokemonsById[p.pokemon_id] === undefined) {
              data.pokemonsById[p.pokemon_id] = [];
            }
            data.pokemonsById[p.pokemon_id].push(p);
          });

          function sortByCp(a, b) {
            return b.cp - a.cp;
          }
          // sort pokemons by cp
          for (var pId in data.pokemonsById) {
            if (data.pokemonsById.hasOwnProperty(pId)) {
              data.pokemonsById[pId] = data.pokemonsById[pId].sort(sortByCp);
            }
          }

          function setEgg(incubator, p1, p2, p3) {
            var egg = null;
            if (data.eggs[p1] && data.eggs[p1][0]) {
              egg = data.eggs[p1][0];
            } else if (data.eggs[p2] && data.eggs[p2][0]) {
              egg = data.eggs[p2][0];
            } else if (data.eggs[p3] && data.eggs[p3][0]) {
              egg = data.eggs[p3][0];
            }
            // console.log('SEARCH FOR EGG', p1, p2, p3, data.eggs);
            if (egg) {
              // console.log('SET EGG'.red, egg.id, incubator.item_id);
              var remaining = (incubator.uses_remaining === null) ? 'Infinity' : incubator.uses_remaining;
              appendAsyncAction({
                m: pokeio.UseItemEggIncubator,
                args: [incubator.item_id, egg.id.toString()],
                name: 'Set Egg ' + egg.egg_km_walked_target + ' km In Incubator > Remaining ' + remaining
              });
            }
          }

          data.incubators.forEach(function(incubator) {
            if (incubator.pokemon_id === null) {
              if (incubator.uses_remaining === null) {
                setEgg(incubator, 2, 5, 10);
              } else {
                setEgg(incubator, 10, 5, 2);
              }
            }
          });

          if (g_socket) {
            g_socket.emit('get-inventory', data);
          }

          cleanInventory();
          return callback && callback(err, inventory);
        });
      }

      function getHatchedEggs(callback) {
        pokeio.GetHatchedEggs(function(err, res) {
          // console.log('GetHatchedEggs', err, res);
          return callback && callback(err, res);
        });
      }

      function getListOfBestPokemons(num) {
        var pokemonsByCp = data.pokemons.sort(function(a, b) {
          return b.cp - a.cp;
        });
        return pokemonsByCp.slice(0, num);
      }


      function getPrettyPokemonName(p) {
        return p.reference.name + ' (' + p.cp + ')';
      }


      function addExtraInfoToGym(f) {

        var dist = distance(pokeio.playerInfo.latitude, pokeio.playerInfo.longitude, f.Latitude, f.Longitude);
        if (dist * 1e3 > 15 || f.IsInBattle !== null) {
          return;
        }

        appendAsyncAction({
          m: pokeio.GetGymDetails,
          args: [f],
          name: 'Get Gym Details ' + f.FortId,
          callback: function(err, res) {
            // console.log('GYM DETAILS'.red, err, res);
            // console.log(res.gym_state.memberships);
            f.info = res;

            console.log('Distance With Gym', f.FortId, (dist * 1e3).toFixed(2), 'meters', 'Team Is', f.Team);

            var args = [],
              bestPokemons = [];
            if (f.Team !== 1) {
              bestPokemons = getListOfBestPokemons(6);
              args = [f, bestPokemons, null];
            } else {
              bestPokemons = getListOfBestPokemons(1);
              args = [f, null, bestPokemons[0]];
            }

            console.log(f);
            var message = 'Start Gym ' + f.info.name + ' Battle With ' + bestPokemons.map(getPrettyPokemonName).join(', ');
            console.log(message);
            appendAsyncAction({
              m: pokeio.StartGymBattle,
              args: args,
              name: message,
              callback: function(err, res) {
                console.log('Attack Gym Result'.red, err, res);
              }
            });

          }
        });
      }

      function updateGyms() {
        var fortId, fort, dist, allgyms = [];
        for (fortId in data.fortsById) {
          if (data.fortsById.hasOwnProperty(fortId)) {
            fort = data.fortsById[fortId];
            if (fort.FortType !== 1) {
              if (fort.GymPoints) {
                fort.GymPointsInt = parseInt(fort.GymPoints.toString(), 10);
              }
              addExtraInfoToGym(fort);
              allgyms.push(fort);
            }
          }
        }
        data.allgyms = allgyms;
      }

      function asyncHatchedEggs() {
        appendAsyncAction({
          m: getHatchedEggs,
          args: [],
          silence: true,
          name: 'getHatchedEggs'
        });
      }

      function asyncGetInventory() {
        appendAsyncAction({
          m: getInventory,
          args: [],
          silence: true,
          name: 'getInventory'
        });
      }

      function asyncTakeNearForts() {
        appendAsyncAction({
          m: takeNearForts,
          silence: true,
          args: [],
          name: 'Take Near Forts'
        });
      }


      allIntervals.push(setInterval(asyncHatchedEggs, 60 * 1e3));
      allIntervals.push(setInterval(asyncGetInventory, 30 * 1e3));
      allIntervals.push(setInterval(asyncTakeNearForts, 8 * 1e3));
      allIntervals.push(setInterval(asyncCatchPokemonInterval, 3 * 1e3));

      // setTimeout(updateGyms, 5000);
      setTimeout(asyncCatchPokemonInterval, 1000);
      setTimeout(asyncHatchedEggs, 1000);
      setTimeout(asyncGetInventory, 0);

      var destination = saveManager.getDestination();
      if (destination) {
        setTimeout(function() {
          doGlobalMove(g_socket, saveManager.getPosition(), destination, function() {
            setTimeout(goNextRound, 2500);
          });
        }, 2500);
      } else {
        setTimeout(goNextRound, 2500);
      }
    });
  }


  function startCluster() {
    var cluster = require('cluster');
    console.log('cluster', cluster.isMaster);
    if (cluster.isMaster) {
      cluster.fork();
      //if the worker dies, restart it.
      cluster.on('exit', function(worker) {
        var nextRun = 30000 + Math.floor(Math.random() * 30000) + 1;
        console.log('Worker ' + worker.id + ' died..'.red);
        console.log('Start Next Session In ' + (nextRun / 1e3) + ' Seconds'.green);
        setTimeout(function() {
          cluster.fork();
        }, nextRun);
      });
    } else {
      console.log('Hello Pokebot'.blue);

      saveManager.load();
      setupGMap();
      setupExpress();
      initPGApi();

      process.on('uncaughtException', function(err) {
        if (err) {
          console.log(err);
        }
        //Send some notification about the error  
        process.exit(1);
      });
    }
  }


  // setupExpress();
  // initPGApi();
  startCluster();


}());
