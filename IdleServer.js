/*
 * Release version date : 2020-1-28
 *
 * When testing, any commit from any branch will upload a new CloudScript version
 * with the respective changes.  In order for cloud script calls to target a
 * specific version, the following parameter needs to be added : "SpecificRevision",
 * and the parameter "RevisionSelection" should not be set to "Live".
 * The following parameters will target a specified version:
 * {
 *   "PlayFabId": playerId,
 *   "FunctionName": functionName,
 *   "FunctionParameter": functionData,
 *   "SpecificRevision": 405
 * }
 * The following parameters will target version set as Live:
 * {
 *   "PlayFabId": playerId,
 *   "FunctionName": functionName,
 *   "FunctionParameter": functionData,
 *   "RevisionSelection": "Live",
 * }
 * or
 * {
 *   "PlayFabId": playerId,
 *   "FunctionName": functionName,
 *   "FunctionParameter": functionData
 * }
 */

//Handlers
var getServerTimeInternal = function (args) {
	var now = new Date();
	var serverTime = now.getTime() / 1000;
	var data = { "serverTime": serverTime };
	return data;
};
handlers.getServerTime = getServerTimeInternal;

var convertLeaderboardNameToCheaters = function(leaderboardName) {
	return leaderboardName + CHEATER_SUFFIX
}

var logTierUpdateData = function(context, updatedData, updateResponse) {
	if (context == null || context == undefined) {
		context = "MissingContext";
	}

	var tierHistory = "tierHistory";

	var playerInternalData = server.GetUserInternalData({
		"PlayFabId": currentPlayerId,
		"Keys": [ tierHistory ]
	});

	var tierHistoryData = [];

	if (playerInternalData != undefined
		&& playerInternalData != null
		&& playerInternalData.hasOwnProperty("Data")
		&& playerInternalData.Data != null
		&& playerInternalData.Data != undefined
	) {
		if (playerInternalData.Data.hasOwnProperty(tierHistory)
			&& playerInternalData.Data[tierHistory] != null
			&& playerInternalData.Data[tierHistory] != undefined
			&& playerInternalData.Data[tierHistory].hasOwnProperty("Value")
			&& playerInternalData.Data[tierHistory].Value != undefined
			&& playerInternalData.Data[tierHistory].Value != null
		) {
			tierHistoryData = JSON.parse(playerInternalData.Data[tierHistory].Value);
		}
	}

	tierHistoryData.push({
		time : getServerTimeInternal(),
		context : context,
		updatedData : updatedData,
		updateResponse : updateResponse
	});

	while (tierHistoryData.length > HISTORY_LOG_SIZE) {
		tierHistoryData.shift();
	}

	var data = {};
	data[tierHistory] = JSON.stringify(tierHistoryData);

	server.UpdateUserInternalData({
		"PlayFabId": currentPlayerId,
		"Data": data
	});
}

var buildEventTutorialLeaderboardEntries = function(playerLeaderboardId, value, tutorialConfig) {
	var entries = [
		{
			"player" : playerLeaderboardId,
			"value" : value
		}
	];

	if (tutorialConfig && tutorialConfig.entries) {
		for(var idx = 0; idx < tutorialConfig.entries.length; idx++) {
			var entry = tutorialConfig.entries[idx];

			var entryIdx = 0;
			for(entryIdx; entryIdx < entries.length; entryIdx++) {
				if (entries[entryIdx].value >= entry.value) {
					entries.splice(entryIdx, 0, entry);
					break;
				}
			};

			if (entryIdx >= entries.length) {
				entries.push(entry);
			}
		}
	}

	entries = entries.reverse();

	return entries;
}

var getTitleTierData = function() {
	var result = null;

	var responseObject = server.GetTitleData({
		"Keys":[ TIER_LEADERBOARD_KEY ]
	});

	if (responseObject != null
		&& responseObject != undefined
		&& responseObject.Data != undefined
		&& responseObject.Data != null
		&& responseObject.Data[TIER_LEADERBOARD_KEY] != undefined
		&& responseObject.Data[TIER_LEADERBOARD_KEY] != null
	) {
		result = JSON.parse(responseObject.Data[TIER_LEADERBOARD_KEY]);
	}

	return result;
}

