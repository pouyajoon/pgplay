(function() {
  'use strict';

  var colors = require('colors');



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
    RAZZ_BERRY: 701
  };

  var inventoryItemTypesMax = {};
  inventoryItemTypesMax[inventoryItemTypes.ITEM_POKE_BALL] = 25;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_GREAT_BALL] = 100;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_POTION] = 5;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_SUPER_POTION] = 25;
  inventoryItemTypesMax[inventoryItemTypes.ITEM_REVIVE] = 5;
  inventoryItemTypesMax[inventoryItemTypes.RAZZ_BERRY] = 100;


  var maximunPokemonsStorage = {
    13: 2, //Weedle
    10: 2,
    14: 2,
    16: 5,
    17: 2,
    19: 5,
    20: 2,
    21: 2,
    41: 2,
    46: 2,
    48: 2,
    92: 2,
    102: 2,
    114: 2,
    118: 2,
    120: 2
  }


  console.log('hello pokebot'.blue);


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

  Pokeio = require('./Pokemon-GO-node-api/poke.io.js');

  // 5 rue scribe
  pos_lat = 48.871146;
  pos_lon = 2.330233;

  // rue avron
  // pos_lat = 48.852846;
  // pos_lon = 2.409021;


  var round1 = [{
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

  var pos1 = {
    lat: 48.870265,
    lng: 2.32996
  };

  var pos0 = {
    lat: pos_lat,
    lng: pos_lon
  }

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
    pokeio.GetFortSearch(fortId, lat, lon, function(err, fort) {
      if (err) {
        return console.log('getFortBoost', err, fort);
      }
      console.log('[*] Get Fort Boost'.green, fortId);
      data.fortsById[fortId].CooldownCompleteMs = fort.cooldown_complete_timestamp_ms;
      // if (g_socket) {
      //   g_socket.emit('fort-taken', fortId);
      // }
    });
  }

  function takeNearForts(socket) {
    var fortId, fort, dist,
      readyTimeStamp;
    console.log('[*] Search Near Forts', Object.keys(data.fortsById).length);
    for (fortId in data.fortsById) {
      if (data.fortsById.hasOwnProperty(fortId)) {
        fort = data.fortsById[fortId];
        dist = distance(pokeio.playerInfo.latitude, pokeio.playerInfo.longitude, fort.Latitude, fort.Longitude);
        if (dist < close_distance) {
          // console.log('distance ok', dist, fort.FortId, fort.CooldownCompleteMs);
          if (fort.CooldownCompleteMs) {
            readyTimeStamp = parseInt(fort.CooldownCompleteMs.toString(), 10);
            if (Date.now() > readyTimeStamp) {
              getFortBoost(socket, fort.FortId, fort.Latitude, fort.Longitude);
            }
          } else {
            getFortBoost(socket, fort.FortId, fort.Latitude, fort.Longitude);
          }
        } else {
          // if (fort.CooldownCompleteMs) {
          //   fort.CooldownCompleteMs_TimeStamp = parseInt(fort.CooldownCompleteMs.toString(), 10);
          // }

        }
      }
    }
    // return nearFortsId();
  }

  function catchPokemonInterval() {
    var socket = g_socket;
    setInterval(function() {
      takeNearForts(g_socket);

      if (g_socket) {
        g_socket.emit('get-forts', data.fortsById)
      }

      pokeio.Heartbeat(function(err, hb) {
        if (err || !hb) {
          return console.log(err);
        }

        // for (var i = hb.cells.length - 1; i >= 0; i--) {
        //   if (hb.cells[i].NearbyPokemon[0]) {
        //     //console.log(a.pokemonlist[0])
        //     var pokemon = pokeio.pokemonlist[parseInt(hb.cells[i].NearbyPokemon[0].PokedexNumber) - 1];
        //     // console.log(pokemon, hb.cells[i]);
        //     console.log('[+] There is a ' + pokemon.name + ' near you.');
        //   }
        // }

        var alltocatch = [];
        var allforts = [];
        // Show MapPokemons (catchable) & catch
        for (var i = hb.cells.length - 1; i >= 0; i--) {
          // console.log(hb.cells[i].MapPokemon);
          var o = hb.cells[i];
          if (o.Fort.length > 0) {
            allforts = allforts.concat(o.Fort);
          }
          for (var j = hb.cells[i].MapPokemon.length - 1; j >= 0; j--) {
            // use async lib with each or eachSeries should be better :)
            var currentPokemon = hb.cells[i].MapPokemon[j];
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

        function tryCatch(currentPokemon, callback) {
          catchPokemon(currentPokemon, function(catched) {
            if (catched === true) {
              return callback && callback(true);
            }
            catchPokemon(currentPokemon, function(catched) {
              if (catched === true) {
                return callback && callback(true);
              }
              catchPokemon(currentPokemon, function(catched) {
                return callback && callback(true);
              })
            })
          })
        }

        function catchPokemon(currentPokemon, callback) {
          var pokedexInfo = pokeio.pokemonlist[parseInt(currentPokemon.PokedexTypeId) - 1];
          console.log('[+] There is a ' + pokedexInfo.name + ' near!! I can try to catch it!');

          pokeio.EncounterPokemon(currentPokemon, function(suc, dat) {
            console.log(('[*] Encountering pokemon ' + pokedexInfo.name + '...').magenta);

            var pokeball = 1;
            if (data.items[inventoryItemTypes.ITEM_GREAT_BALL] && data.items[inventoryItemTypes.ITEM_GREAT_BALL] > 0) {
              pokeball = inventoryItemTypes.ITEM_GREAT_BALL;
            }
            pokeio.CatchPokemon(currentPokemon, 1, 1.950, 1, 1, function(xsuc, xdat) {
              if (xsuc) {
                return console.log('CatchPokemon', xsuc);
              }
              console.log(xdat);
              var status = ['Unexpected error', 'Successful catch', 'Catch Escape', 'Catch Flee', 'Missed Catch'];
              var res = status[xdat.Status] === 'Successful catch';
              if (res === true) {
                console.log(('[*] Pokemon Catch Result' + status[xdat.Status]).green);
                if (g_socket) {
                  g_socket.emit('catch-pokemon', pokedexInfo);
                }
              } else {
                console.log(('[*] Pokemon Catch Result' + status[xdat.Status]).gray);
              }

              return callback && callback(res);
            });
          });

        }

        if (alltocatch.length > 0) {
          alltocatch = [alltocatch[0]];
          if (interval) {
            interval.pause();
          }
          alltocatch.forEach(function(p) {
            tryCatch(p, function(res) {
              if (interval) {
                interval.resume();
              }
            });
          });
        }
      });
    }, 5000);
  }

  function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
  }

  function doGlobalMove(socket, source, target, callback) {

    if (interval) {
      interval.stop();
      interval = undefined;
    }

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
              lng: nextPos.lng - lastPos.lng,
            };
            var gapStep = {
              lat: gap.lat / steps,
              lng: gap.lng / steps
            };
            // console.log('add steps', steps, gap, gapStep);
            for (var i = 0; i < steps - 1; i += 1) {

              var iPos = {
                lat: lastPos.lat + gapStep.lat * i,
                lng: lastPos.lng + gapStep.lng * i,
              }

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

    function doMove(points, intervalTime) {
      var start, duration, nextPos, modulo = 0,
        lastPos;
      start = Date.now();

      console.log('[>] Start Move', points.length);

      function nextMove() {
        nextPos = points.shift();
        if (nextPos) {
          // console.log('[>] Move To', nextPos, socket !== undefined);

          if (g_socket) {
            g_socket.emit('user-new-position', nextPos);
          }
          // console.log('Set Location', nextPos);
          pokeio.SetLocation({
            type: 'coords',
            coords: {
              latitude: nextPos.lat,
              longitude: nextPos.lng,
              altitude: 0
            }
          }, function(err, res) {
            if (err) {
              console.log('setLocation', err, res);
            }
          });
          if (modulo % 20 === 0) {

            takeNearForts(socket);
          }
          lastPos = nextPos;
        }
        modulo += 1;
        if (points.length === 0) {
          duration = Date.now() - start;
          // console.log('MoveTo Done.', (total_distance * 1000).toFixed(2), 'meter', duration, 'ms', total_distance / (duration / (1000 * 60 * 60)), 'km/h');
          console.log('[>] MoveTo Done.');
          return callback && callback(null);
        } else {
          var nextMoveTime = intervalTime || consts.walking_interval.value + Math.floor(Math.random() * consts.walking_interval.length) + 1;
          interval = new Timer(nextMove, nextMoveTime);
        }
      }

      nextMove();
    }

    // var points = getCustomPoints(source, target);
    // doMove(points, 50);

    getPathForDirection(source, target, function(points) {
      var positions = addExtraPointsOnDirectionPoints(points);
      if (socket) {
        socket.emit('g-move-path', positions);
      }
      doMove(positions.newPositions);
    });

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

        doGlobalMove(socket, source, target);
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
      return callback && callback(data.results[0].geometry.location)
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

  }

  setupGMap();


  function getPathForDirection(sourceLatLng, targetLatLng, callback) {
    var from = sourceLatLng.lat + ',' + sourceLatLng.lng;
    var to = targetLatLng.lat + ',' + targetLatLng.lng;
    gmAPI.directions({
      origin: from,
      destination: to,
      mode: 'walking'
    }, function(err, data) {
      // console.log('getPathForDirection', err, from, to);
      if (data.routes && data.routes[0]) {
        var points = decodePolyline(data.routes[0].overview_polyline.points);
        console.log(data.routes[0].overview_polyline);
        console.log(points);
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



  var asyncActionList = [];

  setInterval(function() {
    if (asyncActionList.length) {
      var action = asyncActionList.shift();
      // console.log('ASYNC ACTIONS', asyncActionList.length, action.name);

      var args = action.args;
      args.push(function(err, res) {
        if (err) {
          return console.log('ASYNC ACTION ERROR'.red, err);
        }
        console.log('ASYNC ACTION DONE'.green, action.name);
      });
      action.m.apply(pokeio, action.args);
    }
  }, 2000 + Math.floor(Math.random() * 200) + 1)


  function initPGApi() {
    // console.log('initPGApi');
    pokeio.init('pouyapokemon', 'pokemonGO', current_pos, 'google', function(err) {
      if (err) {
        return console.log('initPG', err);
      }
      // console.log(err);
      pokeio.pokemonlist.forEach(function(p) {
        data.all_pokemons[p.id] = p;
      });

      setTimeout(goNextRound, 2500);
      setTimeout(catchPokemonInterval, 2500);

      function getProfile() {
        pokeio.GetProfile(function(err, p) {
          if (err) {
            return console.error('GetProfile', err);
          }
          data.profile = p;
        });
      }


      function cleanPokemons() {
        var pId, samePokemons = [];
        for (var pId in data.pokemonsById) {
          if (data.pokemonsById.hasOwnProperty(pId)) {
            samePokemons = data.pokemonsById[pId];
            if (maximunPokemonsStorage[pId] !== undefined) {
              var transferPokemons = samePokemons.slice(maximunPokemonsStorage[pId]);
              // console.log('transferPokemons', pId, maximunPokemonsStorage[pId], samePokemons.length, transferPokemons.length);
              // if (transferPokemons[0]) {
              //   var id = parseInt(transferPokemons[0].id.toString());
              //   console.log(id);
              //   pokeio.TransferPokemon(transferPokemons[0].id, function(err, res) {
              //     if (err){
              //       return console.log('TransferPokemon ERROR'.red, err, res);  
              //     }
              //     console.log('TransferPokemon', err, res);  
                  
              //   })
              //   return;
              // }

              transferPokemons.forEach(function(p) {
                asyncActionList.push({
                  m: pokeio.TransferPokemon,
                  args: [p.id],
                  name: 'Transfer Pokemon With Type Id ' + pId + ', CP ' + p.cp
                });
              });

            }
          }
        }
      }


      function cleanItems() {
        var itemId, itemCount, diff;
        for (var itemId in data.items) {
          if (data.items.hasOwnProperty(itemId)) {
            if (inventoryItemTypesMax[itemId]) {
              itemCount = data.items[itemId];
              diff = itemCount - inventoryItemTypesMax[itemId];
              // console.log(itemId, itemCount, inventoryItemTypesMax[itemId], diff)
              if (diff > 0) {
                asyncActionList.push({
                  m: pokeio.DropItem,
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

      function getInventory() {
        console.log('GET INVENTORY');
        pokeio.GetInventory(function(err, inventory) {
          if (err) {
            return console.error('GetInventory', err);
          }
          var p, item;
          // console.log('get invetenory', err, inventory);
          data.inventory = inventory;
          data.items = {};
          data.pokemons = [];
          data.pokemonsById = {};
          inventory.inventory_delta.inventory_items.forEach(function(i) {
            p = i.inventory_item_data.pokemon;
            if (p !== null && p.is_egg === null) {
              data.pokemons.push(p);
            }
            item = i.inventory_item_data.item;
            if (item !== null) {
              data.items[item.item_id] = item.count;
              // console.log('GOT IN INVENTORY', item.item_id, item.count);
            }
          });
          data.pokemons = data.pokemons.sort(function(a, b) {
            return a.pokemon_id - b.pokemon_id;
          });
          data.pokemons.forEach(function(p) {
            p.reference = data.all_pokemons[p.pokemon_id];
            if (data.pokemonsById[p.pokemon_id] === undefined) {
              data.pokemonsById[p.pokemon_id] = [];
            }
            data.pokemonsById[p.pokemon_id].push(p);
          });

          // sort pokemons by cp
          for (var pId in data.pokemonsById) {
            if (data.pokemonsById.hasOwnProperty(pId)) {
              data.pokemonsById[pId] = data.pokemonsById[pId].sort(function(a, b) {
                return b.cp - a.cp;
              });
            }
          }

          if (g_socket) {
            g_socket.emit('get-inventory', data);
          }

          cleanInventory();
        });
      }

      function getForts() {
        pokeio.Heartbeat(function(err, hb) {
          if (err) {
            return console.error('Heartbeat', err);
          }
          data.fortsById = {};

          hb.cells.forEach(function(o) {
            if (o.Fort.length > 0) {
              o.Fort.forEach(function(f) {
                if (f.CooldownCompleteMs) {
                  f.CooldownCompleteMs_TimeStamp = parseInt(f.CooldownCompleteMs.toString(), 10);
                }
                data.fortsById[f.FortId] = f;
              });
            }
          });
          console.log('Load Forts', Object.keys(data.fortsById).length);
        });
      }

      setInterval(getInventory, 30 * 1e3);
      getInventory();
      // setInterval(getForts, 30 * 1e3);
      // getForts();
    });
  }

  setupExpress();

  // doGlobalMove(null, pos0, pos1);
  initPGApi();


}())