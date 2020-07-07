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

 const HISTORY_LOG_SIZE = 100;

const SUCCESS_CODE = 200;
const RESOURCE_LOCKED_CODE = 423;
const TIER_LEADERBOARD_KEY = 'tieredLeaderboardData';
const TITLE_ID_TOP_TIER_SUFIX = '_TopTier';
const TITLE_ID_GLOBAL_SUFIX = '_Global';

const SERVER_CONFIG = {
	leaderboardServers: {
		"3D16B": "http://UltrabitWebServicesProd.ya4zvdebvk.us-west-2.elasticbeanstalk.com/", // kongregate/production
		"19081": "http://uws-dev-env.ddhjvp3mrf.us-west-1.elasticbeanstalk.com/", // staging
		"18A45": "http://uws-dev-env.ddhjvp3mrf.us-west-1.elasticbeanstalk.com/"  // auto
	}
};

const PLAYFAB_ENVIRONMENT_CONFIG = {
	configs: {
		"18A45": {
			apiKey: "ORX7Y8EKSK5DD1MOKUE86X5D64RQ774359ICEJJMN7U176GOBF", // playfab auto
			logglyTag: 'idle-spongebob-auto-ops'
		},
		"3D16B": {
			apiKey: "9QPQ1B5Q64G8Q3DAJE9WUFTC957UP3MZADYICBD97SWBXG853J",   // playfab kongregate
			logglyTag: 'idle-spongebob-kongregate-ops'
		}
	},
	playfabIds: ["3D16B", "18A45"]
};

const LOGGLY_TOKEN = '00cced27-e9fd-49e2-b332-87d611e71937';

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

	if (!isPlayerBannedInternal(currentPlayerId)) {
		updates = 0;
		if (args.hasOwnProperty("statistics") && args.statistics != null && args.statistics != undefined) {
			for (var i = 0; i < args.statistics.length; i++) {
				var leaderboardName = args.statistics[i]["StatisticName"];
				var value = args.statistics[i]["Value"];
				var updateType = args.statistics[i]["AggregationMethod"];

				updatePlayerStatistic(leaderboardName, value, updateType);
				updates++;
			}
		}
	}

	return { "value":updates};
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

/*
 * args : no arguments needed
 */
handlers.forceResetLeaderboards = function (args) {
	const LEADERBOARD_KEY_PREFIX = "ResetLeaderboard_";

	var result = [];
	var reqObj = new CloudRequest(args);

	var responseData = server.GetTitleData({ "Keys": null });
	if (responseData != null && responseData != undefined) {
		var now = new Date();
		var serverTime = now.getTime();

		var titleData = responseData.Data;
		var titleDataKeys = Object.keys(titleData);

		for (var i = 0; i < titleDataKeys.length; i++) {
			var dataKey = titleDataKeys[i];

			if (dataKey.length > LEADERBOARD_KEY_PREFIX.length && dataKey.substring(0, LEADERBOARD_KEY_PREFIX.length) == LEADERBOARD_KEY_PREFIX) {
				if (titleData.hasOwnProperty(dataKey) && titleData[dataKey] != null && titleData[dataKey] != undefined && titleData[dataKey] != "") {
					var dateString = titleData[dataKey];
					var date = Date.parse(dateString);

					if (!Number.isNaN(date)) {
						if (serverTime >= date) {
							var leaderboardName = dataKey.substring(LEADERBOARD_KEY_PREFIX.length);
							responseData = resetLeaderBoardInternal(reqObj, leaderboardName, 0, 0);
							if (responseData["success"]) {
								responseData = server.SetTitleData({
									"Key": dataKey,
									"Value": ""
								});
								if (responseData != null && responseData != undefined) {
									result.push("Reset OK : " + dataKey + " : " + leaderboardName);
								} else {
									var message = "Failed to clear date for " + dataKey + " : " + leaderboardName;
									reqObj.SendLogglyError(
										'Playfab.Automation.forceResetLeaderboards',
										{
											"message": message,
											"request": responseData
										}
									);
								}
							} else {
								var message = "Failed to reset leaderboard " + leaderboardName;
								reqObj.SendLogglyError(
									'Playfab.Automation.forceResetLeaderboards',
									{
										"message": message,
										"request": responseData
									}
								);
							}
						}
					} else {
						var message = "Invalid date : " + dateString;
						reqObj.SendLogglyError(
							'Playfab.Automation.forceResetLeaderboards',
							{
								"message": message
							}
						);
					}
				} else {
					result.push("Not set : " + dataKey);
				}
			}
		}
	} else {
		var message = "Failed to retrieve title data";
		reqObj.SendLogglyError(
			'Playfab.Automation.forceResetLeaderboards',
			{
				"message": message
			}
		);
	}

	return result;
}