var getTopTierId = function() {
	var result = -1;

	var titleTierData = getTitleTierData();

	if (titleTierData != null
		&& titleTierData != undefined
		&& titleTierData.hasOwnProperty('tiers')
		&& titleTierData.tiers != undefined
		&& titleTierData.tiers != null
	) {
		result = (titleTierData.tiers.length - 1);
	}

	return result;
}

var isLeaderboardTierSupported = function(leaderboardName) {
	var result = false;

	if (leaderboardName != null && leaderboardName != undefined) {
		var data = server.GetTitleInternalData({
			"Keys" : [ "leaderboardTiersBlackList" ]
		});

		var blackListArray = JSON.parse(data.Data["leaderboardTiersBlackList"]);

		if (blackListArray != null
			&& blackListArray != undefined
			&& Array.isArray(blackListArray)
		) {
			result = (blackListArray.indexOf(leaderboardName) < 0);
		}
	}

	return result;
}

var getPlayerTierIndex = function(doNotCheckCheater) {
	var result = -1;

	var playerInternalData = server.GetUserInternalData({
		"PlayFabId": currentPlayerId,
		"Keys": [ TIER_LEADERBOARD_KEY ]
	});

	if (playerInternalData != undefined
		&& playerInternalData != null
		&& playerInternalData.hasOwnProperty("Data")
		&& playerInternalData.Data != null
		&& playerInternalData.Data != undefined
	) {
		if (playerInternalData.Data.hasOwnProperty(TIER_LEADERBOARD_KEY)
			&& playerInternalData.Data[TIER_LEADERBOARD_KEY] != null
			&& playerInternalData.Data[TIER_LEADERBOARD_KEY] != undefined
			&& playerInternalData.Data[TIER_LEADERBOARD_KEY].hasOwnProperty("Value")
			&& playerInternalData.Data[TIER_LEADERBOARD_KEY].Value != undefined
			&& playerInternalData.Data[TIER_LEADERBOARD_KEY].Value != null
		) {
			var tieredLeaderboardData = JSON.parse(playerInternalData.Data[TIER_LEADERBOARD_KEY].Value);

			if (tieredLeaderboardData != undefined
				&& tieredLeaderboardData != null
				&& tieredLeaderboardData.hasOwnProperty("tier")
				&& tieredLeaderboardData.tier != undefined
				&& tieredLeaderboardData.tier != null
				&& tieredLeaderboardData.tier >= 0
			) {
				result = tieredLeaderboardData.tier;
			}
		}
	}

	// reset tier here to minimize
	// race condition with banning
	// cheaters
	if (doNotCheckCheater !== true) {
		if (isPlayerBannedInternal()) {
			result = -1;
		}
	}

	return result;
}

var updatePlayerTierData = function(currentTierData, newTierData, context) {
	if (newTierData == undefined || newTierData == null) {
		return currentTierData;
	}

	if (currentTierData == undefined || currentTierData == null) {
		currentTierData = {};
	}

	for(var updateField in newTierData) {
		currentTierData[updateField] = newTierData[updateField];
	}

	var data = {};
	data[TIER_LEADERBOARD_KEY] = JSON.stringify(currentTierData);

	var updateResponse = server.UpdateUserInternalData({
		"PlayFabId": currentPlayerId,
		"Data": data
	});

	logTierUpdateData(context, currentTierData, updateResponse);

	return currentTierData;
}

/*
 * args : passed through playfab game manager in json format :
 * {
 *      "statistics" : list of statistic update objects { StatisticName, Value, AggregationMethod }
 * }
 */
