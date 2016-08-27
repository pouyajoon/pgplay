// 25ad87add18548e8bc0d19e79f1c3fef.16


(function() {
  'use strict';

  var GymManager, tools = require('./Tools'),
    myTeam = 3,
    colors = require('colors');


  GymManager = function(pokeio, actionHandler) {
    // console.log('pokeio', typeof pokeio);
    this.pokeio = pokeio;
    this.actionHandler = actionHandler;
  };

  GymManager.prototype.getGymInfo = function() {
    console.log('gym info');
  };

  GymManager.prototype.getListOfBestPokemons = function(data, num) {
    var pokemons = JSON.parse(JSON.stringify(data.pokemons));

    pokemons.filter(function(p){
      return p.stamina === p.stamina_max;
    }).sort(function(a, b) {
      return b.cp - a.cp;
    });
    return pokemons.slice(0, num);
  };


  GymManager.prototype.userMaxFromPoints = function(points) {
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


  GymManager.prototype.isGoodToDeploy = function(gym) {
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

  GymManager.prototype.setDeployGymMissionIfGoodToDeploy = function(fort, callback) {
    return this.isFortGoodToDeploy(fort, callback);
  };

  GymManager.prototype.isUserInGym = function(gym) {
    var user = gym.memberships.find(function(m) {
      return m.trainer_public_profile.name === 'Pouyamonchu2';
    });
    // console.log('isUserInGym'.red, user);
    return user !== undefined;
  };

  GymManager.prototype.isFortGoodToDeploy = function(f, callback) {
    var that = this;
    // console.log('isFortGoodToDeploy', typeof this.getGymDetails);
    this.getGymDetails(f, function(err, gym) {
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

  GymManager.prototype.deployPokemon = function(data, gym, callback) {
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
    if (that.isGymInRange(gym) && gym.Team === myTeam) {
      console.log('CAN GO HERE'.red, gym.Latitude, ',', gym.Longitude, gym.FortId);
      bestPokemons = that.getListOfBestPokemons(data, 6);
      pokemon = bestPokemons[0];
      that.actionHandler.prependAsyncAction({
        m: that.pokeio.FortDeployPokemon,
        args: [gym, pokemon],
        name: 'DEPLOY POKEMON ' + tools.getPrettyPokemonName(pokemon) + ' IN GYM ' + gym_name,
        callback: function(err, res) {
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


  GymManager.prototype.getGymDetails = function(f, callback) {
    var that = this;
    // console.log('GET GYM DETAILS', f);
    this.actionHandler.appendAsyncAction({
      m: that.pokeio.GetGymDetails,
      args: [f],
      silence: true,
      name: 'Get Gym Details ' + f.FortId,
      callback: function(err, res) {
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

  GymManager.prototype.isGymInRange = function(f) {
    var dist = tools.distance(this.pokeio.playerInfo.latitude, this.pokeio.playerInfo.longitude, f.Latitude, f.Longitude);
    console.log('DISTANCE TO FORT'.blue, f, dist * 1e3);
    if (dist * 1e3 > 5 || f.IsInBattle !== null) {
      return false;
    }
    return true;
  };


  GymManager.prototype.addExtraInfoToGym = function(data, f) {
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
      callback: function(err, res) {

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
          callback: function(err, res) {
            console.log('Attack Gym Result'.red, err, res);
          }
        });

      }
    });
  };


  module.exports = GymManager;

}());