/*
 * args : passed through playfab game manager in json format :
 * {
 * 		"resetPeriod" : <value in seconds>
 * 		"whiteList" : list of leaderboard names to reset
 * }
 */
handlers.resetLeaderboard = function (args) {
	var requestResult = null;

	var reqObj = new CloudRequest(args);
	if (reqObj.IsPlayfab()) {
		if (args.hasOwnProperty("resetPeriod") && args.resetPeriod != null && args.resetPeriod != undefined) {
			try {
				var resetPeriod = args["resetPeriod"];
				var statisticsResult = [];
				var statisticsOmitted = [];
				var errorReason = null;
				var resetLeaderboard = 0;

				var content = {};
				var responseData = reqObj.SendPlayFabAdminRequest(content, 'GetPlayerStatisticDefinitions');
				if (responseData["code"] == SUCCESS_CODE) {
					var statistics = responseData["data"]["Statistics"];

					for (var i = 0; i < statistics.length; i++) {
						if (args.hasOwnProperty("whiteList") && args.whiteList != null && args.whiteList != undefined && !args.whiteList.includes(statistics[i]["StatisticName"])) {
							statisticsOmitted.push(statistics[i]["StatisticName"]);
							continue;
						}

						responseData = resetLeaderBoardInternal(reqObj, statistics[i]["StatisticName"], resetPeriod, args.resetGracePeriod);
						if (responseData["success"]) {
							if (responseData["reseted"]) {
								resetLeaderboard++;
							}

							statisticsResult.push(responseData["data"]);
						} else {
							errorReason = responseData["error"];
							break;
						}
					}
				} else {
					errorReason = responseData["code"] + "Failed to retrieved statistics";
				}

				requestResult = {
					"success": (responseData["code"] == SUCCESS_CODE && resetLeaderboard > 0),
					"code": responseData["code"],
					"statistics": statisticsResult,
					"statisticsOmitted": statisticsOmitted,
					"reason": errorReason,
					"resetLeaderboardsCount": resetLeaderboard
				};

				if (responseData["code"] == SUCCESS_CODE) {
					if (resetLeaderboard <= 0) {
						requestResult["reason"] = "Failed to reset at least one leaderboard; " + responseData["code"] + "; " + errorReason;
						requestResult["code"] = 500;
					} else if (resetLeaderboard > 1) {
						reqObj.SendLogglyError('Playfab.Automation.resetLeaderboard (multiple resets)', requestResult);
					}
				}

			} catch (err) {
				requestResult = { "success": false, "code": 500, "reason": err.message };
			}
		} else {
			requestResult = { "success": false, "code": 500, "reason": 'missing resetPeriod argument' };
		}
	} else {
		requestResult = { "success": false, "code": 500, "reason": 'missing playfabId argument' };
		throw Error(JSON.stringify(requestResult));
	}

	if (!requestResult["success"]) {
		reqObj.SendLogglyError('Playfab.Automation.resetLeaderboard', requestResult);
	}

	return requestResult;
}