handlers.updatePlayerStatistics = function (args) {
	var updates = 0;

	var data = server.GetTitleInternalData({
		"Keys" : [ "eventLeaderboardTutorial" ]
	});

	var tutorialLeaderboardData = JSON.parse(data.Data["eventLeaderboardTutorial"]);

	if (args.hasOwnProperty("statistics") && args.statistics != null && args.statistics != undefined) {
		for (var i = 0; i < args.statistics.length; i++) {
			var leaderboardName = args.statistics[i]["StatisticName"];
			var value = args.statistics[i]["Value"];

			if (tutorialLeaderboardData
				&& tutorialLeaderboardData.leaderboardName
				&& tutorialLeaderboardData.leaderboardName === leaderboardName
			) {
				var entries = buildEventTutorialLeaderboardEntries(
					getPlayerLeaderboardId(),
					value,
					tutorialLeaderboardData
				);

				var data = {};
				data[leaderboardName] = JSON.stringify(entries);

				server.UpdateUserInternalData({
					"PlayFabId": currentPlayerId,
					"Data" : data
				});
			} else {
				var updateType = args.statistics[i]["AggregationMethod"];

				updatePlayerStatistic(leaderboardName, value, updateType, undefined, args.reservedId);
			}

			updates++;
		}
	}

	return { "value":updates };
};

var updatePlayerStatistic = function (leaderboardName, value, updateType, tierOverride, reservedId) {
	sendUwsUpdateLeaderboardRequest(
		getPlayerLeaderboardId(),
		leaderboardName,
		value,
		updateType,
		tierOverride,
		undefined,
		reservedId
	);
}

var sendUwsUpdateLeaderboardRequest = function(playerRedisKey,
	leaderboardName,
	value,
	updateType,
	tierOverride,
	doNotCheckCheater,
	reservedId
) {
	var requestParams = {
		"playerId": playerRedisKey,
		"value": value,
		"updateType": updateType
	};

	var requestUrl = getUWSServer() + "Leaderboard/UpdatePlayerStatistic";

	requestParams['gameId'] = script.titleId;
	requestParams['leaderboardName'] = leaderboardName;

	if (isLeaderboardTierSupported(leaderboardName)) {
		var playerTierIndex = (tierOverride != null && tierOverride != undefined)
			? tierOverride
			: getPlayerTierIndex();

		if (playerTierIndex >= 0) {
			var topTierIndex = getTopTierId();
			if (topTierIndex > 0 && topTierIndex == playerTierIndex) {
				requestParams['gameId'] = script.titleId + TITLE_ID_TOP_TIER_SUFFIX;
			}

			requestParams['leaderboardName'] += TIER_LEADERBOARD_SUFFIX + playerTierIndex;
		}
	}

	var isCheater = (doNotCheckCheater !== true)
		? isPlayerBannedInternal()
		: undefined;

	if (isCheater) {
		requestParams['leaderboardName'] = convertLeaderboardNameToCheaters(requestParams['leaderboardName']);
	} else if (reservedId != undefined && reservedId != null) {
		requestParams['reservedId'] = reservedId;
	}
	http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

	requestParams['gameId'] = script.titleId + TITLE_ID_GLOBAL_SUFFIX;
	requestParams['leaderboardName'] = leaderboardName;
	delete requestParams.reservedId;
	if (isCheater) {
		requestParams['leaderboardName'] = convertLeaderboardNameToCheaters(requestParams['leaderboardName']);
	}
	http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
};

