(function() {
  'use strict';

  var Pokeio, current_pos, pos_lat, pos_lon, pokeio, data, close_distance = 0.039,
    interval;

  Pokeio = require('./Pokemon-GO-node-api/poke.io.js');

  // 5 rue scribe
  // pos_lat = 48.871146;
  // pos_lon = 2.330233;

  // rue avron
  pos_lat = 48.852846;
  pos_lon = 2.409021;

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
    forts: [],
    cforts: [],
    cdownforts: [],
    // fortsMarker: {}
    fortsById: {}
  };

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
        console.log('getFortBoost', err, fort);
      }
      console.log('[*] Get Fort Boost', fortId);
      data.fortsById[fortId].CooldownCompleteMs = fort.cooldown_complete_timestamp_ms;
      socket.emit('fort-taken', fortId);
    });
  }

  function takeNearForts(socket) {
    var fortId, fort, dist,
      readyTimeStamp;
    // console.log('takeNearForts');
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
        }
      }
    }
    // return nearFortsId();
  }


  function catchPokemonInterval(socket) {
    setInterval(function() {
      takeNearForts(socket);
      pokeio.Heartbeat(function(err, hb) {
        if (err || !hb) {
          return console.log(err);
        }

        for (var i = hb.cells.length - 1; i >= 0; i--) {
          if (hb.cells[i].NearbyPokemon[0]) {
            //console.log(a.pokemonlist[0])
            var pokemon = pokeio.pokemonlist[parseInt(hb.cells[i].NearbyPokemon[0].PokedexNumber) - 1];
            // console.log(pokemon, hb.cells[i]);
            console.log('[+] There is a ' + pokemon.name + ' near you.');
          }
        }

        var alltocatch = [];

        // Show MapPokemons (catchable) & catch
        for (i = hb.cells.length - 1; i >= 0; i--) {
          // console.log(hb.cells[i].MapPokemon);
          for (var j = hb.cells[i].MapPokemon.length - 1; j >= 0; j--) {
            // use async lib with each or eachSeries should be better :)
            var currentPokemon = hb.cells[i].MapPokemon[j];
            alltocatch.push(currentPokemon);

            // (function(currentPokemon) {

            // })(currentPokemon);

          }
        }

        function catchPokemon(currentPokemon) {
          var pokedexInfo = pokeio.pokemonlist[parseInt(currentPokemon.PokedexTypeId) - 1];
          console.log('[+] There is a ' + pokedexInfo.name + ' near!! I can try to catch it!');

          pokeio.EncounterPokemon(currentPokemon, function(suc, dat) {
            console.log('Encountering pokemon ' + pokedexInfo.name + '...');
            pokeio.CatchPokemon(currentPokemon, 1, 1.950, 1, 1, function(xsuc, xdat) {
              if (xsuc) {
                return console.log('CatchPokemon', xsuc);
              }
              var status = ['Unexpected error', 'Successful catch', 'Catch Escape', 'Catch Flee', 'Missed Catch'];
              console.log(status[xdat.Status]);
            });
          });

        }

        if (alltocatch.length > 0) {
          alltocatch = [alltocatch[0]];
          alltocatch.forEach(catchPokemon);
        }
      });
    }, 5000);
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
      console.log('a user connected');
      socket.on('disconnect', function() {
        console.log('user disconnected');
      });

      catchPokemonInterval(socket);

      socket.on('get-profile', function(callback) {
        return callback && callback({
          all: pokeio,
          info: pokeio.playerInfo,
          data: data
        });
      });

      socket.on('move-to', function(target, callback) {

        if (interval) {
          clearInterval(interval);
        }

        var points = [],
          dist = 2 / 1e6,
          move = dist,
          source = {
            lat: pokeio.playerInfo.latitude,
            lon: pokeio.playerInfo.longitude
          },
          total_distance = distance(source.lat, source.lon, target.lat, target.lon);

        while (Math.abs(source.lat - target.lat) > dist || Math.abs(source.lon - target.lon) > dist) {
          if (source.lat > target.lat) {
            source.lat -= move;
          } else {
            source.lat += move;
          }
          if (source.lon > target.lon) {
            source.lon -= move;
          } else {
            source.lon += move;
          }
          points.push({
            lat: source.lat,
            lon: source.lon
          });
        }

        function doMove() {
          var start, duration, first, modulo = 0;
          start = Date.now();

          interval = setInterval(function() {
            first = points.shift();
            if (first) {
              socket.emit('user-new-position', first);
              pokeio.SetLocation({
                type: 'coords',
                coords: {
                  latitude: first.lat,
                  longitude: first.lon,
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
            }
            modulo += 1;
            if (points.length === 0) {
              duration = Date.now() - start;
              console.log('MoveTo Done.', (total_distance * 1000).toFixed(2), 'meter', duration, 'ms', total_distance / (duration / (1000 * 60 * 60)), 'km/h');
              clearInterval(interval);
              return callback && callback(null);
            }
          }, 70);
        }

        doMove();


      });

      socket.on('get-user-position', function(callback) {
        return callback && callback({
          lat: pokeio.playerInfo.latitude,
          lon: pokeio.playerInfo.longitude
        });
      });
    });
  }

  var GoogleMapsAPI = require('googlemaps');

  var publicConfig = {
    key: 'AIzaSyANeH7BcfpYR4E36ZHpmrRWjZEW83hZdew',
    stagger_time: 1000, // for elevationPath
    encode_polylines: false,
    secure: true // use https
      // proxy: 'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
  };
  var gmAPI = new GoogleMapsAPI(publicConfig);

  gmAPI.directions({
    origin: pos_lat + ',' + pos_lon,
    destination: "115 rue d'avron 75020 paris"
  }, function(err, data) {
    // assert.ifError(err);
    // result = data;
    console.log(err, data);
    console.log(data.routes[0].overview_polyline);
    // done();
  });


  pokeio.init('pouyapokemon', 'pokemonGO', current_pos, 'google', function(err) {
    console.log(err);

    pokeio.pokemonlist.forEach(function(p) {
      data.all_pokemons[p.id] = p;
    });

    function getProfile() {
      pokeio.GetProfile(function(err, p) {
        console.log('GetProfile', err);
        data.profile = p;
      });
    }

    function getInventory() {
      pokeio.GetInventory(function(err, inventory) {
        if (err) {
          return console.log('GetInventory', err);
        }
        var p;
        // console.log('get invetenory', err, inventory);
        inventory.inventory_delta.inventory_items.forEach(function(i) {
          p = i.inventory_item_data.pokemon;
          if (p !== null && p.is_egg === null) {
            data.pokemons.push(p);
          }
        });
        data.pokemons = data.pokemons.sort(function(a, b) {
          return a.pokemon_id - b.pokemon_id;
        });
        data.pokemons.forEach(function(p) {
          p.reference = data.all_pokemons[p.pokemon_id];
        });
        setupExpress();
      });
    }

    function getForts() {
      pokeio.Heartbeat(function(err, hb) {
        if (err) {
          return console.log('Heartbeat', err);
        }
        data.forts = [];
        data.fortsById = {};
        data.cforts = [];
        data.cdownforts = [];

        hb.cells.forEach(function(o) {
          if (o.Fort.length > 0) {
            data.forts = data.forts.concat(o.Fort);
            o.Fort.forEach(function(f) {

              var dist = distance(current_pos.coords.latitude, current_pos.coords.longitude, f.Latitude, f.Longitude);
              if (f.CooldownCompleteMs) {
                f.CooldownCompleteMs_TimeStamp = parseInt(f.CooldownCompleteMs.toString(), 10);
                data.cdownforts.push(f);
              }
              if (dist < close_distance) {
                data.cforts.push(f);
              }
              data.fortsById[f.FortId] = f;
            });
          }
        });
        console.log(data.forts.length, data.cforts.length, data.cdownforts.length);
      });
    }

    getInventory();
    // setInterval(getForts, 30 * 1e3);
    getForts();


  });

}());
