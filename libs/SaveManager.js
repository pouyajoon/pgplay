(function() {
  'use strict';

  exports.SaveManager = (function() {

    var value = {},
      fileName = 'save.json',
      startTime = Date.now(),
      fs = require('fs'),
      moment = require('moment'),
      colors = require('colors'),
      boomTime = 8 + Math.floor(Math.random() * 3) + 1;

    function save() {
      fs.writeFileSync(fileName, JSON.stringify(value, null, 2), 'utf8');
    }


    function handleBoomMode() {
      setInterval(function() {
        var diff = moment().diff(startTime, 'minutes');
        console.log('CHECK BOOM TIMER'.magenta, diff, 'minutes', 'WAITING', boomTime, 'minutes');
        if (diff >= boomTime) {
          console.log('BOOM RESET WORLD'.red);
          throw new Error('BOOM BOOM');
        }
      }, 30 * 1e3);
    }

    function load() {
      try {
        fs.accessSync(fileName, fs.F_OK);
        var content = fs.readFileSync(fileName, 'utf8');
        value = JSON.parse(content);
      } catch (e) {
        init();
      }
      handleBoomMode();
    }

    function updatePosition(position) {
      var currentPosition = {
        lat: position.lat,
        lng: position.lng
      };
      value.currentPosition = currentPosition;
      save();
    }

    function updateDestination(destination) {
      value.destination = {
        lat: destination.lat,
        lng: destination.lng
      };
      save();
    }

    function init() {
      console.log('init save manager');
      value = {};
    }

    function getPosition() {
      return value.currentPosition;
    }

    function getDestination() {
      return value.destination;
    }

    function getPGPosition() {
      var position = getPosition();
      if (position) {
        return {
          type: 'coords',
          coords: {
            latitude: position.lat,
            longitude: position.lng,
            altitude: 0
          }
        };
      }
    }

    function extendBoomTime(extendTime) {
      boomTime += extendTime;
    }


    return {
      updatePosition: updatePosition,
      updateDestination: updateDestination,
      load: load,
      init: init,
      getPosition: getPosition,
      getPGPosition: getPGPosition,
      getDestination: getDestination,
      extendBoomTime: extendBoomTime
    };
  }());
}());