handlers.getPlayerLeaderboard = function (args) {
	var leaderboardData = [];

	var data = server.GetTitleInternalData({
		"Keys" : [ "eventLeaderboardTutorial" ]
	});

	var tutorialLeaderboardData = JSON.parse(data.Data["eventLeaderboardTutorial"]);

	if (tutorialLeaderboardData
		&& tutorialLeaderboardData.leaderboardName
		&& tutorialLeaderboardData.leaderboardName == args.leaderboardName
	) {
		leaderboardData = [];

		var readOnlyData = server.GetUserInternalData({
			"PlayFabId": currentPlayerId,
			"Keys": [ args.leaderboardName ]
		});

		if (readOnlyData.Data[args.leaderboardName]) {
			var entries = JSON.parse(readOnlyData.Data[args.leaderboardName].Value);
			for(var idx = 0; idx < entries.length; idx++) {
				leaderboardData.push(entries[idx].player);
				leaderboardData.push(entries[idx].value);
			}
		}
	} else {
		var requestParams = {
			"playerId": getPlayerLeaderboardId(),
			"readOnly": true
		};

		requestParams['gameId'] = script.titleId;
		var leaderboardName = args.leaderboardName;

		if (isLeaderboardTierSupported(args.leaderboardName)) {
			var playerTierIndex = getPlayerTierIndex();
			if (playerTierIndex >= 0) {
				var topTierIndex = getTopTierId();
				if (topTierIndex > 0 && topTierIndex == playerTierIndex) {
					requestParams['gameId'] = script.titleId + TITLE_ID_TOP_TIER_SUFFIX;
				}

				leaderboardName = args.leaderboardName + TIER_LEADERBOARD_SUFFIX + playerTierIndex;
			}
		}

		var cheater = isPlayerBannedInternal();
		requestParams['leaderboardName'] = (cheater)
			? convertLeaderboardNameToCheaters(leaderboardName)
			: leaderboardName;

		var requestUrl = getUWSServer() + "Leaderboard/GetPlayerLeaderboard";
		var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

		leaderboardData = JSON.parse(rawResponse);
		if (leaderboardData == -1) {
			leaderboardData = [];
		}

		var maxLeaderboardSize = SHORT_LEADERBOARD_BUCKET_SIZE + SHORT_LEADERBOARD_BUCKET_SIZE;

		if (cheater
			&& leaderboardData.length < (maxLeaderboardSize)
		) {
			requestParams['leaderboardName'] = leaderboardName;

			var noCheaterTier = getPlayerTierIndex(true);
			if (noCheaterTier >= 0) {
				requestParams['leaderboardName'] += (TIER_LEADERBOARD_SUFFIX + noCheaterTier);
			}
			var noCheaterRawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
			var noCheaterLeaderboardData = JSON.parse(noCheaterRawResponse);
			if (noCheaterLeaderboardData == -1) {
				noCheaterLeaderboardData = [];
			}

			if (noCheaterLeaderboardData.length > 0) {
				for(var idx = 0;
					idx < noCheaterLeaderboardData.length - 1
						&& leaderboardData.length < maxLeaderboardSize;
					idx += 2
				) {
					var player = noCheaterLeaderboardData[idx];
					var score = noCheaterLeaderboardData[idx + 1];

					if (player
						&& score
						&& leaderboardData.indexOf(player) < 0
						&& score > 0
					) {
						leaderboardData.push(player);
						leaderboardData.push(score);
					}
				}

				var leaderboardDataObjects = [];
				for (var idx = 0; idx < leaderboardData.length; idx += 2) {
					leaderboardDataObjects.push({
						"player" : leaderboardData[idx],
						"score" : leaderboardData[idx + 1]
					});
				}

				leaderboardDataObjects.sort((x, y) => {
					return y.score - x.score;
				});

				leaderboardData = [];
				for(var idx = 0; idx < leaderboardDataObjects.length; idx++) {
					var dataPoint = leaderboardDataObjects[idx];
					leaderboardData.push(dataPoint.player);
					leaderboardData.push(dataPoint.score);
				}
			}
		}
	}

	return { 'value' :leaderboardData };
}

handlers.getLeaderboardByName = function (args) {
	var result = {
		"value": {}
	};

	if (isPlayerBannedInternal()) {
		args.leaderboardName = convertLeaderboardNameToCheaters(args.leaderboardName);
	}

	var requestParams = {};

	requestParams['gameId'] = script.titleId;
	requestParams['leaderboardName'] = args.leaderboardName;

	var requestUrl = getUWSServer() + "Leaderboard/GetLeaderboardByName";
	var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
	var leaderboardData = JSON.parse(rawResponse);
	if (leaderboardData == -1) {
		leaderboardData = [];
	}

	result.value = leaderboardData;

	return result;
}

var getPlayerRankInternal = function(args) {
	var result = {};

	var requestParams = {
		"playerId": getPlayerLeaderboardId(),
		"gameId": script.titleId + TITLE_ID_GLOBAL_SUFFIX,
		"leaderboardName": args.leaderboardName
	};

	requestUrl = getUWSServer() + "Leaderboard/GetRank";
	var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
	result = JSON.parse(rawResponse);

	return result;
}

