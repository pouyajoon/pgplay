(function() {
  'use strict';


  var AsyncActionHandler = function(pokeio, evolvingPokemons) {
    this.asyncActionList = [];
    this.parkedAsyncActionList = [];

    this.evolvingPokemons = evolvingPokemons;
    this.pokeio = pokeio;

    this.executeAsyncActionList();
  };

  AsyncActionHandler.prototype.flushParkedList = function() {
    this.asyncActionList = this.asyncActionList.concat(this.parkedAsyncActionList);
    this.parkedAsyncActionList = [];
  };

  AsyncActionHandler.prototype.setupNextAsyncCall = function(nextAsyncTime) {
    var nextTimeMin = nextAsyncTime || 500;
    setTimeout(this.executeAsyncActionList.bind(this), nextTimeMin + Math.floor(Math.random() * 200) + 1);
  };

  AsyncActionHandler.prototype.appendAsyncAction = function(action) {
    if (this.evolvingPokemons.FIGHT !== undefined && action.type !== 'FIGHT') {
      // console.log('FIGHT'.red, 'ESCAPE', action.name);
      return;
    }
    if (['EVOLVE', 'FIGHT'].indexOf(action.type) === -1 && Object.keys(this.evolvingPokemons).length > 0) {
      if (action.type === 'MOVE') {
        console.log('Park Action For Later', action.name);
        this.parkedAsyncActionList.push(action);
      }
      return console.log('Evolving Right Now ... Escape ' + action.name);
    }
    this.asyncActionList.push(action);
  };

  AsyncActionHandler.prototype.prependAsyncAction = function(action) {
    if (this.evolvingPokemons.FIGHT !== undefined && action.type !== 'FIGHT') {
      // console.log('FIGHT'.red, 'ESCAPE', action.name, this.evolvingPokemons);
      return;
    }
    if (Object.keys(this.evolvingPokemons).length > 0) {
      return console.log('Evolving Right Now ... Escape ' + action.name);
    }
    this.asyncActionList.unshift(action);
  };

  AsyncActionHandler.prototype.executeAsyncActionList = function() {
    var action, args, that = this;
    if (this.asyncActionList.length) {
      action = this.asyncActionList.shift();
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
        that.setupNextAsyncCall(action.nextAsyncTime);
      });
      if (action.silence === true) {
        process.stdout.write('.');
      } else {
        console.log('APPLY ASYNC'.cyan, this.asyncActionList.length, action.name);
      }
      action.m.apply(this.pokeio, action.args);
    } else {
      this.setupNextAsyncCall();
    }
  };

  module.exports = AsyncActionHandler;

}());