/*
* args :
* {
*             none
* }
*/
const UPDATE_SOFTWALL_LEADERBOARD_STATISTIC_NAME = "soft_wall";
const UPDATE_SOFTWALL_LEADERBOARD_IN32_MAX = 2147483600;
const USER_BLOB_RESOURCES_KEY = "resources";
const USER_BLOB_RESOURCES_LEADERBOARD_TOKENS_KEY = "LeaderboardToken";
handlers.distributedUpdateSoftwallLeaderboardScoreForPlayer = function () {
	var playerId = currentPlayerId;

	var getUserDataResult = server.GetUserData({
		"PlayFabId": playerId,
		"Keys": ["user"]
	});
	if (getUserDataResult && getUserDataResult.hasOwnProperty("Data") && getUserDataResult.Data != undefined) {
		// User specific data for this title. DataDict<String, UserDataRecord>
		var playerData = getUserDataResult.Data;
		if (playerData && playerData.hasOwnProperty("user") && playerData.user != undefined) {
			var userDataRecord = playerData.user;
			if (userDataRecord.hasOwnProperty("Value") && userDataRecord.Value != undefined) {
				var userBlobString = userDataRecord.Value;
				// ALH probably expensive, evaluate performance improvements here.
				var userBlob = JSON.parse(userBlobString);
				if (userBlob.hasOwnProperty(USER_BLOB_RESOURCES_KEY) && userBlob[USER_BLOB_RESOURCES_KEY] != undefined) {
					var resources = userBlob[USER_BLOB_RESOURCES_KEY];
					var leaderboardTokens = 0;

					if (resources.hasOwnProperty(USER_BLOB_RESOURCES_LEADERBOARD_TOKENS_KEY) && resources[USER_BLOB_RESOURCES_LEADERBOARD_TOKENS_KEY] != undefined) {
						leaderboardTokens = Math.max(0, Math.min(resources[USER_BLOB_RESOURCES_LEADERBOARD_TOKENS_KEY], UPDATE_SOFTWALL_LEADERBOARD_IN32_MAX));
					} else {
						log.debug("Error: player blob does not have leaderboard tokens value, setting leaderboard score to 0" + playerId +
							" resources = " + JSON.stringify(updatePlayerStatisticResult));
					}

					var statisticsUpdatePayload = {
						"StatisticName": UPDATE_SOFTWALL_LEADERBOARD_STATISTIC_NAME,
						"Value": leaderboardTokens
					};
					// *** API Call! ***
					var updatePlayerStatisticResult = server.UpdatePlayerStatistics({
						"PlayFabId": playerId,
						"Statistics": [statisticsUpdatePayload],
						"ForceUpdate": true
					});

				} else {
					log.debug("userBlob.resources not found: " + Object.keys(userBlob));
				}
			} else {
				log.debug("userDataRecord.hasOwnProperty('Value') error " + JSON.stringify(userDataRecord));
			}
		} else {
			log.debug("playerData.hasOwnProperty('user') error playerData =" + JSON.stringify(playerData));
		}
	} else {
		log.debug("getUserDataResult error " + JSON.stringify(getUserDataResult));
	}
}

//Functions
var resetLeaderBoardInternal = function (reqObj, leaderboardName, resetPeriod, resetGracePeriod) {
	var statisticsResult = null;
	var errorReason = null;
	var reseted = false;
	var responseData = null;

	if (resetGracePeriod == null || resetGracePeriod == undefined || isNaN(resetGracePeriod)) {
		resetGracePeriod = 0;
	}

	if (leaderboardName != null && leaderboardName != undefined) {
		if (resetPeriod != null && resetPeriod != undefined && resetPeriod >= 0) {
			var content = { "StatisticName": leaderboardName };

			responseData = reqObj.SendPlayFabAdminRequest(content, 'GetPlayerStatisticVersions');
			if (responseData["code"] == SUCCESS_CODE) {
				var statisticVersions = responseData["data"]["StatisticVersions"];
				var latestStatistic = statisticVersions[statisticVersions.length - 1];

				var activationTimeString = latestStatistic["ActivationTime"];
				var activationDate = new Date(activationTimeString);
				var activationTime = activationDate.getTime() / 1000;

				var now = new Date();
				var serverTime = now.getTime() / 1000;
				var timeSpan = serverTime - activationTime;

				if (timeSpan >= (resetPeriod - resetGracePeriod)) {
					responseData = reqObj.SendPlayFabAdminRequest(content, 'IncrementPlayerStatisticVersion');
					if (responseData["code"] == SUCCESS_CODE) {
						var incrementResult = responseData["data"]["StatisticVersion"];

						statisticsResult = {
							"name": leaderboardName,
							"version": incrementResult["Version"],
							"activatedOn": incrementResult["ActivationTime"],
							"secondsToReset": 0,
							"resetGracePeriod": resetGracePeriod
						};
						reseted = true;
					} else {
						errorReason = responseData["code"] + "; Failed to increment statistic version for " + leaderboardName;
					}
				} else {
					statisticsResult = {
						"name": leaderboardName,
						"version": latestStatistic["Version"],
						"activatedOn": latestStatistic["ActivationTime"],
						"secondsToReset": (resetPeriod - timeSpan),
						"resetGracePeriod": resetGracePeriod
					};
				}
			} else {
				errorReason = responseData["code"] + "; Failed to find statistic for " + leaderboardName;
			}
		} else {
			errorReason = "Reset time period is required and cannot be negative: " + resetPeriod;
		}
	} else {
		errorReason = "Leaderboard name is required";
	}

	return {
		"success": (statisticsResult != null && statisticsResult != undefined),
		"data": statisticsResult,
		"error": errorReason,
		"reseted": reseted,
		"code": responseData["code"]
	};
}