handlers.getPlayerRank = function(args) {
	var result = {
		'value': {
			'rank': -1,
			'size': 0
		}
	};

	var rankData = getPlayerRankInternal(args);

	if (rankData != undefined && rankData != null) {
		result.value = rankData;
	}

	return result;
}

var getPlayerTierAndRankInternal = function(args) {
	var result = {};

	result['tier'] = getPlayerTierIndex();

	if (result['tier'] == null
		|| result['tier'] == undefined
		|| result['tier'] < 0
	) {
		result['tier'] = 0;
	}

	var rankData = getPlayerRankInternal(args);
	if (rankData != null && rankData != undefined) {
		result['rank'] = rankData.rank;
		result['size'] = rankData.size;
	} else {
		result['rank'] = -1;
		result['size'] = -1;
	}

	return result;
};

handlers.getPlayerTierAndRank = function(args) {
	var result = { 'value': -1 };
	result.value = getPlayerTierAndRankInternal(args);

	if (result.value == null || result.value == undefined) {
		result.value = {};
	}

	result.value['movingToTier'] = calculateNextTier(result.value.rank, result.value.size);

	return result;
}

handlers.getPlayerLeaderboardTier = function(args) {
	var result = {'value': -1};

	result.value = getPlayerTierIndex();

	return result;
}

var calculateNextTier = function(rank, size) {
	var result = 0;

	if (rank != null
		&& rank != undefined
		&& size != null
		&& size != undefined
		&& rank >= 0
		&& size > 0
	) {
		var tierServerData = getTitleTierData();

		if (tierServerData != null
			&& tierServerData != undefined
			&& tierServerData.hasOwnProperty('tiers')
			&& tierServerData.tiers != undefined
			&& tierServerData.tiers != null
		) {
			for(var idx = tierServerData.tiers.length - 1; idx >= 0; idx--) {
				if (tierServerData.tiers[idx].hasOwnProperty('players')) {
					if (tierServerData.tiers[idx].players >= rank) {
						result = idx;
						break;
					}
				} else if (tierServerData.tiers[idx].hasOwnProperty('percent')) {
					var playerPercent = rank / size;
					if (tierServerData.tiers[idx].percent >= playerPercent) {
						result = idx;
						break;
					}
				}
			}
		}
	}

	return result;
}

handlers.updatePlayerLeaderboardTier = function(args) {
	var result = {'value': -1};

	var nextTier = -1;
	var data = server.GetTitleInternalData({
		"Keys" : [ "eventLeaderboardTutorial" ]
	});

	var tutorialLeaderboardData = JSON.parse(data.Data["eventLeaderboardTutorial"]);

	if (tutorialLeaderboardData
		&& tutorialLeaderboardData.leaderboardName
		&& tutorialLeaderboardData === args.leaderboardName
	) {
		nextTier = 0;
	} else {
		var rankData = getPlayerRankInternal(args);
		nextTier = (rankData != null && rankData != undefined)
			? calculateNextTier(rankData.rank, rankData.size)
			: 0;
	}

	// reset tier for cheaters here to
	// minimize race conditions with
	// banning
	if (isPlayerBannedInternal()) {
		nextTier = -1;
	}

	result.value = updatePlayerTierData(null, {'tier': nextTier}, args.leaderboardName);

	updatePlayerProfileInternal(currentPlayerId,
		{ 'leaderboardTier' : nextTier }
	);

	return result;
};

var getPlayerLeaderboardId = function () {
	var result = currentPlayerId;
	var accInfo = server.GetUserAccountInfo({ "PlayFabId": currentPlayerId });
	var displayName = accInfo["UserInfo"]["TitleInfo"]["DisplayName"];

	if (displayName != undefined) {
		result += "|" + displayName;
	}

	return result;
};

var getUWSServer = function () {
	var result = "";
	if (SERVER_CONFIG.leaderboardServers.hasOwnProperty(script.titleId)) {
		result = SERVER_CONFIG.leaderboardServers[script.titleId];
	} else {
		log.debug("Unable to locate leaderboard server");
	}
	return result;
};
