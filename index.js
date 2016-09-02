(function() {
  'use strict';

  var saveManager = require('./libs/SaveManager').SaveManager,
    AsyncActionHandler = require('./libs/AsyncActionHandler'),
    moment = require('moment'),
    colors = require('colors'),
    constants = require('./libs/Constants').constants,
    locations = require('./libs/Locations').locations,
    tools = require('./libs/Tools');

  var evolvingPokemons = {},
    actionHandler;

  var allIntervals = [];

  var start_point = locations.points.avron,
    // round1 = locations.circuits.avron1;
    // round1 = locations.circuits.scribe1;
    round1 = locations.circuits.paris1;

  //  var start_point = locations.points.jim_morison,
  //    round1;

  var missions = [];

  var Pokeio, current_pos, pokeio, g_socket, data, close_distance = 0.039,
    interval, gmAPI = new(require('./libs/GMap'))();

  Pokeio = require('./pgnode/poke.io.js');

  current_pos = {
    type: 'coords',
    coords: {
      latitude: start_point.lat,
      longitude: start_point.lng,
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


  function getFortBoost(fortId, lat, lon) {
    actionHandler.appendAsyncAction({
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
        dist = tools.distance(pokeio.playerInfo.latitude, pokeio.playerInfo.longitude, fort.Latitude, fort.Longitude);
        if (dist < close_distance) {
          // console.log('distance ok', dist, fort.FortId, fort.CooldownCompleteMs);
          if (fort.CooldownCompleteMs) {
            readyTimeStamp = parseInt(fort.CooldownCompleteMs.toString(), 10);
            if (Date.now() > readyTimeStamp) {
              getFortBoost(fort.FortId, fort.Latitude, fort.Longitude);
            }
          } else {
            getFortBoost(fort.FortId, fort.Latitude, fort.Longitude);
          }
        }
      }
    }
    return callback && callback(null);
  }

  function catchPokemonInterval(callback) {
    if (g_socket) {
      g_socket.emit('get-forts', data.fortsById);
    }
    pokeio.Heartbeat(function(err, hb) {
      var alltocatch, allforts, i, o, j, currentPokemon;
      if (err || !hb) {
        // console.log('Heartbeat', err);
        return callback && callback(err, hb);
      }

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
        // console.log('UPDATE FORTS', allforts.length);
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
          if (cp > 100 && data.items && data.items[constants.inventoryItemTypes.ITEM_GREAT_BALL] && data.items[constants.inventoryItemTypes.ITEM_GREAT_BALL] > 0) {
            pokeball = constants.inventoryItemTypes.ITEM_GREAT_BALL;
          }
          if (cp > 400 && data.items && data.items[constants.inventoryItemTypes.ITEM_ULTRA_BALL] && data.items[constants.inventoryItemTypes.ITEM_ULTRA_BALL] > 0) {
            pokeball = constants.inventoryItemTypes.ITEM_ULTRA_BALL;
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
        alltocatch.forEach(function(p) {
          tryCatch(p, function(err, catched) {
            return callback && callback(err, catched);
          });
        });
      } else {
        return callback && callback();
      }
    });
  }

  function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
  }

  var moveId = 0;
  var moves = {};

  function doGlobalMove(socket, source, target, callback) {
    moveId += 1;
    moves = {};
    var myMoveId = moveId;
    moves[myMoveId] = true;

    //console.log('GM', target);

    saveManager.updateDestination(target);

    function addExtraPointsOnDirectionPoints(points) {

      var nextPos, lastPos, newPositions = [],
        oldPositions = [];

      while (points.length > 0) {
        nextPos = points.shift();
        oldPositions.push(nextPos);

        var dist_step = constants.step_distance_meter.getRandom();

        if (lastPos) {
          var dist = tools.distance(lastPos.lat, lastPos.lng, nextPos.lat, nextPos.lng);
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
        dist = constants.speed,
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

          actionHandler.appendAsyncAction({
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
              //console.log('do move', err, res);
              if (g_socket) {
                g_socket.emit('user-new-position', nextPos, locations);
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

    gmAPI.getPathForDirection(source, target, function(points) {
      //console.log('GPOints', points);
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
      pokeio.socket = socket;
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

  var currentRoundIndex = -1;

  function goNextRound() {
    if (round1 === undefined) {
      return;
    }
    console.log('[>] Go Next Round'.green, currentRoundIndex, round1.length);
    if (currentRoundIndex === -1) {
      currentRoundIndex = 0;
      saveManager.updateNextRoundIndex(currentRoundIndex);
      return doGlobalMove(g_socket, getCurrentUserPosition(), round1[0], function() {
        return goNextRound();
      });
    } else {
      currentRoundIndex += 1;
      currentRoundIndex = currentRoundIndex % round1.length;
      saveManager.updateNextRoundIndex(currentRoundIndex);
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
      actionHandler.appendAsyncAction({
        m: pokeio.EvolvePokemon,
        args: [pokemonId],
        type: 'EVOLVE',
        name: 'EVOLVE POKEMON ' + data.all_pokemons[typeId].name,
        nextAsyncTime: 10000,
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

    pokeio.init('pouyapokemon2', 'pokemonGO', position, 'google', function(err) {
      if (err) {
        console.log('ERROR ON STARTUP'.red, err);
        return false;
      }
      actionHandler = new AsyncActionHandler(pokeio, evolvingPokemons);
      var gm = new(require('./libs/GymManager'))(pokeio, actionHandler);

      if (err) {
        return console.log('initPG', err);
      }
      // console.log(err);
      pokeio.pokemonlist.forEach(function(p) {
        data.all_pokemons[p.id] = p;
      });

      function asyncCatchPokemonInterval() {
        actionHandler.prependAsyncAction({
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
            actionHandler.appendAsyncAction({
              m: pokeio.TransferPokemon,
              args: [p.id],
              silence: true,
              name: 'Transfer Pokemon With Type Id ' + pId + ', CP ' + p.cp
            });
          });
        }
        var pId, samePokemons = [],
          evolutionsNum = 0;
        for (pId in data.pokemonsById) {
          if (data.pokemonsById.hasOwnProperty(pId)) {
            samePokemons = data.pokemonsById[pId];
            if (constants.maximunPokemonsStorage[pId] !== undefined) {
              var max = constants.maximunPokemonsStorage[pId];
              if (constants.candidateForEvolution[pId] !== undefined) {
                max = Math.ceil(data.candies[pId] / constants.candidateForEvolution[pId]);
                // console.log('MAX IS', pId, max, Math.max(max, constants.maximunPokemonsStorage[pId]), samePokemons.length);
                if (samePokemons.length >= max) {
                  evolutionsNum += max;
                } else {
                  evolutionsNum += samePokemons.length;
                }
                max = Math.max(max, constants.maximunPokemonsStorage[pId]);
              }
              if (samePokemons.length > max) {
                var transferPokemons = samePokemons.slice(max);
                releaePokemons(pId, transferPokemons);
              }
            }
          }
        }
        data.evolutionsNum = evolutionsNum;
        // console.log('EVOLUTION NUM IS'.magenta, evolutionsNum);

      }

      function checkEvolutionTime() {
        console.log('CHECK EVOLUTION TIME'.magenta, data.evolutionsNum);
        if (data.evolutionsNum >= 60) {
          evolutionTime();
        }
      }

      function evolveThemAll() {
        var pId, samePokemons;
        for (pId in data.pokemonsById) {
          if (data.pokemonsById.hasOwnProperty(pId)) {
            if (constants.candidateForEvolution[pId] !== undefined) {
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

        saveManager.extendBoomTime(8);
        // return              evolveThemAll();

        actionHandler.prependAsyncAction({
          m: pokeio.UseItemXpBoost,
          args: [constants.inventoryItemTypes.ITEM_LUCKY_EGG, 1],
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
            if (constants.inventoryItemTypesMax[itemId]) {
              itemCount = data.items[itemId];
              diff = itemCount - constants.inventoryItemTypesMax[itemId];
              if (diff > 0) {
                actionHandler.appendAsyncAction({
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
          data.maximunPokemonsStorage = constants.maximunPokemonsStorage;
          data.candidateForEvolution = constants.candidateForEvolution;
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

            // console.log('SET EGG'.green, p1, p2, p3, data.eggs[p1]);

            if (p2 === undefined && p3 === undefined && data.eggs[p1] !== undefined && data.eggs[p1][0] === undefined) {
              // console.log('THERE IS NO'.red, p1, 'EGG'.red);
              return false;
            }

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
              actionHandler.appendAsyncAction({
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
                setEgg(incubator, 10, 5);
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

      function updateGyms() {
        console.log('UPDATE GYMS'.blue);
        var fortId, fort, dist, allgyms = [];
        for (fortId in data.fortsById) {
          if (data.fortsById.hasOwnProperty(fortId)) {
            fort = data.fortsById[fortId];
            if (fort.FortType !== 1) {
              if (fort.GymPoints) {
                fort.GymPointsInt = parseInt(fort.GymPoints.toString(), 10);
              }
              // gm.addExtraInfoToGym(data, fort);
              allgyms.push(fort);
            }
          }
        }
        data.allgyms = allgyms;

        // return;

        var distList = data.allgyms.filter(function(f) {
          return f.Team === 3;
        }).map(function(f) {
          return {
            fort: f,
            dist: tools.distance(pokeio.playerInfo.latitude, pokeio.playerInfo.longitude, f.Latitude, f.Longitude)
          };
        });


        if (missions.length === 0) {
          var myTeamForts = data.allgyms.filter(function(f) {
            return f.Team === 3 && f.IsInBattle !== true;
          });
          console.log('CHECK FORTS'.blue, data.allgyms.length, myTeamForts.length);
          myTeamForts.forEach(function(f) {
            gm.setDeployGymMissionIfGoodToDeploy(f, function(err, res) {
              if (err) {
                return false;
              }
              console.log('SetDeploy GymMission If Good To Deploy'.blue, err, res.gym.info.name.green, res.ok);
              if (res.ok === true && missions.length === 0) {
                var gym = res.gym;
                missions.push(gym);
                console.log('FIND MY TEAM FORT AND GOING THERE'.blue);
                doGlobalMove(g_socket, saveManager.getPosition(), {
                  lat: gym.Latitude,
                  lng: gym.Longitude
                }, function() {
                  console.log('REACH FORT TROP DEPLOY POKEMON'.blue);
                  gm.deployPokemon(data, gym, function() {
                    missions = [];
                  });
                });
              }
            });
          });
        }

        function getMinDistFort(forts) {
          var min, minIndex = 0,
            i = 0;

          if (forts.length === 0) {
            return null;
          }
          forts.forEach(function(f) {
            if (min === undefined) {
              min = f.dist;
            } else {
              min = Math.min(f.dist, min);
              if (f.dist < min) {
                minIndex = i;
              }
            }
            i += 1;
          });
          return forts[minIndex];
        }

        var minDistFort = getMinDistFort(distList);

      }

      function asyncHatchedEggs() {
        actionHandler.appendAsyncAction({
          m: getHatchedEggs,
          args: [],
          silence: true,
          name: 'getHatchedEggs'
        });
      }

      function asyncGetInventory(callback) {
        actionHandler.appendAsyncAction({
          m: getInventory,
          args: [],
          silence: true,
          name: 'getInventory',
          callback: callback
        });
      }

      function asyncTakeNearForts() {
        actionHandler.appendAsyncAction({
          m: takeNearForts,
          silence: true,
          args: [],
          name: 'Take Near Forts'
        });
      }

      function asyncGetLevelReward() {
        actionHandler.appendAsyncAction({
          m: pokeio.LevelUpRewards,
          silence: true,
          args: [data.user_stats.level],
          name: 'Level Up Rewards',
          callback: function(err, res) {
            console.log('LevelUpRewards'.green, err, res);
          }
        });
      }


      allIntervals.push(setInterval(asyncHatchedEggs, 60 * 1e3));
      allIntervals.push(setInterval(asyncGetInventory, 30 * 1e3));
      allIntervals.push(setInterval(asyncTakeNearForts, 8 * 1e3));
      allIntervals.push(setInterval(asyncCatchPokemonInterval, 3 * 1e3));

      setTimeout(asyncGetLevelReward, 30 * 1e3);

      setTimeout(checkEvolutionTime, 60 * 1e3);

      

      //setTimeout(updateGyms, 5 * 1000);
      //allIntervals.push(setInterval(updateGyms, 15 * 1e3));

      setTimeout(asyncCatchPokemonInterval, 1000);
      setTimeout(asyncHatchedEggs, 1000);
      setTimeout(function() {
        asyncGetInventory(function() {
          // updateGyms();
          // gm.addExtraInfoToGym(data, locations.gyms.porte_montreuil);
          // gm.deployPokemon(data, locations.gyms.jim_morison);
        });
      }, 0);



      var destination = saveManager.getDestination();
      if (destination && saveManager.getPosition()) {
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
        var nextRun = 60000 + Math.floor(Math.random() * 30000) + 1;
        console.log('Worker ' + worker.id + ' died..'.red);
        console.log('Start Next Session In ' + (nextRun / 1e3) + ' Seconds'.green);
        setTimeout(function() {
          cluster.fork();
        }, nextRun);
      });
    } else {
      console.log('Hello Pokebot'.blue);

      saveManager.load();
      currentRoundIndex = saveManager.getNextRoundIndex();
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
