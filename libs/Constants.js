(function() {
  'use strict';

  var constants = {};

  constants.candidateForEvolution = {
    10: 12,
    13: 12,
    16: 12,
    19: 25,
    21: 50,
    41: 50,
    60: 25
  };

  constants.inventoryItemTypes = {
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

  constants.inventoryItemTypesMax = {};
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_POKE_BALL] = 25;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_GREAT_BALL] = 75;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_ULTRA_BALL] = 100;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_MASTER_BALL] = 100;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_POTION] = 5;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_SUPER_POTION] = 10;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_HYPER_POTION] = 10;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_MAX_POTION] = 50;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.ITEM_REVIVE] = 10;
  constants.inventoryItemTypesMax[constants.inventoryItemTypes.RAZZ_BERRY] = 15;

  constants.maximunPokemonsStorage = {
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
    66: 3,
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
    100: 2,
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
    133: 6, //evoli,
    138: 2,
    140: 2,
    147: 2
  };

  function Random(value, length) {
    this.value = value;
    this.length = length;
  }

  Random.prototype.getRandom = function() {
    return this.value + Math.floor(Math.random() * this.length) + 1;
  };


  constants.step_distance_meter = new Random(2.5, 0.8);
  constants.walking_interval = new Random(800, 400);

  exports.constants = constants;


}());
