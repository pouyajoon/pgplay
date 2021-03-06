// 25ad87add18548e8bc0d19e79f1c3fef.16

// https://github.com/tejado/pgoapi/issues/175
// http://pastebin.com/enDzFvUN

(function () {
  'use strict';

  var GymManager, tools = require('./Tools'),
    myTeam = 3,
    colors = require('colors'),
    Long = require("long");

  var attacks = JSON.parse(require('fs').readFileSync('./libs/attacks.json', 'utf8'));
  // console.log(attacks["234"]);

  GymManager = function (pokeio, actionHandler, evolvingPokemons) {
    // console.log('pokeio', typeof pokeio);
    this.pokeio = pokeio;
    this.actionHandler = actionHandler;
    this.evolvingPokemons = evolvingPokemons;
  };

  GymManager.prototype.getGymInfo = function () {
    console.log('gym info');
  };

  GymManager.prototype.getListOfBestPokemons = function (data, num) {
    var pokemons = JSON.parse(JSON.stringify(data.pokemons));

    pokemons = pokemons.filter(function (p) {
      return p.stamina === p.stamina_max;
    }).sort(function (a, b) {
      return b.cp - a.cp;
    });
    return pokemons.slice(0, num);
  };


  GymManager.prototype.userMaxFromPoints = function (points) {
    if (points <= 2000) {
      return 1;
    }
    if (points <= 4000) {
      return 2;
    }
    if (points <= 8000) {
      return 3;
    }
    if (points <= 12000) {
      return 4;
    }
    if (points <= 16000) {
      return 5;
    }
    if (points <= 20000) {
      return 6;
    }
    if (points <= 30000) {
      return 7;
    }
    if (points <= 40000) {
      return 8;
    }
    if (points <= 50000) {
      return 9;
    }
    if (points <= 60000) {
      return 10;
    }

  };


  GymManager.prototype.isGoodToDeploy = function (gym) {
    var points, max_users, that = this,
      userIn = this.isUserInGym(gym);
    if (gym.fort_data && gym.fort_data.GymPoints) {
      points = parseInt(gym.fort_data.GymPoints.toString(), 10);
    }
    max_users = that.userMaxFromPoints(points);
    console.log('GOOD TO DEPLOY ?', gym.info.name.green, 'POINTS', points, 'MAX USERS', max_users, 'USER IN', userIn, 'MEMBERSHIP COUNT', gym.memberships.length);
    if (gym.memberships.length >= max_users) {
      return false;
    }
    return userIn === false;
  };

  GymManager.prototype.setDeployGymMissionIfGoodToDeploy = function (fort, callback) {
    return this.isFortGoodToDeploy(fort, callback);
  };

  GymManager.prototype.isUserInGym = function (gym) {
    var user = gym.memberships.find(function (m) {
      return m.trainer_public_profile.name === 'Pouyamonchu2';
    });
    // console.log('isUserInGym'.red, user);
    return user !== undefined;
  };

  GymManager.prototype.isFortGoodToDeploy = function (f, callback) {
    var that = this;
    // console.log('isFortGoodToDeploy', typeof this.getGymDetails);
    this.getGymDetails(f, function (err, gym) {
      // console.log('getGymDetails res', err);
      if (err) {
        console.error('deployPokemon', err);
        return callback && callback(err);
      }
      return callback && callback(null, {
        ok: that.isGoodToDeploy(gym),
        gym: gym
      });
    });
  };

  GymManager.prototype.deployPokemon = function (data, gym, callback) {
    var that = this;
    // this.getGymDetails(f, function(err, gym) {
    //   if (err) {
    //     console.error('deployPokemon', err);
    //     return callback && callback(err);
    //   }
    var gym_name = gym.info.name,
      bestPokemons,
      pokemon;

    console.log('TRY DEPLOY POKEMON IN GYM'.blue, gym_name, 'TEAM', gym.Team);
    if (that.isGymInRange(gym) && gym.fort_data.Team === myTeam) {
      console.log('CAN GO HERE'.red, gym.Latitude, ',', gym.Longitude, gym.FortId);
      bestPokemons = that.getListOfBestPokemons(data, 6);
      pokemon = bestPokemons[0];
      that.actionHandler.prependAsyncAction({
        m: that.pokeio.FortDeployPokemon,
        args: [gym, pokemon],
        name: 'DEPLOY POKEMON ' + tools.getPrettyPokemonName(pokemon) + ' IN GYM ' + gym_name,
        callback: function (err, res) {
          console.log('END DEPLOY', gym_name, err, res);
          if (!err) {
            if (res.result === 1) {
              console.log('SUCCESS FULL DEPLOYMENT OF'.green, tools.getPrettyPokemonName(pokemon), 'IN ', gym_name);
              return callback && callback(null, true);
            }
            console.log('DEPLOYMENT FAIL'.res, res);
            return callback && callback(null, false);
          }
        }
      });
    }
    // });
  };


  GymManager.prototype.attackGym = function (gym, battle, input_action, last_retrieved_actions, callback) {
    var that = this;
    console.log('PERFORM ATTACK WITH ACTION'.red, Date.now(), input_action);
    that.pokeio.AttackGym(gym, battle.battle_id, input_action, last_retrieved_actions, function (err, res) {
      // console.log('RES ATTACK GYM'.red, err, res);
      if (err) {
        console.log('THE ATTACK FAILS'.red, err);
        // return callback && callback('ATTACK FAILS');
        return setTimeout(function () {
          that.attackGym(gym, battle, null, null, callback);
        }, 2500);
      }

      var actions = [],
        i, action;
      if (res && res.battle_log) {
        // console.log('Attack Gym Result'.red, err, res.result, 'battle log state', res.battle_log.state, 'battle log type', res.battle_log.battle_type);
        // , res.battle_log
        console.log('battle log srever ms'.yellow, res.battle_log.server_ms.toString());
      }
      if (res.result !== null && res.result !== 1) {
        console.log('Attack Gym Result'.red, res);
      }
      if (res.result === null || res.result === 2) {
        // 
        // return callback && callback('ATTACK FAILS');
        return setTimeout(function () {
          that.attackGym(gym, battle, null, null, callback);
        }, 1065);
      }

      if (res.result === 1) {
        // console.log(res.active_attacker, res.active_defender);
        console.log('attacker'.blue, res.active_attacker.current_health, '/', res.active_attacker.pokemon_data.stamina_max, 'energy', res.active_attacker.current_energy, 'cp', res.active_attacker.pokemon_data.cp);
        if (res.active_defender) {
          console.log('defender'.magenta, res.active_defender.current_health, '/', res.active_defender.pokemon_data.stamina_max, 'energy', res.active_defender.current_energy, 'cp', res.active_defender.pokemon_data.cp);
        }
        if (res.battle_log === 2 || res.battle_log === 3 || res.battle_log === 4) {
          console.log('BATTLE ENDS'.red);
          return callback && callback(null, {
            'state': 'end',
            'data': res
          });
        }

        var serverTime = parseInt(res.battle_log.server_ms.toString(), 10);
        var now = serverTime + 65; // + (i * duration + 65);

        for (i = 0; i < 1; i += 1) {
          var duration = attacks[res.active_attacker.pokemon_data.move_1]['Sec.'] * 1000;
          var energy_delta = attacks[res.active_attacker.pokemon_data.move_1].Energy;
          // return rsub.BattleAction(Type=1, action_start_ms=stime, duration_ms=move_duration, target_index=-1, active_pokemon_id=self.currAttacker, damage_windows_start_timestamp_mss=(stime+move_duration-200), damage_windows_end_timestamp_mss=(stime+move_duration))

          // now += 200 + 200 * i;
          console.log(serverTime, now, 'duration', duration, 'ed', energy_delta);
          action = {
            type: 1,
            action_start_ms: now,
            // action_start_ms: Long.fromValue(now),
            duration_ms: duration,
            target_index: -1,
            // attacker_index: -1,
            // energy_delta: energy_delta,
            // target_pokemon_id: res.active_attacker.pokemon_data.id,
            // active_pokemon_id: parseInt(res.active_defender.pokemon_data.id,toString()),
            damage_windows_start_timestamp_mss: Long.fromValue(now + duration - 200),
            // damage_windows_end_timestamp_mss: Long.fromValue(now + duration)
            // damage_windows_start_timestamp_mss: now + duration - 200,
            // damage_windows_end_timestamp_mss: now + duration
          };
          actions.push(action);
          now += duration + 65;
        }
        // console.log(actions);

        // console.log('BATTLE LOGS ACTIONS'.blue, res.battle_log.battle_actions);

        return setTimeout(function () {
          that.attackGym(gym, battle, actions, res.battle_log.battle_actions[res.battle_log.battle_actions.length - 1], callback);
          // that.attackGym(gym, battle, actions, res.battle_log.battle_actions[0], callback);
        }, 3000);

        // setTimeout(function() {
        //   for (i = 0; i < 1; i += 1) {
        //     action = {
        //       type: 1,
        //       action_start_ms: Date.now() + i * 550,
        //       duration_ms: 500,
        //       target_index: -1
        //     };
        //     that.attackGym(gym, battle, action, function(err) {
        //       if (err) {
        //         return callback && callback({
        //           'state': 'end'
        //         });
        //       }
        //     });
        //   }
        // }, 50);



        // return callback && callback(null, {
        //   'state': 'continue',
        //   'data': res
        // });
      }
    });
  };


  GymManager.prototype.startBattle = function (gym, data, callback) {

    var that = this;
    if (gym === undefined || gym.memberships.length === 0 || gym.Team === null) {
      console.log('IMPOSSIBLE TO START BATTLE'.red);
      // return setTimeout(function () {
      //   that.tryBattleWithGym(gym.fort_data, data, callback);
      // }, 5000);
      return callback && callback('PROBLEM WITH BATTLE');
    }

    var team = gym.team,
      bestPokemons, args, message;

    if (team !== 3) { // 3 = YELLOW
      bestPokemons = that.getListOfBestPokemons(data, 6);
      args = [gym, bestPokemons, gym.memberships[0].pokemon_data];
    } else {
      bestPokemons = that.getListOfBestPokemons(data, 1);
      args = [gym, bestPokemons, gym.memberships[0].pokemon_data];
    }
    // console.log(gym.memberships[0], gym.memberships[0].pokemon_data);

    message = 'Start Gym ' + gym.info.name + ' Battle With ' + bestPokemons.map(tools.getPrettyPokemonName).join(', ');
    console.log(message);
    that.actionHandler.appendAsyncAction({
      m: that.pokeio.StartGymBattle,
      args: args,
      type: 'FIGHT',
      name: message,
      callback: function (err, res) {
        console.log('Start Battle Result'.red, err, res);
        if (res.result === null) {
          return setTimeout(function () {
            that.tryBattleWithGym(gym.fort_data, data, callback);
          }, 5000);
        }
        if (res.result === 1) {
          return that.attackGym(gym, res, null, null, callback);
        }
      }
    });
  };

  GymManager.prototype.tryBattleWithGym = function (f, data, callback) {
    this.evolvingPokemons.FIGHT = true;
    var that = this,
      dist;
    dist = tools.distance(this.pokeio.playerInfo.latitude, this.pokeio.playerInfo.longitude, f.Latitude, f.Longitude);
    console.log('distance to gym is'.green, dist, f);
    if (dist * 1000 < 5) {
      this.getGymDetails(f, function (err, gym) {
        // console.log(err, gym);
        return that.startBattle(gym, data, callback);
      }, true);
    }
  };

  GymManager.prototype.getGymDetails = function (f, callback) {
    var that = this;
    // console.log('GET GYM DETAILS', f);
    this.actionHandler.appendAsyncAction({
      m: that.pokeio.GetGymDetails,
      args: [f],
      silence: true,
      type: 'FIGHT',
      nextAsyncTime: 5050,
      name: 'Get Gym Details ' + f.FortId,
      callback: function (err, res) {
        // console.log('GET GYM DETAILS', err, res);
        if (!res.gym_state) {
          console.log('NO GYM STATE', f.FortId, err, res);
          return callback && callback('NO GYM STATE');
        }
        f.memberships = res.gym_state.memberships;
        f.info = res;
        f.team = res.gym_state.fort_data.Team;
        f.fort_data = res.gym_state.fort_data;
        return callback && callback(null, f);
      }
    });
  };

  GymManager.prototype.isGymInRange = function (f) {
    var dist = tools.distance(this.pokeio.playerInfo.latitude, this.pokeio.playerInfo.longitude, f.Latitude, f.Longitude);
    console.log('DISTANCE TO FORT'.blue, f, dist * 1e3, dist * 1e3 > 5 || f.IsInBattle !== null);
    if (dist * 1e3 > 5 || f.IsInBattle !== null) {
      return false;
    }
    return true;
  };


  GymManager.prototype.addExtraInfoToGym = function (data, f) {
    var that = this,
      dist;

    // dist = tools.distance(this.pokeio.playerInfo.latitude, this.pokeio.playerInfo.longitude, f.Latitude, f.Longitude);
    // console.log('DISTANCE TO FORT'.blue, f, dist * 1e3);
    // if (dist * 1e3 > 5 || f.IsInBattle !== null) {
    //   return;
    // }

    this.actionHandler.appendAsyncAction({
      m: this.pokeio.GetGymDetails,
      args: [f],
      silence: true,
      name: 'Get Gym Details ' + f.FortId,
      callback: function (err, res) {

        console.log(err, res);
        var args = [],
          bestPokemons = [],
          message, team;
        // console.log('GYM DETAILS'.red, err, res);
        // console.log(res.gym_state.memberships);

        if (!res.gym_state) {
          console.log('NO GYM STATE', err, res);
          return;
        }

        // f = res.gym_state.fort_data;
        f.memberships = res.gym_state.memberships;
        f.info = res;

        console.log(f.memberships);

        team = res.gym_state.fort_data.Team;
        // f.memberships = res;

        console.log('Distance With Gym', f.FortId, (dist * 1e3).toFixed(2), 'meters', 'Team Is', team);

        if (team !== 3) { // 3 = YELLOW
          bestPokemons = that.getListOfBestPokemons(data, 6);
          args = [f, bestPokemons, null];
        } else {
          bestPokemons = that.getListOfBestPokemons(data, 1);
          args = [f, bestPokemons, f.memberships[0].pokemon_data];
        }

        // console.log(f, 'bestPokemons', bestPokemons);
        // return;
        message = 'Start Gym ' + f.info.name + ' Battle With ' + bestPokemons.map(tools.getPrettyPokemonName).join(', ');
        console.log(message);
        that.actionHandler.appendAsyncAction({
          m: that.pokeio.StartGymBattle,
          args: args,
          name: message,
          callback: function (err, res) {
            console.log('Start Battle Result'.red, err, res);
          }
        });

      }
    });
  };


  module.exports = GymManager;

}());
