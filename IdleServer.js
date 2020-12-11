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

var isPlayerBannedInternal = function() {
	var result = false;

	var data = server.GetUserReadOnlyData({
		"PlayFabId": currentPlayerId,
		"Keys": [ "isCheater"]
	});

	if (data.Data.hasOwnProperty("isCheater")) {
		var flag = JSON.parse(data.Data.isCheater.Value);
		result = (flag === true);
	}

	return result;
}
handlers.isPlayerBanned = isPlayerBannedInternal;

var getPlayerBanLog = function() {
	var result = null;

	var banLog = "banLog";

	var playerInternalData = server.GetUserInternalData({
		"PlayFabId": currentPlayerId,
		"Keys": [ banLog ]
	});

	if (playerInternalData != undefined
		&& playerInternalData != null
		&& playerInternalData.hasOwnProperty("Data")
		&& playerInternalData.Data != null
		&& playerInternalData.Data != undefined
	) {
		if (playerInternalData.Data.hasOwnProperty(banLog)
			&& playerInternalData.Data[banLog] != null
			&& playerInternalData.Data[banLog] != undefined
			&& playerInternalData.Data[banLog].hasOwnProperty("Value")
			&& playerInternalData.Data[banLog].Value != undefined
			&& playerInternalData.Data[banLog].Value != null
		) {
			var banLogData = JSON.parse(playerInternalData.Data[banLog].Value);

			if (banLogData != undefined && banLogData != null) {
				result = banLogData;
			} else {
				result = [];
			}
		}
	}

	return result;
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

var updateBanLog = function(banData) {
	var banLogData = getPlayerBanLog();

	if (banLogData == undefined
		|| banLogData == null
		|| !Array.isArray(banLogData)
	) {
		banLogData = [];
	}

	var now = new Date();
	var serverTime = now.getTime() / 1000;

	banData["time"] = serverTime;
	banLogData.push(banData);

	while (banLogData.length > HISTORY_LOG_SIZE) {
		banLogData.shift();
	}

	server.UpdateUserInternalData({
		"PlayFabId": currentPlayerId,
		"Data":{
			"banLog": JSON.stringify(banLogData)
		}
	});
}

handlers.banUser = function (args) {
	var readOnlyData = server.GetUserReadOnlyData({ "PlayFabId": currentPlayerId });
	var data = {};
	data["isCheater"] = true;
	readOnlyData["Data"] = data;

	var updateResult = server.UpdateUserReadOnlyData(readOnlyData);

	var banData = { "ban": data["isCheater"] };

	if (args != null
		&& args != undefined
		&& args.hasOwnProperty("leaderboardName")
		&& args.leaderboardName.length > 0
		&& args.leaderboardName.trim()
	) {
		// NOTE : we only reset tier if there is leaderboard specified.
		// This is due to the client (v35) auto banning not working correctly
		var playerTier = getPlayerTierIndex();

		var playerRedisKey = getPlayerLeaderboardId();

		sendUwsUpdateLeaderboardRequest(
			playerRedisKey,
			args.leaderboardName,
			0,
			'Last',
			playerTier
		);

		var playerRedisKeys = playerRedisKey.split('|');
		if (playerRedisKeys.length > 1) {
			sendUwsUpdateLeaderboardRequest(
				playerRedisKeys[0],
				args.leaderboardName,
				0,
				'Last',
				playerTier
			);
		}

		updatePlayerTierData(null, {'tier': -1}, "banUser:"+args.leaderboardName);

		banData['tier'] = playerTier;
		banData['leaderbord'] = args.leaderboardName;
	}

	updateBanLog(banData);

	return updateResult;
}

handlers.unbanUser = function (args) {
	var banData = { "ban": false };

	var updateResult = server.UpdateUserReadOnlyData({
		"PlayFabId": currentPlayerId,
		"KeysToRemove" : ["isCheater"]
	});

	if (args != null
		&& args != undefined
		&& args.hasOwnProperty("tier")
		&& !isNaN(args.tier)
		&& args.hasOwnProperty("leaderboardName")
		&& args.leaderboardName.length > 0
		&& args.leaderboardName.trim()
		&& args.hasOwnProperty("value")
		&& !isNaN(args.value)
	) {
		var playerTier = args.tier;

		updatePlayerTierData(null, {'tier': playerTier}, "unbanUser:"+args.leaderboardName);
		updatePlayerStatistic(args.leaderboardName, args.value, "Maximum", playerTier);

		banData['tier'] = playerTier;
		banData['leaderbord'] = args.leaderboardName;
	}

	updateBanLog(banData);

	return updateResult;
}

var buildEventTutorialLeaderboardEntries = function(playerLeaderboardId, amout, tutorialConfig) {
	var entries = [
		{
			"player" : playerLeaderboardId,
			"amount" : amout
		}
	];

	if (tutorialConfig && tutorialConfig.entries) {
		for(var idx = 0; idx < tutorialConfig.entries.length; idx++) {
			var entry = tutorialConfig.entries[idx];

			var entryIdx = 0;
			for(entryIdx; entryIdx < entries.length; entryIdx++) {
				if (entries[entryIdx].amount >= entry.amount) {
					entries.splice(entryidx, 0, entry);
					break;
				}
			};

			if (entryIdx >= entries.length) {
				entries.push(entry);
			}
		}
	}

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

var getPlayerTierIndex = function() {
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
	var updates = -1;

	var logData = [];

	if (!isPlayerBannedInternal(currentPlayerId)) {
		updates = 0;

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
					var entries = {};
					entries[leaderboardName] = buildEventTutorialLeaderboardEntries(
						getPlayerLeaderboardId(),
						value,
						tutorialLeaderboardData
					);

					logData.push({'Data': entries});

					server.UpdateUserReadOnlyData({
						"PlayFabId": currentPlayerId,
						"Data" : entries
					});
				} else {
					var updateType = args.statistics[i]["AggregationMethod"];

					updatePlayerStatistic(leaderboardName, value, updateType);
				}

				updates++;
			}
		}
	}

	return { "value":updates, "log" : logData};
};

