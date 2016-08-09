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
      console.log('getFortBoost', err, fort);
      data.fortsById[fortId].CooldownCompleteMs = fort.cooldown_complete_timestamp_ms;
      socket.emit('fort-taken', fortId);
    });
  }

  function takeNearForts(socket) {
    var fortId, fort, dist,
      readyTimeStamp;
    console.log('takeNearForts');
    for (fortId in data.fortsById) {
      if (data.fortsById.hasOwnProperty(fortId)) {
        fort = data.fortsById[fortId];
        dist = distance(pokeio.playerInfo.latitude, pokeio.playerInfo.longitude, fort.Latitude, fort.Longitude);
        if (dist < close_distance) {
          console.log('distance ok', dist, fort.FortId, fort.CooldownCompleteMs);
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
        console.log(points.length, source, target);

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
              console.log('timing of move', (total_distance * 1000).toFixed(2), duration, total_distance / (duration / (1000 * 60 * 60)), ' km/h');
              clearInterval(interval);
              return callback && callback(null);
            }
          }, 60);
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

        hb.cells.forEach(function(o) {
          if (o.Fort.length > 0) {
            data.forts = data.forts.concat(o.Fort);
            o.Fort.forEach(function(f) {

              var dist = distance(current_pos.coords.latitude, current_pos.coords.longitude, f.Latitude, f.Longitude);
              // console.log(f.FortId, f.FortType, f.Enabled, dist, current_pos.coords.latitude, current_pos.coords.longitude, f.Latitude, f.Longitude);
              // console.log(f.FortId, f.FortType, f.Enabled, dist);
              if (f.CooldownCompleteMs !== null) {
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

    // getProfile();
    getInventory();
    getForts();


    // getFortBoost('cde87c1bd69a43dea74dc4756b8856c9.16', 48.85261, 2.408995);


  });

}());
