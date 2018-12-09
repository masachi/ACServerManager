var express = require('express');
var fs = require('fs');
var copyFileSync = require('fs-copy-file-sync'); // shim in case user has node < v8.5.0
var ini = require('ini');
var multiLine = require('multi-ini');
var bodyParser = require('body-parser');
var childProcess = require('child_process');
var basicAuth = require('basic-auth-connect');
var jsonfile = require('jsonfile');
var util = require('util');
var uuidv4 = require('uuid/v4');
var extend = require('node.extend');
var multer = require('multer');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var _ = require('lodash');

var settings = require('./settings');

var username = settings.username;
var password = settings.password;

var sTrackerPath = buildSTrackerPath(settings.sTrackerPath);
var serverPath = buildServerPath(settings.serverPath);
var contentPath = buildContentPath(serverPath);

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Each uploaded track/car users unique uuidv4 set for request
        var uploadDir = './uploads/' + req.uuid;
        req.uploadDir = uploadDir;
        mkdirp.sync(uploadDir);
        cb(null, uploadDir);
    }
});
var upload = multer({
    storage: storage
});

var isRunningOnWindows = /^win/.test(process.platform);

var acServerStatus = 0;
var sTrackerServerStatus = 0;
var acServerPid;
var sTrackerServerPid;
var acServerLogName;
var acServerLog = [];

var currentSession;
var modTyres;

try {
	var config =  multiLine.read(serverPath + 'cfg/server_cfg.ini', {encoding: 'utf8'});
	var entryList =  multiLine.read(serverPath + 'cfg/entry_list.ini', {encoding: 'utf8'});
	var ksTyres =  multiLine.read(serverPath + 'manager/ks_tyres.ini', {encoding: 'utf8'});
} catch (e) {
	console.log('Error - ' + e);
}

fs.exists(serverPath + 'manager/mod_tyres.ini', function (exists) {
	try {
		if (exists) {
			modTyres = ini.parse(fs.readFileSync(serverPath + 'manager/mod_tyres.ini', 'utf-8'));
		}
	} catch (e) {
		console.log('Error - ' + e);
	}
});

function saveConfig() {
	try {
		fs.writeFileSync(serverPath + 'cfg/server_cfg.ini', ini.stringify(config).replace(/\\/gi,''));
	} catch (e) {
		console.log('Error - ' + e);
	}
}

function saveEntryList() {
	try {
		fs.writeFileSync(serverPath + 'cfg/entry_list.ini', ini.stringify(entryList).replace(/\\/gi,''));
	} catch (e) {
		console.log('Error - ' + e);
	}
}

function saveModTyres() {
    try {
        fs.writeFileSync(serverPath + 'manager/mod_tyres.ini', ini.stringify(modTyres).replace(/\\/gi, ''));
    } catch (e) {
        console.log('Error - ' + e);
    }
}

function getDirectories(srcpath) {
	try {
		return fs.readdirSync(srcpath).filter(function (file) {
			return fs.statSync(srcpath + '/' + file).isDirectory();
		});
	} catch (e) {
		console.log('Error - ' + e);
	}
}

function getDateTimeString() {
	try {
		var d = new Date();
		return d.getFullYear() + ('0' + d.getMonth()).slice(-2) + ('0' + d.getDate()).slice(-2) + '_' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2);
	} catch (e) {
		console.log('Error - ' + e);
	}
}

function writeLogFile(filename, message) {
	try {
		fs.appendFile(__dirname + '/logs/' + filename, message + '\r\n', function (err) {});
	} catch (e) {
		console.log('Error - ' + e);
	}
}

function updateServerLog(message) {
    acServerLog = _.takeRight(_.concat(acServerLog, message), 2000);
}

function buildSTrackerPath(sTrackerPath) {
	if (sTrackerPath && sTrackerPath !== '') {
		if(sTrackerPath.substr(-1) !== '/'){
			sTrackerPath = sTrackerPath + '/';
		}
	}
	return sTrackerPath;
}

function buildServerPath(serverPath) {
	if(serverPath.substr(-1) !== '/'){
		serverPath = serverPath + '/';
	}
	return serverPath;
}