var updatePlayerStatistic = function (leaderboardName, value, updateType, tierOverride) {
	sendUwsUpdateLeaderboardRequest(
		getPlayerLeaderboardId(),
		leaderboardName,
		value,
		updateType,
		tierOverride
	);
}

var sendUwsUpdateLeaderboardRequest = function(playerRedisKey, leaderboardName, value, updateType, tierOverride) {
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
				requestParams['gameId'] = script.titleId + TITLE_ID_TOP_TIER_SUFIX;
			}

			requestParams['leaderboardName'] = leaderboardName + '_Tier' + playerTierIndex;
		}
	}

	http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

	requestParams['gameId'] = script.titleId + TITLE_ID_GLOBAL_SUFIX;
	requestParams['leaderboardName'] = leaderboardName;
	http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
};

handlers.getPlayerLeaderboard = function (args) {
	var result = {
		"value": { }
	};

	var data = server.GetTitleInternalData({
		"Keys" : [ "eventLeaderboardTutorial" ]
	});

	var tutorialLeaderboardData = JSON.parse(data.Data["eventLeaderboardTutorial"]);

	if (tutorialLeaderboardData
		&& tutorialLeaderboardData.leaderboardName
		&& tutorialLeaderboardData.leaderboardName == args.leaderboardName
	) {
		var readOnlyData = server.GetUserReadOnlyData({
			"PlayFabId": currentPlayerId,
			"Keys": [ args.leaderboardName ]
		});

		log.info(readOnlyData.Data);

		var entries = readOnlyData.Data[args.leaderboardName].Value
		result.value = [];
		for(var idx = 0; idx < entries.length; idx++) {
			result.value.push(entries[idx].player);
			result.value.push(entries[idx].value);
		}

		return result;
	}

	var requestParams = {
		"playerId": getPlayerLeaderboardId(),
		"readOnly": true
	};

	requestParams['gameId'] = script.titleId;
	requestParams['leaderboardName'] = args.leaderboardName;

	if (isLeaderboardTierSupported(args.leaderboardName)) {
		var playerTierIndex = getPlayerTierIndex();
		if (playerTierIndex >= 0) {
			var topTierIndex = getTopTierId();
			if (topTierIndex > 0 && topTierIndex == playerTierIndex) {
				requestParams['gameId'] = script.titleId + TITLE_ID_TOP_TIER_SUFIX;
			}

			requestParams['leaderboardName'] = args.leaderboardName + '_Tier' + playerTierIndex;
		}
	}

	var requestUrl = getUWSServer() + "Leaderboard/GetPlayerLeaderboard";
	var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
	var leaderboardData = JSON.parse(rawResponse);
	if (leaderboardData == -1) {
		leaderboardData = [];
	}

	result.value = leaderboardData;

	return result;
}

handlers.getLeaderboardByName = function (args) {
	var result = {
		"value": {}
	};

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
		"gameId": script.titleId + TITLE_ID_GLOBAL_SUFIX,
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
	if (!isPlayerBannedInternal(currentPlayerId)) {
		var rankData = getPlayerRankInternal(args);

		nextTier = (rankData != null && rankData != undefined)
			? calculateNextTier(rankData.rank, rankData.size)
			: 0;

		result.value = updatePlayerTierData(null, {'tier': nextTier}, args.leaderboardName);
	}

	updatePlayerTierData(null, {'tier': nextTier}, args.leaderboardName);

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

var GetLogglyTag = function () {
	var result = null;

	var playfabGameId = script.titleId;
	if (playfabGameId != null && playfabGameId != undefined) {
		if (SERVER_CONFIG.logglyTag.hasOwnProperty(playfabGameId)) {
			result = SERVER_CONFIG.logglyTag[playfabGameId];
		} else {
			log.debug("Unable to locate Loggly environment tag for " + playfabGameId);
		}
	}

	return result;
}

var SendLogglyError = function (source, content) {
	var logglyTag = this.GetLogglyTag();

	content["source"] = source;

	if (logglyTag != null && logglyTag != undefined) {
		content["logglyTag"] = logglyTag;
		http.request("http://logs-01.loggly.com/inputs/" + LOGGLY_TOKEN + "/tag/" + logglyTag + "/", "post", JSON.stringify(content), "application/json");
	}

	console.log(JSON.stringify(content));
}

