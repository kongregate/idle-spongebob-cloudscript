
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

var setCheaterData = function(playerId, updateData, keysToDeleteArray, behaviorOverride) {
    var data = {};
    data["PlayFabId"] = playerId;

    if (updateData) {
        data["Data"] = updateData;
    }

    if (keysToDeleteArray) {
        data["KeysToRemove"] = keysToDeleteArray;
    }

	var behavior = (behaviorOverride)
		? behaviorOverride
		: CHEATER_DATA_BEHAVIOR;

    if (behavior === CHEATER_DATA_MIGRATION) {
		server.UpdateUserInternalData(data);
		return server.UpdateUserReadOnlyData(data);
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
}

var banUserInternally = function (args, behaviorOverride) {
	var data = {};
	data[IS_CHEATER] = true;

	var updateResult = setCheaterData(currentPlayerId,
        data,
        undefined,
		behaviorOverride
    );

	var banData = { "ban": data[IS_CHEATER] };

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
// only to be used by 1.103 and older devices
// and admin tool
handlers.banUser = function(args) {
	return banUserInternally(args, CHEATER_DATA_MIGRATION);
}

// new client api to trigger auto banning
handlers.recordTimestamp = function(args) {
	return banUserInternally(args, CHEATER_DATA_INTERNAL);
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
		updatePlayerStatistic(args.leaderboardName, args.value, "Maximum", playerTier);

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
