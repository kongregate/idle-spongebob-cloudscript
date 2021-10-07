
var getCheaterData = function(playerId, keysArray, location) {
	var data = {
		"PlayFabId": playerId,
		"Keys": keysArray
	};

    if (location === CHEATER_DATA_READ_ONLY) {
        return server.GetUserReadOnlyData(data);
    } else if (location === CHEATER_DATA_INTERNAL) {
		return server.GetUserInternalData(data);
    }

    return undefined;
}

var setCheaterData = function(playerId, updateData, keysToDeleteArray, location) {
    var data = {};
    data["PlayFabId"] = playerId;

    if (updateData) {
        data["Data"] = updateData;
    }

    if (keysToDeleteArray) {
        data["KeysToRemove"] = keysToDeleteArray;
    }

    if (location === CHEATER_DATA_READ_ONLY) {
        return server.UpdateUserReadOnlyData(data);
    } else if (location === CHEATER_DATA_INTERNAL) {
		return server.UpdateUserInternalData(data);
    }

    return undefined;
}

var isPlayerBannedInternal = function() {
	var result = false;

	var data = getCheaterData(
        currentPlayerId,
		[ "isCheater"],
        CHEATER_DATA_READ_ONLY
	);

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
	var data = {};
	data["isCheater"] = true;

	var updateResult = setCheaterData(currentPlayerId,
        data,
        undefined,
        CHEATER_DATA_READ_ONLY
    );

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

	var updateResult = setCheaterData(currentPlayerId,
        undefined,
        ["isCheater"],
        CHEATER_DATA_READ_ONLY
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