function buildContentPath(serverPath) {
	var contentPath = serverPath + 'content';
	if (settings.contentPath && settings.contentPath !== '') {
		contentPath = settings.contentPath;
		if(contentPath.substr(-1) === '/') {
			contentPath = contentPath.substring(0, contentPath.length - 1);
		}
	}
	return contentPath;
}

function checkLocalContentPath(contentPath) {
	if(settings.useLocalContent === 'true'){
		contentPath = 'frontend/content';
	}
	return contentPath;
}

function removeSlashes(str) {
    var newStr = str;
    while (newStr.search('/') != -1) {
        newStr = newStr.replace('/', '');
    }
    return newStr;
}

var app = express();
if (username !== '' && password !== '') {
	app.use(basicAuth(username, password));
}
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", settings.url + ":" + settings.port);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(function (req, res, next) {
    req.uuid = uuidv4();
    next();
});
app.use(bodyParser.json());
app.use(express.static(__dirname + '/frontend'));

// get complete configuration
app.get('/api', function (req, res) {
	try {
		res.status(200);
		res.send(config);
	} catch (e) {
		console.log('Error: GET/api - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get server config
app.get('/api/server', function (req, res) {
	try {
		res.status(200);
		res.send(config.SERVER);
	} catch (e) {
		console.log('Error: GET/api/server - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get server status
app.get('/api/server/status', function (req, res) {
	try {
		res.status(200);
		res.send({
            session: currentSession,
            log: _.join(acServerLog, '')
        });
	} catch (e) {
		console.log('Error: GET/api/server/status - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get server config by id
app.get('/api/server/:id', function (req, res) {
	try {
		res.status(200);
		res.send({ value: config.SERVER[req.params.id.toUpperCase()] });
	} catch (e) {
		console.log('Error: GET/api/server/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post new server config
app.post('/api/server', function (req, res) {
	try {
		for (var param in req.body) {
			config.SERVER[param.toUpperCase()] = req.body[param];
		}

		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/server - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post server config by id
app.post('/api/server/:id', function (req, res) {
	try {
		config.SERVER[req.params.id.toUpperCase()] = req.body.value;
		saveConfig();
		res.status(200);
		res.send('OK');
	}
	catch (e) {
		console.log('Error: POST/api/server/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get booking config
app.get('/api/book', function (req, res) {
	try {
		res.status(200);
		res.send(config.BOOK);
	} catch (e) {
		console.log('Error: GET/api/book - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get booking config by id
app.get('/api/book/:id', function (req, res) {
	try {
		res.status(200);
		res.send(config.BOOK[req.params.id.toUpperCase()]);
	} catch (e) {
		console.log('Error: GET/api/book/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post new booking config
app.post('/api/book', function (req, res) {
	try {
		if (!Object.keys(req.body).length) {
			if (config.BOOK) {
				delete config.BOOK;
			}
		} else {
			if (config.BOOK === undefined) {
				config.BOOK = {};
			}
			for (var param in req.body) {
				config.BOOK[param.toUpperCase()] = req.body[param];
			}
		}

		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/book/ - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post booking config by id
app.post('/api/book/:id', function (req, res) {
	try {
		config.BOOK[req.params.id.toUpperCase()] = req.body.value;
		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/book/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get practice config
app.get('/api/practice', function (req, res) {
	try {
		res.status(200);
		res.send(config.PRACTICE);
	} catch (e) {
		console.log('Error: GET/api/practice - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get practice config by id
app.get('/api/practice/:id', function (req, res) {
	try {
		res.status(200);
		res.send(config.PRACTICE[req.params.id.toUpperCase()]);
	} catch (e) {
		console.log('Error: GET/api/practice/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post new practice config
app.post('/api/practice', function (req, res) {
	try {
		if (!Object.keys(req.body).length) {
			if (config.PRACTICE) {
				delete config.PRACTICE;
			}
		} else {
			if (config.PRACTICE === undefined) {
				config.PRACTICE = {};
			}
			for (var param in req.body) {
				config.PRACTICE[param.toUpperCase()] = req.body[param];
			}
		}

		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/practice - ' + e);
		res.status(500);
		res.send('Application error');
	}

});

// post practice config by id
app.post('/api/practice/:id', function (req, res) {
	try {
		config.PRACTICE[req.params.id.toUpperCase()] = req.body.value;
		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/practice/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get qualify config
app.get('/api/qualify', function (req, res) {
	try {
		res.send(config.QUALIFY);
	} catch (e) {
		console.log('Error: GET/api/qualify - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get qualify config by id
app.get('/api/qualify/:id', function (req, res) {
	try {
		res.status(200);
		res.send(config.QUALIFY[req.params.id.toUpperCase()]);
	} catch (e) {
		console.log('Error: GET/api/qualify/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}

});

// post new qualify config
app.post('/api/qualify', function (req, res) {
	try {
		if (!Object.keys(req.body).length) {
			if (config.QUALIFY) {
				delete config.QUALIFY;
			}
		} else {
			if (config.QUALIFY === undefined) {
				config.QUALIFY = {};
			}
			for (var param in req.body) {
				config.QUALIFY[param.toUpperCase()] = req.body[param];
			}
		}

		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/qualify - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post qualify config
app.post('/api/qualify/:id', function (req, res) {
	try {
		config.QUALIFY[req.params.id.toUpperCase()] = req.body.value;
		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/qualify/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get race config
app.get('/api/race', function (req, res) {
	try {
		res.status(200);
		res.send(config.RACE);
	} catch (e) {
		console.log('Error: GET/api/race - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get race config by id
app.get('/api/race/:id', function (req, res) {
	try {
		res.send(config.RACE[req.params.id.toUpperCase()]);
	} catch (e) {
		console.log('Error: GET/api/race/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post new race config
app.post('/api/race', function (req, res) {
	try {
		if (!Object.keys(req.body).length) {
			if (config.RACE) {
				delete config.RACE;
			}
		} else {
			if (config.RACE === undefined) {
				config.RACE = {};
			}
			for (var param in req.body) {
				config.RACE[param.toUpperCase()] = req.body[param];
			}
		}

		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/race - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post race config by id
app.post('/api/race/:id', function (req, res) {
	try {
		config.RACE[req.params.id.toUpperCase()] = req.body.value;
		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/race/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get dynamictrack config
app.get('/api/dynamictrack', function (req, res) {
	try {
		res.status(200);
		res.send(config.DYNAMIC_TRACK);
	} catch (e) {
		console.log('Error: GET/api/dynamictrack - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get dynamictrack config by id
app.get('/api/dynamictrack/:id', function (req, res) {
	try {
		res.status(200);
		res.send(config.DYNAMIC_TRACK[req.params.id.toUpperCase()]);
	} catch (e) {
		console.log('Error: GET/api/dynamictrack/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post dynamictrack config
app.post('/api/dynamictrack', function (req, res) {
	try {
		if (!Object.keys(req.body).length) {
			if (config.DYNAMIC_TRACK) {
				delete config.DYNAMIC_TRACK;
			}
		} else {
			if (config.DYNAMIC_TRACK === undefined) {
				config.DYNAMIC_TRACK = {};
			}
			for (var param in req.body) {
				config.DYNAMIC_TRACK[param.toUpperCase()] = req.body[param];
			}
		}

		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/dynamictrack - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post track dynamictrack config by id
app.post('/api/dynamictrack/:id', function (req, res) {
	try {
		config.DYNAMIC_TRACK[req.params.id.toUpperCase()] = req.body.value;
		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/dynamictrack/:id - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get weather config
app.get('/api/weather', function (req, res) {
	try {
		var weather = [];

		Object.keys(config).forEach(function (key) {
			if (key.indexOf('WEATHER_') === 0) {
				weather.push(config[key]);
			}
		});

		res.status(200);
		res.send(weather);
	} catch (e) {
		console.log('Error: GET/api/weather - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post weather config
app.post('/api/weather', function (req, res) {
	try {
		Object.keys(config).forEach(function (key) {
			if (key.indexOf('WEATHER_') === 0) {
				delete config[key];
			}
		});

		for (var param in req.body) {
			config['WEATHER_' + param] = req.body[param];
		}

		saveConfig();
		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/weather - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get tracks available on server
app.get('/api/tracks', function (req, res) {
	try {
		contentPath = checkLocalContentPath(contentPath);
		var trackNames = fs.readdirSync(contentPath + '/tracks');
		var tracks = [];

		for (var trackName in trackNames) {
			var track = {
				name: trackNames[trackName]
			};

			try {
				var configs = getDirectories(contentPath + '/tracks/' + trackNames[trackName] + '/ui');
				track.configs = configs;
			}
			catch (e) {
				console.log('Track not found: ' + trackName);
			}

			tracks.push(track);
		}

		res.status(200);
		res.send(tracks);
	} catch (e) {
		console.log('Error: GET/api/tracks - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get track
app.get('/api/tracks/:track', function (req, res) {
	try {
		contentPath = checkLocalContentPath(contentPath);
		var trackDetails = fs.readFileSync(contentPath + '/tracks/' + req.params.track + '/ui/ui_track.json', 'utf-8');
		res.status(200);
		res.send(trackDetails);
	} catch (e) {
		console.log('Error: GET/api/tracks/:track - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// remove existing track
app.delete('/api/tracks/:track', function (req, res) {
    try {
        var track = removeSlashes(req.params.track);
        var serverTrackPath = serverPath + 'content/tracks/' + track;
        var contentTrackPath = checkLocalContentPath(contentPath) + '/tracks/' + track;
        rimraf.sync(serverTrackPath);
        rimraf.sync(contentTrackPath);
        res.status(200);
        res.send('OK');
    } catch (e) {
        console.log('Error: DELETE/api/track/:track - ' + e);
        res.status(500);
        res.send('Application error');
    }
});

// get track image
app.get('/api/tracks/:track/image', function (req, res) {
	try {
		contentPath = checkLocalContentPath(contentPath);
		var image = fs.readFileSync(contentPath + '/tracks/' + req.params.track + '/ui/preview.png');
		res.status(200);
		res.contentType('image/jpeg');
		res.send(image);
	} catch (e) {
		console.log('Error: GET/api/tracks/:track/image - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get track config
app.get('/api/tracks/:track/:config', function (req, res) {
	try {
		contentPath = checkLocalContentPath(contentPath);
		var trackDetails = fs.readFileSync(contentPath + '/tracks/' + req.params.track + '/ui/' + req.params.config + '/ui_track.json', 'utf-8');
		res.status(200);
		res.send(trackDetails);
	} catch (e) {
		console.log('Error: GET/api/tracks/:track/:config - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get track config image
app.get('/api/tracks/:track/:config/image', function (req, res) {
	try {
		contentPath = checkLocalContentPath(contentPath);
		var image = fs.readFileSync(contentPath + '/tracks/' + req.params.track + '/ui/' + req.params.config + '/preview.png');
		res.status(200);
		res.contentType('image/jpeg');
		res.send(image);
	} catch (e) {
		console.log('Error: GET/api/tracks/:track/:config/image - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

function copyTrack(serverTrackPath, contentTrackPath, surfaces, drs_zones, preview, ui_track) {
    mkdirp.sync(serverTrackPath);
    mkdirp.sync(contentTrackPath);
    copyFileSync(surfaces.path, serverTrackPath + 'surfaces.ini');
    if (drs_zones !== null && drs_zones !== undefined) {
        copyFileSync(drs_zones.path, serverTrackPath + 'drs_zones.ini');
    }
    copyFileSync(preview.path, contentTrackPath + 'preview.png');
    copyFileSync(ui_track.path, contentTrackPath + 'ui_track.json');
}

function addSingleLayoutTrack(track) {
    var serverTrackPath = serverPath + 'content/tracks/' + track.name + '/data/';
    var contentTrackPath = checkLocalContentPath(contentPath) + '/tracks/' + track.name + '/ui/';
    copyTrack(serverTrackPath,
              contentTrackPath,
              track.layouts[0].surfaces,
              track.layouts[0].drs_zones,
              track.layouts[0].preview,
              track.layouts[0].ui_track);
}

function addMultiLayoutTrack(track) {
    var serverTrackPath = serverPath + 'content/tracks/' + track.name + '/';
    var contentTrackPath = checkLocalContentPath(contentPath) + '/tracks/' + track.name + '/ui/';

    _.forEach(track.layouts, function(layout) {
        var serverLayoutPath = serverTrackPath + layout.name + '/data/';
        var contentLayoutPath = contentTrackPath + layout.name + '/';
        copyTrack(serverLayoutPath,
                  contentLayoutPath,
                  layout.surfaces,
                  layout.drs_zones,
                  layout.preview,
                  layout.ui_track);
    });
}

// store uploaded file for track
app.post('/api/tracks', upload.any(), function (req, res) {
    try {
        var track = {
            name: removeSlashes(req.body.track.name),
            layouts: _.map(req.body.track.layouts, function(layout) {
                if (layout.name === 'null') {
                    layout.name = null;
                } else {
                    layout.name = removeSlashes(layout.name);
                }
                return layout;
            })
        };
        _.forEach(req.files, function(file) {
            var parts = _.split(file.fieldname, '][');
            var idx = _.parseInt(parts[1]);
            var key = parts[2].substr(0, parts[2].length - 1);
            track.layouts[idx][key] = file;
        });

        if (track.layouts.length > 1) {
            addMultiLayoutTrack(track);
        } else if (track.layouts.length === 1) {
            addSingleLayoutTrack(track);
        } else {
            throw 'Invalid layouts for track';
        }

        rimraf.sync('./uploads/' + req.uuid);
        res.status(200);
        res.send('OK');
    } catch (e) {
        console.log('Error: POST/api/tracks/new - ' + e);
        res.status(500);
        res.send('Application error');
    }
});

// get cars available on server
app.get('/api/cars', function (req, res) {
	try {
		contentPath = buildContentPath(serverPath);
		var cars = fs.readdirSync(contentPath + '/cars');
		res.status(200);
		res.send(cars);
	} catch (e) {
		console.log('Error: GET/api/cars - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

function mkdirCarSkins(car) {
    var skinPath = checkLocalContentPath(contentPath) + '/cars/' + car.name + '/skins/';
    _.forEach(car.skins, function(skin) {
        mkdirp.sync(skinPath + skin);
    });
}

function modifyCarModTyres(car) {
    if (!modTyres) {
        modTyres = {};
    }
    var carTyres = ini.parse(car.mod_tyres);
    if (carTyres[car.name] !== null && carTyres[car.name] !== undefined) {
        modTyres[car.name] = carTyres[car.name];
        saveModTyres();
    }
}

function copyCarFiles(serverCarPath, files) {
    mkdirp.sync(serverCarPath);
    _.forEach(files, function(file) {
        copyFileSync(file.path, serverCarPath + file.originalname);
    });
}

// add new car
app.post('/api/cars', upload.any(), function (req, res) {
    try {
        var car = {
            name: removeSlashes(req.body.car.name),
            mod_tyres: req.body.car.mod_tyres,
            skins: _.map(req.body.car.skins, removeSlashes)
        };
        var files = _.groupBy(req.files, function(value) {
            return value.fieldname.split('][')[0].substr(4);
        });
        var singleDataFile = false;
        if (files.data.length === 0) {
            throw 'No data files with car';
        } else if (files.data.length === 1) {
            if (files.data[0].originalname !== 'data.acd') {
                throw 'No data.acd file with car';
            }
            singleDataFile = true;
        }
        car.data = files.data;

        mkdirCarSkins(car);
        modifyCarModTyres(car);
        var serverCarPath = serverPath + 'content/cars/' + car.name + '/';
        if (singleDataFile) {
            copyCarFiles(serverCarPath, car.data);
        } else {
            copyCarFiles(serverCarPath + 'data/', car.data);
        }

        rimraf.sync('./uploads/' + req.uuid);
        res.status(200);
        res.send('OK');
    } catch (e) {
        console.log('Error: POST/api/cars - ' + e);
        res.status(500);
        res.send('Application error');
    }
});

// get car skin
app.get('/api/cars/:car', function (req, res) {
	try {
		var skins = {}
		try {
			var skins = fs.readdirSync(contentPath + '/cars/' + req.params.car + '/skins');
		}
		catch (e) {
			console.log('Car not found: ' + req.params.car);
		}

		res.status(200);
		res.send({ skins: skins });
	} catch (e) {
		console.log('Error: GET/api/cars/:car - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// remove existing car
app.delete('/api/cars/:car', function (req, res) {
    try {
        var car = removeSlashes(req.params.car);
        var serverCarPath = serverPath + 'content/cars/' + car;
        var contentCarPath = checkLocalContentPath(contentPath) + '/cars/' + car;
        if (modTyres) {
            modTyres = _.omit(modTyres, car);
            saveModTyres();
        }
        rimraf.sync(serverCarPath);
        rimraf.sync(contentCarPath);
        res.status(200);
        res.send('OK');
    }
    catch (e) {
		console.log('Error: DELETE/api/cars/:car - ' + e);
		res.status(500);
		res.send('Application error');
    }
});

// get entry list
app.get('/api/entrylist', function (req, res) {
	try {
		res.status(200);
		res.send(entryList);
	} catch (e) {
		console.log('Error: GET/api/entrylist - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post entry list
app.post('/api/entrylist', function (req, res) {
	try {
		var newEntryList = {};

		for (var param in req.body) {
			newEntryList[param.toUpperCase()] = req.body[param];
		}
		entryList = newEntryList;
		saveEntryList();
	}
	catch (e) {
		console.log('Error: POST/api/entrylist - ' + e);
		res.status(500);
		res.send('Application error')
	}

	res.status(200);
	res.send('OK');
});

// get drivers
app.get('/api/drivers', function (req, res) {
	try {
		var drivers = [];

		jsonfile.readFile(__dirname + '/drivers.json', function (err, data) {
			if (!err) {
				drivers = data;
			}

			res.status(200);
			res.send(drivers)
		});
	}
	catch (e) {
		console.log('Error: GET/api/drivers - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post drivers
app.post('/api/drivers', function (req, res) {
	try {
		var drivers = [];
		var driver = {};
		for (var param in req.body) {
			driver[param.toUpperCase()] = req.body[param];
		}

		jsonfile.readFile(__dirname + '/drivers.json', function (err, data) {
			if (!err) {
				drivers = data;
			}

			drivers.push(driver);

			jsonfile.writeFile(__dirname + '/drivers.json', drivers, function (err) {
				if (err) {
					console.error(err);
					throw err;
				}
			});
		});
	}
	catch (e) {
		console.log('Error: POST/api/drivers - ' + e);
		res.status(500);
		res.send('Application error');
	}

	res.status(200);
	res.send('OK');
});

// delete driver by guid
app.delete('/api/drivers/:guid', function (req, res) {
	try {
		var guid = req.params.guid;
		if (!guid) {
			throw 'GUID not provided';
		}

		jsonfile.readFile(__dirname + '/drivers.json', function (err, data) {
			if (err) {
				throw err;
			}

			var found = data.filter(function (item) {
				return item.GUID == guid;
			});

			if (found) {
				for (i = 0; i < found.length; i++) {
					data.splice(data.indexOf(found[i]), 1);
				}

				jsonfile.writeFile(__dirname + '/drivers.json', data, function (err) {
					if (err) {
						console.error('Error - ' + err);
						throw err;
					}
				});
			}
		});
	}
	catch (e) {
		console.log('Error: DELETE/api/drivers - ' + e);
		res.status(500);
		res.send('Application error');
		return;
	}

	res.status(200);
	res.send('OK');
});

// get tyres for cars
app.get('/api/tyres', function (req, res) {
	try {
		var result = ksTyres;
		if (modTyres) {
			result = extend(ksTyres, modTyres)
		}

		if (req.query.cars) {
			var cars = req.query.cars.split(',');
			var filtered = {};
			for (var car in cars) {
				if (result[cars[car]]) {
					filtered[cars[car]] = result[cars[car]];
				}
			}
			result = filtered;
		}

		res.status(200);
		res.send(result)
	}
	catch (e) {
		console.log('Error: GET/api/tyres - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get acserver status
app.get('/api/acserver/status', function (req, res) {
	try {
		res.status(200);
        res.send({ status: acServerStatus });
	} catch (e) {
		console.log('Error: GET/api/acserver/status - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// start acserver process
app.post('/api/acserver', function (req, res) {
	try {
		console.log('OS is ' + process.platform);
		var acServer = undefined;

		if (isRunningOnWindows) {
			console.log('Starting Windows Server');
			acServer = childProcess.spawn('acServer.exe', { cwd: serverPath });
		} else {
			console.log('Starting Linux Server');
			acServer = childProcess.spawn('./acServer', { cwd: serverPath });
		}
		acServerPid = acServer.pid;
		acServerLogName = getDateTimeString() + '_log.txt';

		acServer.stdout.on('data', function (data) {
			if (acServerStatus === 0) {
				acServerStatus = -1;
			}

			var dataString = String(data);

			if (dataString.indexOf('OK') !== -1 || dataString.indexOf('Server started') !== -1) {
				acServerStatus = 1;
			}

		    if (dataString.indexOf('stracker has been restarted') !== -1) {
				sTrackerServerStatus = 1
			}

			if (dataString.indexOf('PAGE: /ENTRY') === -1) {
				//Log to console and file
				console.log(dataString);
                var logEntry = getDateTimeString() + ': ' + data;
				writeLogFile('server_' + acServerLogName, logEntry);
                updateServerLog(logEntry);

				//Set current session
				if (dataString.indexOf('session name') !== -1) {
					var session = dataString.substr(dataString.indexOf('session name :') + 14);
					currentSession = session.substr(0, dataString.indexOf('\n')).trim();
				}
			}
		});
		acServer.stderr.on('data', function (data) {
			console.log('stderr: ' + data);
            var logEntry = getDateTimeString() + ': ' + data;
			writeLogFile('error_' + acServerLogName, logEntry);
            updateServerLog(logEntry);
		});
		acServer.on('close', function (code) {
			console.log('closing code: ' + code);
            updateServerLog('Server closed with code: ' + code + '\n');
		});
		acServer.on('exit', function (code) {
			console.log('exit code: ' + code);
            updateServerLog('Server exited with code: ' + code + '\n');
			acServerStatus = 0;
		});

		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/acserver - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post stop ac server
app.post('/api/acserver/stop', function (req, res) {
	try {
		if (acServerPid) {
			if (isRunningOnWindows) {
				console.log('Stopping Windows Server');
				childProcess.spawn('taskkill', ['/pid', acServerPid, '/f', '/t']);
			} else {
				console.log('Stopping Linux Server');
				childProcess.spawn('kill', [acServerPid]);
			}

			acServerPid = undefined;
			acServerLogName = undefined;
		}

		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/acserver/stop - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// get stracker server status
app.get('/api/strackerserver/status', function (req, res) {
	try {
		res.status(200);
		res.send({ status: sTrackerPath === '' ? -2 : sTrackerServerStatus });
	} catch (e) {
		console.log('Error: GET/api/strackerserver/status - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post start stracker server
app.post('/api/strackerserver', function (req, res) {
	try {
        var sTracker = undefined;

        if (isRunningOnWindows) {
            console.log('Starting Windows sTracker');
    		sTracker = childProcess.spawn('stracker.exe', ['--stracker_ini', 'stracker.ini'], { cwd: sTrackerPath });
        } else {
            console.log('Starting Linux sTracker');
            sTracker = childProcess.spawn('./stracker_linux_x86/stracker', ['--stracker_ini', 'stracker.ini'], { cwd: sTrackerPath });
        }
        sTrackerServerPid = sTracker.pid;

		if (sTrackerServerStatus == 0) {
			sTrackerServerStatus = -1;
		}

		sTracker.stdout.on('data', function (data) {
			console.log(data);
		});
		sTracker.stderr.on('data', function (data) {
			console.log('stderr: ' + data);
		});
		sTracker.on('close', function (code) {
			console.log('closing code: ' + code);
		});
		sTracker.on('exit', function (code) {
			console.log('exit code: ' + code);
			sTrackerServerStatus = 0;
		});

		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/strackerserver - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// post stop stracker server
app.post('/api/strackerserver/stop', function (req, res) {
	try {
		if (sTrackerServerPid) {
            if (isRunningOnWindows) {
                console.log('Stopping Windows sTracker');
    			childProcess.spawn('taskkill', ['/pid', sTrackerServerPid, '/f', '/t']);
            } else {
                console.log('Stopping Linux sTracker');
                childProcess.spawn('kill', [sTrackerServerPid]);
            }
			sTrackerServerPid = undefined;
		}

		res.status(200);
		res.send('OK');
	} catch (e) {
		console.log('Error: POST/api/strackerserver/stop - ' + e);
		res.status(500);
		res.send('Application error');
	}
});

// list templates
app.get('/api/templates', function (req, res) {
    try {
        contentPath = checkLocalContentPath(contentPath);
        var templateUuids = fs.readdirSync(contentPath + '/templates');
        var templates = [];

        for (var idx in templateUuids) {
            var uuid = templateUuids[idx];
            var templateFile = contentPath + '/templates/' + uuid + '/config.json';
            var template = jsonfile.readFileSync(templateFile)
            template.uuid = uuid;
            templates.push(template);
        }

        res.status(200);
        res.send(templates);
    } catch (e) {
        console.log('Error: GET/api/templates - ' + e);
        res.status(500);
        res.send('Application error');
    }
});

// store current configuration to a new template
app.post('/api/templates', function (req, res) {
    try {
        contentPath = checkLocalContentPath(contentPath);
        var uuid = uuidv4();
        var template = {
            name: req.body.name,
            description: req.body.description
        }
        if (template.name === '') {
            throw 'Template must have a name!';
        }

        var templateDir = contentPath + '/templates/' + uuid;
        // TODO: assert existence and generate new uuidv4?
        fs.mkdirSync(templateDir);
        copyFileSync(serverPath + 'cfg/server_cfg.ini', templateDir + '/server_cfg.ini');
        copyFileSync(serverPath + 'cfg/entry_list.ini', templateDir + '/entry_list.ini');
        jsonfile.writeFileSync(templateDir + '/config.json', template);

        res.status(200);
        res.send('OK');
    } catch (e) {
        console.log('Error: POST/api/templates - ' + e);
        res.status(500);
        res.send('Application error');
    }
});

// apply templated configuration
app.post('/api/templates/:uuid', function (req, res) {
    try {
        var uuid = req.params.uuid;
        if (!uuid) {
            throw 'UUID not provided';
        }

        contentPath = checkLocalContentPath(contentPath);
        var templateDir = contentPath + '/templates/' + uuid;
	    config =  multiLine.read(templateDir + '/server_cfg.ini', {encoding: 'utf8'});
	    entryList =  multiLine.read(templateDir + '/entry_list.ini', {encoding: 'utf8'});
        saveConfig();
        saveEntryList();

        res.status(200);
        res.send('OK');
    } catch (e) {
        console.log('Error: PUT/api/templates - ' + e);
        res.status(500);
        res.send('Application error');
    }
});

// delete template based on uuid
app.delete('/api/templates/:uuid', function (req, res) {
    try {
        var uuid = req.params.uuid;
        if (!uuid) {
            throw 'UUID not provided';
        }

        contentPath = checkLocalContentPath(contentPath);
        var templateDir = contentPath + '/templates/' + uuid;
        rimraf.sync(templateDir);

        res.status(200);
        res.send('OK');
    } catch (e) {
        console.log('Error: DELETE/api/templates - ' + e);
        res.status(500);
        res.send('Application error');
    }
});


// get fronend index page
app.get('*', function (req, res) {
	res.sendFile(__dirname + '/frontend/index.html');
});

// server port node.js
app.listen(settings.port);
