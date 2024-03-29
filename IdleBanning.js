
var getCheaterData = function(playerId, keysArray) {
	var data = {
		"PlayFabId": playerId,
		"Keys": keysArray
	};

    var readOnlyData = server.GetUserReadOnlyData(data);
	if (readOnlyData
		&& readOnlyData.Data
		&& Object.keys(readOnlyData.Data).length
	) {
		return readOnlyData;
	}

	return server.GetUserInternalData(data);
}

var setCheaterData = function(playerId, updateData, keysToDeleteArray) {
    var data = {};
    data["PlayFabId"] = playerId;

    if (updateData) {
        data["Data"] = updateData;
    }

    if (keysToDeleteArray) {
        data["KeysToRemove"] = keysToDeleteArray;
    }

	return server.UpdateUserInternalData(data);
}

var isPlayerBannedInternal = function() {
	var result = false;

	var data = getCheaterData(
        currentPlayerId,
		[ IS_CHEATER ]
	);

	if (data.Data.hasOwnProperty(IS_CHEATER)) {
		var flag = JSON.parse(data.Data.isCheater.Value);
		result = (flag === true);
	}

	return result;
}
handlers.isPlayerBanned = isPlayerBannedInternal;

handlers.hasRecordTimestamp = function(args) {
	var result = {
		'success' : true,
		'hasData' : isPlayerBannedInternal()
	};

	return { "value" : result };
}

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

	SendLogglyError(banData.origin, banData);
}

var getPlayersWithScoreToReset = function(leaderboardName) {
	var result = {};

	result[currentPlayerId] = null;
	result[getPlayerLeaderboardId()] = null;

	var requestParams = {};
	requestParams['gameId'] = script.titleId;
	requestParams['key'] = TITLE_ID_GLOBAL_SUFFIX
		+ leaderboardName
		+ GLOBAL_LEADERBOARD_BUCKET;

	var requestUrl = getUWSServer() + "Cache/ZScore";

	for(var id in result) {
		requestParams['member'] = id;
		var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
		var score = JSON.parse(rawResponse);

		if (score != undefined
			&& score != null
		) {
			result[id] = score;
		} else {
			delete result[id];
		}
	}
	return result;
}

var banUserInternally = function (args) {
	var data = {};
	data[IS_CHEATER] = true;

	var updateResult = setCheaterData(currentPlayerId, data);

	var banData = {
		'origin': (args.origin && args.origin.trim()) ? args.origin : "clientAutoBan",
		"ban": data[IS_CHEATER]
	};

	if (args != null
		&& args != undefined
		&& args.hasOwnProperty("leaderboardName")
		&& args.leaderboardName.length > 0
		&& args.leaderboardName.trim()
	) {
		// find player entries in global leaderboard
		var playerToResetToScore = getPlayersWithScoreToReset(args.leaderboardName);
		var maxScore = 0;

		if (playerToResetToScore) {
			// get max player score in leaderboard
			// and reset all scores
			maxScore = playerToResetToScore[getPlayerLeaderboardId()];

			var playerTier = getPlayerTierIndex(true);

			for(var fieldName in playerToResetToScore) {
				sendUwsUpdateLeaderboardRequest(
					fieldName,
					args.leaderboardName,
					0,
					'Last',
					playerTier,
					true
				);
			};
		}

		// send write request with player flagged as cheater
		banData['leaderboard'] = args.leaderboardName;
		banData['score'] = maxScore;

		sendUwsUpdateLeaderboardRequest(
			getPlayerLeaderboardId(),
			args.leaderboardName,
			maxScore
		);

		// LS NOTE : We no longer reset leaderboard tier
		// as we use the original leaderboard to pad the
		// cheater leaderboard if cheater leaderboard has
		// less entries than original leaderboard
	}

	updateBanLog(banData);

	return updateResult;
}
// only to be used by 1.103 and older devices
// and admin tool
handlers.banUser = function(args) {
	return banUserInternally(args);
}

// new client api to trigger auto banning
handlers.recordTimestamp = function(args) {
	return banUserInternally(args);
}

handlers.unbanUser = function (args) {
	var banData = { "ban": false };

	var updateResult = setCheaterData(currentPlayerId,
        undefined,
        ["isCheater"]
    );

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
		updatePlayerStatistic(args.leaderboardName, args.value, "Maximum", undefined, args.reservedId);

		banData['tier'] = playerTier;
		banData['leaderbord'] = args.leaderboardName;
	}

	updateBanLog(banData);

	return updateResult;
}

// api to internally migrate all players cheater
// data from readOnly to Internal
handlers.cheaterMigrationCopyReadOnlyDataKeysIntoInternalData = function(args) {
	var result = { 'success' : false };

	if (args
		&& args.playerId
	) {
		result.success = true;
		var cheaterReadOnlyKeys = [ IS_CHEATER, CHAT_BAN_TIMESTAMP_KEY ];

		var readOnly = server.GetUserReadOnlyData({
			"PlayFabId": args.playerId,
			"Keys": cheaterReadOnlyKeys
		});

		if (readOnly
			&& readOnly.Data
			&& Object.keys(readOnly.Data).length > 0
		) {
			result['result'] = server.UpdateUserInternalData({
				"PlayFabId": args.playerId,
				"Data": readOnly.Data
			});
		}

		return result;
	}

	return result;
}

// api to delete cheater readOnly
// data
handlers.cheaterMigrationRemoveReadOnlyDataKeys = function(args) {
	var result = { 'success' : false };

	if (args
		&& args.playerId
	) {
		server.UpdateUserReadOnlyData({
			"PlayFabId": args.playerId,
			"KeysToRemove": [ IS_CHEATER, CHAT_BAN_TIMESTAMP_KEY ]
		});

		result.success = true;
	}

	return result;
}
