var Pokeio = require('./Pokemon-GO-node-api/poke.io.js');

var loc = {
	type: 'name',
	name: 'Paris'
};

var pos_lat = 48.871146;
var pos_lon = 2.330233;

var scribe5 = {
	type: 'coords',
	coords: {
		latitude: pos_lat,
		longitude: pos_lon,
		altitude: 0
	}
};

var current_pos = scribe5;

var pokeio = new Pokeio.Pokeio();
var profile, pokemons = [],
	all_pokemons = {},
	data = {
		forts: [],
		cforts: [],
		cdownforts: []
	};



function setupExpress() {
	var express = require('express');
	var app = express();
	var http = require('http').Server(app);
	var io = require('socket.io')(http);

	app.get('/', function(req, res) {
		res.send('<h1>Hello world</h1>');
	});

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
			return callback({
				all: pokeio,
				all_pokemons: all_pokemons,
				info: pokeio.playerInfo,
				profile: profile,
				pokemons: pokemons,
				data: data
			});
		});
	});
}

function distance(lat1, lon1, lat2, lon2) {
	// console.log('distance', lat1, lat2, lon1, lon2);
	// lat1 = parseFloat(lat1);
	// lon1 = parseFloat(lon1);
	// lat2 = parseFloat(lat2);
	// lon2 = parseFloat(lon2);

	var p = 0.017453292519943295; // Math.PI / 180

	var a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 +
		Math.cos(lat1 * p) * Math.cos(lat2 * p) *
		(1 - Math.cos((lon2 - lon1) * p)) / 2;
	// console.log('calc', a, Math.cos((lat2 - lat1) * p), lat2 - lat1, lat2, lat1, Math.cos(lat1 * p) * Math.cos(lat2 * p), (1 - Math.cos((lon2 - lon1) * p)) / 2, 12742 * Math.asin(Math.sqrt(a)));
	return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}

// function distance(lat1,lon1,lat2,lon2) {
//   var R = 6371; // Radius of the earth in km
//   var dLat = deg2rad(lat2-lat1);  // deg2rad below
//   var dLon = deg2rad(lon2-lon1); 
//   var a = 
//     Math.sin(dLat/2) * Math.sin(dLat/2) +
//     Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
//     Math.sin(dLon/2) * Math.sin(dLon/2)
//     ; 
//   var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
//   var d = R * c; // Distance in km
//   return d;
// }

// function deg2rad(deg) {
//   return deg * (Math.PI/180)
// }

pokeio.init('pouyapokemon', 'pokemonGO', current_pos, 'google', function(err) {
	console.error(err);

	pokeio.pokemonlist.forEach(function(p) {
		all_pokemons[p.id] = p;
	})

	function getProfile() {
		pokeio.GetProfile(function(err, p) {
			// console.log(p);
			profile = p;

		});
	}

	function getInventory() {
		pokeio.GetInventory(function(err, inventory) {
			var p;
			// console.log('get invetenory', err, inventory);
			inventory.inventory_delta.inventory_items.forEach(function(i) {
				p = i.inventory_item_data.pokemon;
				if (p !== null && p.is_egg === null) {
					pokemons.push(p);
				}
			})
			pokemons = pokemons.sort(function(a, b) {
				return a.pokemon_id - b.pokemon_id;
			});
			pokemons.forEach(function(p) {
				p.reference = all_pokemons[p.pokemon_id];
			})

			setupExpress();
		});

	}

	function getForts() {
		pokeio.Heartbeat(function(err, hb) {
			if (err) {
				console.log(err);
			}
			hb.cells.forEach(function(o) {
				if (o.Fort.length > 0) {
					data.forts = data.forts.concat(o.Fort);
					o.Fort.forEach(function(f) {
						var dist = distance(current_pos.coords.latitude, current_pos.coords.longitude, f.Latitude, f.Longitude);
						// console.log(f.FortId, f.FortType, f.Enabled, dist, current_pos.coords.latitude, current_pos.coords.longitude, f.Latitude, f.Longitude);
						console.log(f.FortId, f.FortType, f.Enabled, dist);

						if (dist < 0.02) {
							data.cforts.push(f);
						}
						if (f.CooldownCompleteMs !== null){
							data.cdownforts.push(f);
						}
					})
				}
			});
			console.log(data.forts.length);
		});
	}

	// getProfile();
	getInventory();
	getForts();


});