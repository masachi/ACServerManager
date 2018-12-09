'use strict';

angular.module('acServerManager')
    .controller('StatusCtrl', function($scope, $timeout, ProcessService, ServerService) {
		$scope.alerts = [];
		
		(function getACServerStatus() {
			ProcessService.ACServerStatus(function(data){
				$scope.acServerStatus = data.status;
				$timeout(getACServerStatus, 2000);
			});
		})();
		
		(function getSTrackerServerStatus() {
			ProcessService.STrackerServerStatus(function(data){
				$scope.sTrackerServerStatus = data.status;
				$timeout(getSTrackerServerStatus, 2000);
			});
		})();
		
		(function getServerStatus() {
			ServerService.GetServerStatus(function(data){
				$scope.serverStatus = data;
				$timeout(getServerStatus, 2000);
			});
		})();
		
		$scope.startACServer = function() {
			ProcessService.StartACServer(function(result) {
				if (!(result[0] === 'O' && result[1] === 'K')) {
					createAlert('warning', 'Failed to start AC server', 'pe-7s-server');
				}
			})
		}
		
		$scope.stopACServer = function() {
			$scope.stopSTrackerServer();
			ProcessService.StopACServer(function(result) {
				if (!(result[0] === 'O' && result[1] === 'K')) {
					createAlert('warning', 'Failed to stop AC server', 'pe-7s-server');
				}
			})
		}
		
		$scope.restartACServer = function() {
			ProcessService.RestartACServer(function(result) {
				if (!(result[0] === 'O' && result[1] === 'K')) {
					createAlert('warning', 'Failed to restart AC server', 'pe-7s-server');
				}
			})
		}
		
		$scope.startSTrackerServer = function() {
			ProcessService.StartSTrackerServer(function(result) {
				if (!(result[0] === 'O' && result[1] === 'K')) {
					createAlert('warning', 'Failed to start stracker', 'pe-7s-server');
				}
			})
		}
		
		$scope.stopSTrackerServer = function() {
			ProcessService.StopSTrackerServer(function(result) {
				if (!(result[0] === 'O' && result[1] === 'K')) {
					createAlert('warning', 'Failed to stop stracker', 'pe-7s-server');
				}
			})
		}
		
		$scope.restartSTrackerServer = function() {
			ProcessService.RestartSTrackerServer(function(result) {
				if (!(result[0] === 'O' && result[1] === 'K')) {
					createAlert('warning', 'Failed to restart stracker', 'pe-7s-server');
				}
			})
		}
		
		$scope.closeAlert = function(index) {
			$scope.alerts.splice(index, 1);
		};
		
		function createAlert(type, msg, icon) {
			$.notify({
            	icon: icon,
            	message: msg
            },{
                type: type,
                timer: 3000
            });
		}
	})
    .controller('TemplatesCtrl', function ($scope, $filter, $timeout, TemplateService) {
        $scope.templateList = [];

        TemplateService.GetTemplates(function (data) {
            $scope.templateList = data;
        });

        $scope.loadTemplate = function(index) {
            if (!confirm('Are you sure?')) {
                return;
            }
            try {
                var loaded = true;
                var template = $scope.templateList[index];
                TemplateService.LoadTemplate(template, function(result) {
                    if (!(result[0] === 'O' && result[1] === 'K')) {
                        loaded = false;
                    }
                });
                if (loaded) {
                    createAlert('success', 'Loaded succesfully, remember to restart server!', 'pe-7s-star');
                } else {
                    createAlert('warning', 'Load failed!', 'pe-7s-close-circle');
                }
            } catch (e) {
                console.log('Error - ' + e);
            }
        }

        $scope.removeTemplate = function(index) {
            if (!confirm('Are you sure?')) {
                return;
            }
            try {
                var template = $scope.templateList[index];
                TemplateService.RemoveTemplate(template, function(result) {
                    if (!(result[0] === 'O' && result[1] === 'K')) {
                        createAlert('warning', 'Remove failed', 'pe-7s-close-circle');
                    } else {
                        $scope.templateList.splice(index, 1)
                        createAlert('success', 'Removed succesfully', 'pe-7s-star');
                    }
                });
            } catch (e) {
                console.log('Error - ' + e);
            }
        }

        $scope.saveCurrent = function() {
            $scope.$broadcast('show-errors-check-validity');

            if ($scope.form.$invalid) {
                createAlert('warning', 'There are errors on the form', 'pe-7s-note');
                return;
            }

            try {
                var saved = true;
                var template = angular.copy($scope.newTemplate);
                TemplateService.SaveCurrent(template, function(result) {
                    if (!(result[0] === 'O' && result[1] === 'K')) {
                        saved = false;
                    } else {
                        $scope.templateList.push(template);
                    }
                });
                if (saved) {
                    createAlert('success', 'Saved succesfully', 'pe-7s-star');
                } else {
                    createAlert('warning', 'Save failed', 'pe-7s-close-circle');
                }
            } catch (e) {
                console.log('Error - ' + e);
            }
        }

        function createAlert(type, msg, icon) {
            $.notify({
                icon: icon,
                message: msg
            },{
                type: type,
                timer: 3000
            });
        }
    })
	.controller('ServerCtrl', function ($scope, $filter, $timeout, CarService, TrackService, ServerService, BookService, PracticeService, QualifyService, RaceService, TyreService, WeatherService) {
		$scope.sessions = [];
		$scope.alerts = [];
		$scope.weatherSettings = [];
		var newWeather = {
			GRAPHICS: '3_clear',
			BASE_TEMPERATURE_AMBIENT: '20',
			BASE_TEMPERATURE_ROAD: '7',
			VARIATION_AMBIENT: '2',
			VARIATION_ROAD: '2'
		};
		
		BookService.GetBookingDetails(function (data) {
			$scope.sessions.push({
				type: 'Booking',
				hideTime: false,
				hideLaps: true,
				hideWaitTime: true,
				hideCanJoin: true,
				hideJoinType: true,
				hideWaitPercentage: true,
				hideExtraLap: true,
				hideRaceOverTime: true,
				hideRacePitWindowStart: true,
				hideRacePitWindowEnd: true,
				hideReversedGridRacePositions: true,
				enabled: data.NAME !== undefined,
				data: data
			});
			$scope.selectedSession = $scope.sessions[0];
		});
		
		PracticeService.GetPracticeDetails(function (data) {
			data.IS_OPEN = data.IS_OPEN == 1;
			$scope.sessions.push({
				type: 'Practice',
				hideTime: false,
				hideLaps: true,
				hideWaitTime: true,
				hideCanJoin: false,
				hideJoinType: true,
				hideWaitPercentage: true,
				hideExtraLap: true,
				hideRaceOverTime: true,
				hideRacePitWindowStart: true,
				hideRacePitWindowEnd: true,
				hideReversedGridRacePositions: true,
				enabled: data.NAME !== undefined,
				data: data
			});
		});
		
		QualifyService.GetQualifyDetails(function (data) {
			data.IS_OPEN = data.IS_OPEN == 1;
			$scope.sessions.push({
				type: 'Qualify',
				hideTime: false,
				hideLaps: true,
				hideWaitTime: true,
				hideCanJoin: false,
				hideJoinType: true,
				hideWaitPercentage: false,
				hideExtraLap: true,
				hideRaceOverTime: true,
				hideRacePitWindowStart: true,
				hideRacePitWindowEnd: true,
				hideReversedGridRacePositions: true,
				enabled: data.NAME !== undefined,
				data: data
			});
		});
		
		RaceService.GetRaceDetails(function (data) {
			$scope.sessions.push({
				type: 'Race',
				hideTime: false,
				hideLaps: false,
				hideWaitTime: false,
				hideCanJoin: true,
				hideJoinType: false,
				hideWaitPercentage: true,
				hideExtraLap: false,
				hideRaceOverTime: false,
				hideRacePitWindowStart: false,
				hideRacePitWindowEnd: false,
				hideReversedGridRacePositions: false,
				enabled: data.NAME !== undefined,
				data: data
			});
		});
		
		CarService.GetCars(function (data) {
			$scope.cars = data;
		});
		
		TrackService.GetTracks(function (data) {
			$scope.tracks = data;
		});
		
		ServerService.GetServerDetails(function (data) {
			try {
				data.LOOP_MODE = data.LOOP_MODE == 1;
				data.LOCKED_ENTRY_LIST = data.LOCKED_ENTRY_LIST == 1;
				data.PICKUP_MODE_ENABLED = data.PICKUP_MODE_ENABLED == 1;
				data.REGISTER_TO_LOBBY = data.REGISTER_TO_LOBBY == 1;

				$scope.server = data;

				$scope.selectedCars = data.CARS.split(';');
				$scope.selectedTracks = data.TRACK;
				$scope.selectedTyres = data.LEGAL_TYRES.split(';');

				var time = getTime(data.SUN_ANGLE);
				$scope.hours = time.getHours();
				$scope.mins = time.getMinutes();
			} catch (e) {
				console.log('Error - ' + e);
			}
			
			$scope.carsChanged();
			$scope.trackChanged();
		});
		
		WeatherService.GetWeather(function (data) {
			$scope.weatherSettings = data;
		});
		
		$scope.removeWeather = function(index) {
			$scope.weatherSettings.splice(index, 1);
		};
		
		$scope.addWeather = function() {
			$scope.weatherSettings.push(angular.copy(newWeather));
		};
		
		$scope.carsChanged = function() {
			if ($scope.selectedCars.length == 0) {
				$scope.tyres = [];
				return;
			}

			try {
				TyreService.GetTyres($scope.selectedCars.join(','), function(result) {				
					//Restructure the object to something that is nicer to format
					var tyreTypes = {};
					angular.forEach(result, function(value, key) {
						if (key !== '$promise' ) {
							var car = key;
							angular.forEach(value, function(value, key) {
								if (!tyreTypes[key]) {
									tyreTypes[key] = [];
								}
								
								var desc = findInArray(tyreTypes[key], { desc: value });
								if (desc == null) {
									desc = { desc: value };
									desc.cars = [];
									tyreTypes[key].push(desc);
								}

								desc.cars.push(car);
								
							});
						}
					});
					
					//Use the new format to create a flat object array for binding
					$scope.tyres = [];
					angular.forEach(tyreTypes, function(typeValue, typeKey) {
						var tyre = { value: typeKey };
						var description = typeKey + ':';
						angular.forEach(typeValue, function(descValue, descKey) {
							description += descValue.desc + ' (';
							angular.forEach(descValue.cars, function(carValue, carKey) {
								description += carValue + ',';
							});
							description = description.substring(0, description.length - 1) + ') ';
						});
						tyre.description = description.trim();
						$scope.tyres.push(tyre);
					});
					
					//Remove any selected tyres that are no longer available after a car change
					$scope.selectedTyres = $scope.selectedTyres.filter(function(element) {
						var found = findInArray($scope.tyres, { value: element });
						return found !== null;
					});
					
					//If there are no selected tyres in cfg, this is the same as having all available
					if ($scope.selectedTyres.length === 0) {
						angular.forEach($scope.tyres, function(value, key) {
							$scope.selectedTyres.push(value.value);
						});
					}
				});
			} catch (e) {
				console.log('Error - ' + e);
			}
		}
		
		$scope.tyresChanged = function() {
			//If there are no selected tyres in cfg, this is the same as having all available
			if ($scope.selectedTyres.length === 0) {
				angular.forEach($scope.tyres, function(value, key) {
					$scope.selectedTyres.push(value.value);
				});
			}
		}
		
		$scope.trackChanged = function() {
			var track = findInArray($scope.tracks, {name: $scope.selectedTracks})
			if (track !== null) {
				if (track.configs && track.configs.length) {
					$scope.configs = track.configs;
					var index = $scope.configs.indexOf($scope.server.CONFIG_TRACK);
					var index = (index !== -1) ? index : 0;
					$scope.server.CONFIG_TRACK = $scope.configs[index];
					
					TrackService.GetTrackDetails(track.name, $scope.server.CONFIG_TRACK, function(data) {
						$scope.trackDetails = data;
					});
					
					$scope.trackImage = '/api/tracks/' + $scope.selectedTracks + '/' + $scope.server.CONFIG_TRACK + '/image';
				} else {
					$scope.configs = null;
					$scope.server.CONFIG_TRACK = '';
					
					TrackService.GetTrackDetails(track.name, null, function(data) {
						$scope.trackDetails = data;
					});
					
					$scope.trackImage = '/api/tracks/' + $scope.selectedTracks + '/image';
				}
			}
		};
			
		$scope.submit = function() {
			$scope.$broadcast('show-errors-check-validity');
			
			if ($scope.form.$invalid) { 
				createAlert('warning', 'There are errors on the form', 'pe-7s-note');
				return; 
			}
			
			try {
				var data = angular.copy($scope.server);
			
				data.LOCKED_ENTRY_LIST = $scope.server.LOCKED_ENTRY_LIST ? 1 : 0;
				data.LOOP_MODE = $scope.server.LOOP_MODE ? 1 : 0;
				data.PICKUP_MODE_ENABLED = $scope.server.PICKUP_MODE_ENABLED ? 1 : 0;
				data.REGISTER_TO_LOBBY = $scope.server.REGISTER_TO_LOBBY ? 1 : 0;
				data.CARS = $scope.selectedCars.join(';');
				data.TRACK = $scope.selectedTracks;
				
				if($scope.hours || $scope.mins){
					data.SUN_ANGLE = getSunAngle($scope.hours, $scope.mins);
				}

				if (typeof $scope.tyres.length === 'undefined' || !$scope.tyres.length){
					data.LEGAL_TYRES = $scope.selectedTyres.length === $scope.tyres.length ? '' : $scope.selectedTyres.join(';');
				}
				
				var saved = true;
				
				ServerService.SaveServerDetails(data, function(result) {
					if (!(result[0] === 'O' && result[1] === 'K')) {
						saved = false;
					}
				});
				
				var booking = findInArray($scope.sessions, { type: 'Booking' });
				if (booking !== null) {
					if(!booking.enabled) {
						booking.data = {};
					}
					
					BookService.SaveBookingDetails(booking.data, function(result) {
						if (!(result[0] === 'O' && result[1] === 'K')) {
							saved = false;
						}
					});
				}
				
				var practice = findInArray($scope.sessions, { type: 'Practice' });
				if (practice !== null) {
					if(!practice.enabled) {
						practice.data = {};
					} else {
						practice.data.IS_OPEN = practice.data.IS_OPEN ? 1 : 0;
					}
					
					PracticeService.SavePracticeDetails(practice.data, function(result) {
						if (!(result[0] === 'O' && result[1] === 'K')) {
							saved = false;
						}
					});
				}
				
				var qualify = findInArray($scope.sessions, { type: 'Qualify' });
				if (qualify !== null) {
					if(!qualify.enabled) {
						qualify.data = {};
					} else {
						qualify.data.IS_OPEN = qualify.data.IS_OPEN ? 1 : 0;
					}
					
					QualifyService.SaveQualifyDetails(qualify.data, function(result) {
						if (!(result[0] === 'O' && result[1] === 'K')) {
							saved = false;
						}
					});
				}
				
				var race = findInArray($scope.sessions, { type: 'Race' });
				if (race !== null) {
					if(!race.enabled) {
						race.data = {};
					}
					
					RaceService.SaveRaceDetails(race.data, function(result) {
						if (!(result[0] === 'O' && result[1] === 'K')) {
							saved = false;
						}
					});
				}
				
				WeatherService.SaveWeather($scope.weatherSettings, function(result) {
					if (!(result[0] === 'O' && result[1] === 'K')) {
						saved = false;
					}
				});
				
				if (saved) {
					createAlert('success', 'Saved successfully', 'pe-7s-star');
					} else {
					createAlert('warning', 'Save failed', 'pe-7s-close-circle');
				}
			} catch (e) {
				console.log('Error - ' + e);
			}
		}
		
		$scope.closeAlert = function(index) {
			$scope.alerts.splice(index, 1);
		};

		function getTime(sunAngle) {
			var baseLine = new Date(2000, 1, 1, 13, 0, 0, 0);
			var offset = sunAngle / 16;
			var multiplier = offset * 60;
			baseLine.setMinutes(baseLine.getMinutes() + multiplier);
			return baseLine;
		}

		function getSunAngle(hours, mins) {
			var baseLine = new Date(2000, 1, 1, 13, 0, 0, 0);
			var time = new Date(2000, 1, 1, hours, mins, 0);
			var diff = time - baseLine;
			var minDiff = Math.round(diff / 60000);
			var multiplier = minDiff / 60;
			var sunAngle = multiplier * 16;
			return sunAngle;
		}

		function createAlert(type, msg, icon) {
			$.notify({
            	icon: icon,
            	message: msg
            },{
                type: type,
                timer: 3000
            });
		}
		
		function findInArray(arr, search) {
			var found = $filter('filter')(arr, search, true);
			if (found.length) {
				return found[0];
			}
			
			return null;
		}
	})
	.controller('EntryListCtrl', function($scope, $timeout, $filter, ServerService, CarService, EntryListService, DriverService) {	
		$scope.alerts = [];
		$scope.entryList = [];
		$scope.drivers =[];
		$scope.amount = 1;
		$scope.random = false;
		$scope.newEntry = {
			DRIVERNAME: '',
			TEAM: '',
			MODEL: '',
			SKIN: '',
			GUID: '',
			SPECTATOR_MODE: '',
			BALLAST: 0,
            RESTRICTOR: 0
		};
		
		$scope.$watchCollection('newEntry', function (newVal, oldVal) {
			$scope.disableAmount = newVal.DRIVERNAME || newVal.TEAM || newVal.GUID
			if ($scope.disableAmount) {
				$scope.amount = 1;
			}
		});
		
		ServerService.GetServerDetail('cars', function (data) {
			try {
				$scope.cars = data.value.split(';');
				$scope.newEntry.MODEL = $scope.cars[0];
				$scope.selectedCarChanged();
			} catch (e) {
				console.log('Error - ' + e);
			}
		});
		
		EntryListService.GetEntryList(function (data) {
			angular.forEach(data, function(value, key) {
				if (key.indexOf('CAR_') === 0) {
					value.SPECTATOR_MODE = value.SPECTATOR_MODE == 1;
					$scope.entryList.push(value);
				}
			});
		});
		
		DriverService.GetDrivers(function (data) {
			$scope.drivers = data;
		});
		
		$scope.selectedCarChanged = function() {
			CarService.GetSkins($scope.newEntry.MODEL, function(data) {
				$scope.skins = data.skins;
				$scope.newEntry.SKIN = $scope.skins[0];
			});
		}
		
		$scope.removeEntry = function(index) {
			$scope.entryList.splice(index, 1);
		}
		
		$scope.submit = function() {
			$scope.$broadcast('show-errors-check-validity');
			
			if ($scope.form.$invalid) { 
				createAlert('warning', 'There are errors on the form', 'pe-7s-note');
				return; 
			}
			
			for(var i=1; i <= $scope.amount; i++) {
				var entry = angular.copy($scope.newEntry);
				if ($scope.random) {
					entry.SKIN = $scope.skins[Math.floor(Math.random() * $scope.skins.length)];
				}
				$scope.entryList.push(entry);
			}
			
			$scope.newEntry = {
				DRIVERNAME: '',
				TEAM: '',
				MODEL: $scope.cars[0],
				SKIN: '',
				GUID: '',
				SPECTATOR_MODE: '',
				BALLAST: 0,
                RESTRICTOR: 0
			};
			$scope.selectedCarChanged();
		}
		
		$scope.saveChanges = function() {	
			var data = {};
			angular.forEach($scope.entryList, function(value) {
				value.SPECTATOR_MODE = value.SPECTATOR_MODE ? 1 : 0;
				data['CAR_' + $scope.entryList.indexOf(value)] = value;
			});
			
			EntryListService.SaveEntryList(data, function(result) {
				if (result[0] === 'O' && result[1] === 'K') {
					createAlert('success', 'Saved successfully', 'pe-7s-star');
					} else {
					createAlert('warning', 'Save failed', 'pe-7s-close-circle');
				}
			});
		}
		
		$scope.clear = function() {
			if (confirm('Are you sure?')) {
				$scope.entryList = [];
			}
		}
		
		$scope.addDriver = function () {
			$scope.$broadcast('show-errors-check-validity');
			
			if ($scope.createForm.$invalid) { 
				createAlert('warning', 'There are errors on the form', 'pe-7s-note');
				return; 
			}
			
			DriverService.SaveDriver($scope.newDriver, function(result) {
				if (result[0] === 'O' && result[1] === 'K') {
					$scope.drivers.push($scope.newDriver);
					$scope.newDriver = {};
				} else {
					createAlert('warning', 'Save failed', 'pe-7s-close-circle');
				}
			});
		}
		
		$scope.deleteDriver = function(guid) {
			if (!confirm('Are you sure you want to delete this driver?')) return;
			
			DriverService.DeleteDriver(guid, function(result) {
				if (result[0] === 'O' && result[1] === 'K') {
					var found = $filter('filter')($scope.drivers, { GUID: guid }, true);
					if (found.length) {
						angular.forEach(found, function(value, key) {
							$scope.drivers.splice(key, 1);
						});
					}
				} else {
					createAlert('warning', 'Delete failed', 'pe-7s-close-circle');
				}
			});
		}
		
		$scope.selectDriver = function(driver) {
			$scope.newEntry.DRIVERNAME = driver.NAME;
			$scope.newEntry.TEAM = driver.TEAM;
			$scope.newEntry.GUID = driver.GUID;
		}
		
		function createAlert(type, msg, icon) {
			$.notify({
            	icon: icon,
            	message: msg
            },{
                type: type,
                timer: 3000
            });
		}
	})
    .controller('CarCtrl', function($scope, Upload, $timeout, $q, CarService) {
        $scope.alerts = [];
        $scope.files = [];
        $scope.userDropped = false;
        $scope.newCar = {
            name: '',
            data: [],
            mod_tyres: '',
            skins: [],
            $valid: false
        };

        CarService.GetCars(function (data) {
            $scope.cars = data;
        });

        $scope.$watch('files', function() {
            $scope.validateCar($scope.files);
        });

        $scope.removeCar = function(index) {
            if (!confirm('Are you sure?')) {
                return;
            }
            try {
                var car = $scope.cars[index];
                CarService.RemoveCar(car, function(result) {
                    if (!(result[0] === 'O' && result[1] === 'K')) {
                        createAlert('warning', 'Remove failed', 'pe-7s-close-circle');
                    } else {
                        $scope.cars.splice(index, 1);
                        createAlert('success', 'Removed succesfully', 'pe-7s-star');
                    }
                });
            } catch(e) {
                console.log('Error - ' + e);
            }
        }

        $scope.resetNewCar = function() {
            $scope.newCar.$valid = false;
            $scope.newCar.name = '';
            $scope.newCar.data = [];
            $scope.newCar.mod_tyres = '';
            $scope.newCar.skins = [];
        }

        $scope.submitCar = function() {
            if ($scope.newCar.$valid !== true) {
                createAlert('warning', 'Car is not valid! Please try again!', 'pe-7s-close-circle');
                return;
            }

            var car = _.pick($scope.newCar, ['name', 'data', 'mod_tyres', 'skins']);
            $q.when($scope.uploadCar(car)).then(function(results) {
                createAlert('success', 'Car succesfully added!', 'pe-7s-star');
                CarService.GetCars(function (data) {
                    $scope.cars = data;
                });
            }, function(reason) {
                createAlert('alert', 'Failed to add car - ' + reason, 'pe-7s-close-circle');
            });
            $scope.files = [];
            $scope.userDropped = false;
            $scope.resetNewCar();
        }

        $scope.uploadCar = function(car, progressCb) {
            var uploadPromise = Upload.upload({
                url: '/api/cars',
                data: { car: car }
            });

            return uploadPromise.then(function(response) {
                return $timeout(function() {
                    return { success: true, car: car, result: response.data };
                });
            }, function(response) {
                if (response.status > 0) {
                    var errorMsg = response.status + ': ' + response.data;
                    return { success: false, car: car, result: errorMsg };
                }
            }, progressCb);
        }

        $scope.validateCar = function(files) {
            if (files.length === 0) {
                return
            }
            $scope.resetNewCar();

            $scope.userDropped = true;

            var directories = _.filter(files, function(file) {
                return file.type === 'directory';
            });
            // Car name
            $scope.newCar.name = directories[0].path.split('/')[0];
            $scope.newCar.mod_tyres += '[' + $scope.newCar.name + ']\n';
            $scope.newCar.mod_tyres += 'S=Slick Soft\nM=Slick Medium\nH=Slick Hard';
            // Car skins
            $scope.newCar.skins = _.map(_.filter(directories, function(dir) {
                var parts = dir.path.split('/');
                return parts.length === 3 && parts[1] === 'skins';
            }), function(skinDir) {
                return skinDir.path.split('/')[2];
            });
            if ($scope.newCar.skins.length === 0) {
                createAlert('warning',
                            'Dropped car directory has no skins!',
                            'pe-7s-close-circle');
                return
            }
            // Car data.acd
            var candidates = _.filter(files, function(file) {
                return file.path === $scope.newCar.name + '/data.acd';
            });
            if (candidates.length === 1) {
                $scope.newCar.data = [candidates[0]];
            } else {
                candidates = _.filter(directories, function(dir) {
                    return dir.path === $scope.newCar.name + '/data';
                });
                if (candidates.length !== 1) {
                    createAlert('warning',
                                'Dropped car directory has neither data.acd nor data/-directory!',
                                'pe-7s-close-circle');
                    return
                }
                $scope.newCar.data = _.filter(files, function(file) {
                    return file.type !== 'directory' && file.path.startsWith($scope.newCar.name + '/data');
                });
            }
            $scope.newCar.$valid = true;
        }

        function createAlert(type, msg, icon) {
            $.notify({
                icon: icon,
                message: msg
            },{
                type: type,
                timer: 3000
            });
        }
    })
    .controller('TrackCtrl', function($scope, Upload, $timeout, $q, TrackService) {
        $scope.alerts = [];
        $scope.files = [];
        $scope.trackItems = [
            { name: 'surfaces', filename: 'surfaces.ini', subdir: 'data', required: true, max_size: 1000000 },
            { name: 'drs_zones', filename: 'drs_zones.ini', subdir: 'data', required: false, max_size: 1000000 },
            { name: 'preview', filename: 'preview.png', subdir: 'ui', required: true, max_size: 5000000 },
            { name: 'ui_track', filename: 'ui_track.json', subdir: 'ui', required: true, max_size: 1000000 }
        ];
        $scope.newTrack = {
            name: '',
            layouts: [],
            errors: [],
            $valid: false
        };
        $scope.userDropped = false;

        TrackService.GetTracks(function (data) {
            $scope.tracks = data;
        });

        $scope.$watch('files', function() {
            $scope.validateTrack($scope.files);
        });

        $scope.removeTrack = function(index) {
            if (!confirm('Are you sure?')) {
                return;
            }
            try {
                var track = $scope.tracks[index];
                TrackService.RemoveTrack(track.name, function(result) {
                    if (!(result[0] === 'O' && result[1] === 'K')) {
                        createAlert('warning', 'Remove failed', 'pe-7s-close-circle');
                    } else {
                        $scope.tracks.splice(index, 1);
                        createAlert('success', 'Removed succesfully', 'pe-7s-star');
                    }
                });
            } catch(e) {
                console.log('Error - ' + e);
            }
        }

        $scope.resetNewTrack = function() {
            $scope.newTrack.name = '';
            $scope.newTrack.layouts = [];
            $scope.newTrack.errors = [];
            $scope.newTrack.$valid = false;
        }

        $scope.submitTrack = function() {
            if ($scope.newTrack.$valid !== true) {
                createAlert('warning', 'Track is not valid! Please try again!', 'pe-7s-close-circle');
                return;
            }

            var track = _.pick($scope.newTrack, ['name', 'layouts']);
            $q.when($scope.uploadTrack(track)).then(function(results) {
                createAlert('success', 'Track succesfully added!', 'pe-7s-star');
                TrackService.GetTracks(function (data) {
                    $scope.tracks = data;
                });
            }, function(reason) {
                createAlert('warning', 'Failed to add track - ' + reason, 'pe-7s-close-circle');
            });
            $scope.files = []
            $scope.userDropped = false;
            $scope.resetNewTrack();
        }

        $scope.uploadTrack = function(track, progressCb) {
            var uploadPromise = Upload.upload({
                url: '/api/tracks',
                data: { track: track }
            });

            return uploadPromise.then(function(response) {
                 return $timeout(function() {
                    return { success: true, track: track, result: response.data };
                });
            }, function(response) {
                if (response.status > 0) {
                    var errorMsg = response.status + ': ' + response.data;
                    return { success: false, track: track, result: errorMsg };
                }
            }, progressCb);
        }

        function validateLayoutFile(files, subdir, item, errorCb) {
            var candidates = _.filter(files, function(file) {
                return file.path === subdir + item.filename;
            });
            if (candidates.length < 1) {
                if (item.required) {
                    $scope.newTrack.$valid = false;
                }
                errorCb(item.name, 'found');
            } else if (candidates > 1) {
                $scope.newTrack.$valid = false;
                errorCb(item.name, 'multiple');
            } else {
                if (candidates[0].size > item.max_size) {
                    $scope.newTrack.$valid = false;
                    errorCb(item.name, 'max_size');
                } else {
                    return candidates[0];
                }
            }
            return null;
        }

        function addLayoutError(idx, key, errorKey) {
            if ($scope.newTrack.errors.length <= idx) {
                $scope.newTrack.errors[idx] = {};
            }
            if (!_.has($scope.newTrack.errors[idx], key)) {
                $scope.newTrack.errors[idx][key] = {};
            }
            $scope.newTrack.errors[idx][key][errorKey] = true;
        }

        $scope.validateTrack = function(files) {
            if (files.length === 0) {
                return;
            }
            $scope.resetNewTrack();

            $scope.userDropped = true;
            $scope.newTrack.$valid = true;

            var directories = _.filter(files, function(file) {
                return file.type === 'directory';
            });
            // Track name
            $scope.newTrack.name = directories[0].path.split('/')[0];
            // Track layouts
            var hasMultipleLayouts = _.indexOf(
                _.map(directories, 'path'), $scope.newTrack.name + '/data') === -1;
            if (hasMultipleLayouts) {
                var layoutNames = _.map(_.filter(directories, isLayoutDir), function(dir) {
                    return dir.path.split('/')[1];
                });
                var idx = 0;
                _.forEach(layoutNames, function(layoutName) {
                    var layout = { name: layoutName };
                    var errorCb = _.partial(addLayoutError, idx);
                    _.forEach($scope.trackItems, function(item) {
                        // Multilayout directory structure:
                        // TRACK/LAYOUT/data/
                        // TRACK/ui/LAYOUT/
                        var subdir = $scope.newTrack.name + '/' +
                            (item.subdir == 'ui' ? 'ui/' + layoutName : layoutName + '/data') + '/';
                        var candidate = validateLayoutFile(files, subdir, item, errorCb);
                        if (candidate !== null && candidate !== undefined) {
                            layout[item.name] = candidate;
                        }
                    });
                    $scope.newTrack.layouts[idx] = layout;
                    idx++;
                });
            } else {
                var layout = { name: null };
                _.forEach($scope.trackItems, function(item) {
                    var subdir = $scope.newTrack.name + '/' + item.subdir + '/';
                    var errorCb = _.partial(addLayoutError, 0);
                    var candidate = validateLayoutFile(files, subdir, item, errorCb);
                    if (candidate !== null && candidate !== undefined) {
                        layout[item.name] = candidate;
                    }
                });
                $scope.newTrack.layouts[0] = layout;
            }
        }

        function isLayoutDir(dir) {
            var reservedNames = ['ui', 'ai', 'skins', 'data'];
            var parts = dir.path.split('/');
            if (parts.length !== 2) {
                return false;
            } else if (parts[0] !== $scope.newTrack.name) {
                return false;
            } else if (_.indexOf(reservedNames, parts[1]) !== -1) {
                return false;
            } else {
                return true;
            }
        }

        function createAlert(type, msg, icon) {
            $.notify({
                icon: icon,
                message: msg
            },{
                type: type,
                timer: 3000
            });
        }
    })
	.controller('RulesCtrl', function($scope, $timeout, ServerService, DynamicTrackService) {
		$scope.alerts = [];
		
		$scope.assistOptions = [
			{
				value: '0',
				name: 'Force Off'
			},
			{
				value: '1',
				name: 'Factory'
			},
			{
				value: '2',
				name: 'Force On'
			}
		];
		
		ServerService.GetServerDetails(function (data) {
			data.AUTOCLUTCH_ALLOWED = data.AUTOCLUTCH_ALLOWED == 1;
			data.STABILITY_ALLOWED = data.STABILITY_ALLOWED == 1;
			data.TYRE_BLANKETS_ALLOWED = data.TYRE_BLANKETS_ALLOWED == 1;
			data.FORCE_VIRTUAL_MIRROR = data.FORCE_VIRTUAL_MIRROR == 1;
			
			$scope.server = data;
		});
		
		DynamicTrackService.GetDynamicTrackDetails(function (data) {
			$scope.dynamicTrackEnabled = data.LAP_GAIN !== undefined;
			$scope.dynamicTrack = data;
		});
		
		$scope.submit = function() {
			$scope.$broadcast('show-errors-check-validity');
			
			if ($scope.form.$invalid) { 
				createAlert('warning', 'There are errors on the form', 'pe-7s-note');
				return; 
			}
			
			try {
				var data = angular.copy($scope.server);
			
				data.AUTOCLUTCH_ALLOWED = $scope.server.AUTOCLUTCH_ALLOWED ? 1 : 0;
				data.STABILITY_ALLOWED = $scope.server.STABILITY_ALLOWED ? 1 : 0;
				data.TYRE_BLANKETS_ALLOWED = $scope.server.TYRE_BLANKETS_ALLOWED ? 1 : 0;
				data.FORCE_VIRTUAL_MIRROR = $scope.server.FORCE_VIRTUAL_MIRROR ? 1 : 0;
				
				var saved = true;
				
				ServerService.SaveServerDetails(data, function(result) {
					if (!(result[0] === 'O' && result[1] === 'K')) {
						saved = false;
					}
				});
				
				if(!$scope.dynamicTrackEnabled) {
					$scope.dynamicTrack = {};
				}
				
				DynamicTrackService.SaveDynamicTrackDetails($scope.dynamicTrack, function(result) {
					if (!(result[0] === 'O' && result[1] === 'K')) {
						saved = false;
					}
				});
				
				if (saved) {
					createAlert('success', 'Saved successfully', 'pe-7s-star');
					} else {
					createAlert('warning', 'Save failed', 'pe-7s-close-circle');
				}
			} catch (e) {
				console.log('Error - ' + e);
			}
		}
		
		function createAlert(type, msg, icon) {
			$.notify({
            	icon: icon,
            	message: msg
            },{
                type: type,
                timer: 3000
            });
		}
	})
	.controller('AdvancedCtrl', function($scope, $timeout, ServerService) {	
		$scope.alerts = [];
		
		ServerService.GetServerDetails(function (data) {		
			$scope.server = data;
			if (!$scope.server.MAX_BALLAST_KG) {
				$scope.server.MAX_BALLAST_KG = 100;
			}
		});
		
		$scope.submit = function() {
			$scope.$broadcast('show-errors-check-validity');
			
			if ($scope.form.$invalid) { 
				createAlert('warning', 'There are errors on the form', 'pe-7s-note');
				return; 
			}
			
			try {
				
				if (!$scope.server.UDP_PLUGIN_LOCAL_PORT) {
					$scope.server.UDP_PLUGIN_LOCAL_PORT = '';
				}
			
				ServerService.SaveServerDetails($scope.server, function(result) {
					if (result[0] === 'O' && result[1] === 'K') {
						createAlert('success', 'Saved successfully', 'pe-7s-star');
					} else {
						createAlert('warning', 'Save failed', 'pe-7s-close-circle');
					}
				});
			} catch (e) {
				console.log('Error - ' + e);
			}
			
		}
		
		function createAlert(type, msg, icon) {
			$.notify({
            	icon: icon,
            	message: msg
            },{
                type: type,
                timer: 3000
            });
		}
	})
	.controller('HelpCtrl', function($scope) {
	});