//Custom request Obj
var CloudRequest = function (args) {
	this.args = args;
}

CloudRequest.prototype.GetGameId = function () {

	var result = null;
	if (this.args != null && this.args != undefined) {
		if (this.args.hasOwnProperty("gameId") && this.args.gameId != null && this.args.gameId != undefined) {
			result = this.args.gameId;
		}
	}
	return result;
}

CloudRequest.prototype.GetPlayfabGameId = function () {
	var result = script.titleId;

	if (result == null || result == undefined) {
		log.debug("Unable to retrieve playfab game id : " + result);
	}

	return result;
}

CloudRequest.prototype.GetKid = function () {
	var result = null;
	if (this.args != null && this.args != undefined) {
		if (this.args.hasOwnProperty("kid") && this.args.kid != null && this.args.kid != undefined) {
			result = this.args.kid;
		}
	}
	return result;
}

CloudRequest.prototype.GetAuthToken = function () {

	var result = null;
	if (this.args != null && this.args != undefined) {
		if (this.args.hasOwnProperty("token") && this.args.token != null && this.args.token != undefined) {
			result = this.args.token;
		}
	}
	return result;
}

CloudRequest.prototype.GetPlayfabServerApiKey = function () {

	var result = null;
	var playfabGameId = this.GetPlayfabGameId();
	if (playfabGameId != null && playfabGameId != undefined) {
		if (PLAYFAB_ENVIRONMENT_CONFIG.configs.hasOwnProperty(playfabGameId)) {
			result = PLAYFAB_ENVIRONMENT_CONFIG.configs[playfabGameId].apiKey;
		} else {
			log.debug("Unable to locate playfab server api key for " + playfabGameId);
		}
	} else {
		log.debug("Unable to retrieve playfab game id : " + playfabGameId);
	}

	return result;
}

CloudRequest.prototype.IsPlayfab = function () {
	return (PLAYFAB_ENVIRONMENT_CONFIG.playfabIds.indexOf(this.GetPlayfabGameId()) >= 0);
}

CloudRequest.prototype.SendPlayFabAdminRequest = function (content, requestName, server) {
	if (server == undefined || server == null) {
		server = 'Admin';
	}
	var gameId = this.GetPlayfabGameId();
	var secretApiKey = { "X-SecretKey": this.GetPlayfabServerApiKey() };

	var rawResponse = http.request("https://" + gameId + ".playfabapi.com/" + server + "/" + requestName, "post", JSON.stringify(content), "application/json", secretApiKey);
	var response = JSON.parse(rawResponse);

	return { "code": response["code"], "data": response["data"] };
}

CloudRequest.prototype.GetLogglyTag = function () {
	var result = null;

	var playfabGameId = this.GetPlayfabGameId();
	if (playfabGameId != null && playfabGameId != undefined) {
		if (PLAYFAB_ENVIRONMENT_CONFIG.configs.hasOwnProperty(playfabGameId)) {
			result = PLAYFAB_ENVIRONMENT_CONFIG.configs[playfabGameId].logglyTag;
		} else {
			log.debug("Unable to locate Loggly environment tag for " + playfabGameId);
		}
	}

	return result;
}

CloudRequest.prototype.SendLogglyError = function (source, content) {
	var logglyTag = this.GetLogglyTag();

	content["source"] = source;

	if (logglyTag != null && logglyTag != undefined) {
		content["logglyTag"] = logglyTag;
		http.request("http://logs-01.loggly.com/inputs/" + LOGGLY_TOKEN + "/tag/" + logglyTag + "/", "post", JSON.stringify(content), "application/json");
	}

	console.log(JSON.stringify(content));
}

