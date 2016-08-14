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

    pokemons.sort(function(a, b) {
      return b.cp - a.cp;
    });
    return pokemons.slice(0, num);
  };


  GymManager.prototype.deployPokemon = function(data, f, callback) {
    var that = this;
    this.getGymDetails(f, function(err, gym) {
      if (err) {
        console.error('deployPokemon', err);
        return callback && callback(err);
      }
      var max_users, bestPokemons, points = 0,
        pokemon;
      if (gym.fort_data && gym.fort_data.GymPoints) {
        points = parseInt(gym.fort_data.GymPoints.toString(), 10);
      }
      max_users = Math.round(points / 2000);
      console.log('TRY DEPLOY POKEMON IN GYM'.blue, gym.info.name, 'MAX USERS', max_users, 'TEAM', gym.team, 'CURRENT USERS', gym.memberships.length, 'POINTS', points);

      if (that.isGymInRange(gym) && (gym.team === myTeam && gym.memberships.length < max_users) || gym.memberships.length === 0) {
        console.log(gym.fort_data);
        console.log('CAN GO HERE'.red, gym.info.name, gym.Latitude, ',', gym.Longitude, gym.FortId);
        bestPokemons = that.getListOfBestPokemons(data, 6);
        pokemon = bestPokemons[0];
        that.actionHandler.prependAsyncAction({
          m: that.pokeio.FortDeployPokemon,
          args: [gym, pokemon],
          name: 'DEPLOY POKEMON ' + tools.getPrettyPokemonName(pokemon) + ' IN GYM ' + gym.info.name,
          callback: function(err, res) {
            console.log('END DEPLOY', gym.info.name, err, res);
            if (!err) {
              console.log('SUCCESS FULL DEPLOYMENT OF'.green, tools.getPrettyPokemonName(pokemon), 'IN ', gym.info.name);
            }
          }
        });
      }
    });
  };


  GymManager.prototype.getGymDetails = function(f, callback) {
    var that = this;
    this.actionHandler.appendAsyncAction({
      m: that.pokeio.GetGymDetails,
      args: [f],
      name: 'Get Gym Details ' + f.FortId,
      callback: function(err, res) {
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

    dist = tools.distance(this.pokeio.playerInfo.latitude, this.pokeio.playerInfo.longitude, f.Latitude, f.Longitude);
    console.log('DISTANCE TO FORT'.blue, f, dist * 1e3);
    if (dist * 1e3 > 5 || f.IsInBattle !== null) {
      return;
    }

    this.actionHandler.appendAsyncAction({
      m: this.pokeio.GetGymDetails,
      args: [f],
      name: 'Get Gym Details ' + f.FortId,
      callback: function(err, res) {

        console.log(res);
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
