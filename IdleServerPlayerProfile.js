const DEFAULT_KONG_NAME = "NoKongName";

var getPlayersProfilesInternal = function(playerIds, functionaName) {
	var requestParams = {
		"gameId": script.titleId,
		"playerIds": playerIds
	};

	var requestUrl = getUWSServer() + "Profile/" + functionaName;
	var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
	var playerProfiles = -1;
	try {
		playerProfiles = JSON.parse(rawResponse);
	} catch (err) {
		log.debug(err.message);
		log.debug(rawResponse);
	}

	return playerProfiles;
}

handlers.getPlayersProfiles = function(args) {
	var result = {
		"playerProfiles": { }
	};

	result.playerProfiles = getPlayersProfilesInternal(args.playerIds, "GetPlayersProfiles");

	if (result.playerProfiles == -1) {
		result.playerProfiles = {};
	}

	return result;
};

handlers.getPlayerProfiles = function(args) {
	var result = {
		"playerProfiles": { }
	};

	result.playerProfiles = getPlayersProfilesInternal(args.playerIds, "GetPlayerProfiles");

	if (result.playerProfiles == -1) {
		result.playerProfiles = {};
	}

	return result;
};

// LS TODO : Once wirting/reading only to UWS Dynamo,
// switch client usage of getPlayerProfiles for getPlayerProfilesByKeyFieldAndValue
handlers.getPlayerProfilesByKeyFieldAndValue = function(args) {
	var result = {
		"playerProfiles": { }
	};

	var requestParams = {
		"gameId": script.titleId,
		"lsiskName": args.fieldName,
		"lsiskValue": args.fieldValue
	};

	var requestUrl = getUWSServer() + "Profile/GetPlayerProfilesByLocalSecondaryIndexSortKey";
	var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
	var profileData = JSON.parse(rawResponse);
	if (profileData == -1) {
		profileData = {};
	}

	result.playerProfiles = profileData;

	return result;
};

var updatePlayerProfileInternal = function(playerId, profile) {
	var requestParams = {
		"gameId": script.titleId,
		"playerId": playerId,
		"profile": profile,
	};

	var requestUrl = getUWSServer() + "Profile/UpdatePlayerProfile";
	return http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
}

/*
* args :
* {
* 		"profile": the calling player's profile data
* }
*/
handlers.updatePlayerProfile = function(args) {
	var result = { 'value': {} };

	if (args == undefined || args == null) {
		args = {};
	}

	if (args.profile == undefined || args.profile == null) {
		args.profile = {};
	} else if (typeof args.profile === "string") {
		args.profile = JSON.parse(args.profile);
	}

	var playerCombinedId = currentPlayerId;
	var accInfo = server.GetUserAccountInfo({ "PlayFabId": playerCombinedId });
	var displayName = accInfo["UserInfo"]["TitleInfo"]["DisplayName"];

	if (displayName == undefined
		|| displayName == null
		|| !displayName
		|| !displayName.trim()
	) {
		displayName = DEFAULT_KONG_NAME;
    }

	args.profile['name'] = displayName;
	args.profile['entityKey'] = server.GetUserAccountInfo(
		{"PlayFabId":currentPlayerId}
	).UserInfo.TitleInfo.TitlePlayerAccount;

	try {
		var rawResponse = updatePlayerProfileInternal(currentPlayerId, args.profile);
		var response = JSON.parse(rawResponse);

		result.value['updated'] = response.success;
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e;
	}

	return result;
};

handlers.searchPlayersForGuild = function(args) {
	var result = { 'value' : { 'uws' : null } };

	try {
		var requestParams = {
			'gameId' : script.titleId,
			'limit' : (args.limit) ? args.limit : 0,
			'kongLogin' : args.kongLogInOnly
		};

		if (args.lastEvaluatedPlayerName != undefined
			&& args.lastEvaluatedPlayerName != null
			&& args.lastEvaluatedPlayerId != undefined
			&& args.lastEvaluatedPlayerId != null
		) {
			requestParams['lastEvaluatedPlayer'] = {
				'id' : args.lastEvaluatedPlayerId,
				'name' : args.lastEvaluatedPlayerName
			}
		}

		var requestUrl = getUWSServer() + "Profile/QueryPlayersPublicProfiles";
		var rawResponse =  http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

		result.value.uws = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e;
	}

	return result;
}

handlers.searchPlayersByName = function(args) {
	var result = { 'value' : { 'uws' : null } };

	if (args.name == undefined || args.name == null) {
		return result;
	}

	try {
		var requestParams = {
			'gameId' : script.titleId,
			'limit' : (args.limit) ? args.limit : 0,
			'name' : args.name
		};

		if (args.lastEvaluatedPlayerName != undefined
			&& args.lastEvaluatedPlayerName != null
			&& args.lastEvaluatedPlayerId != undefined
			&& args.lastEvaluatedPlayerId != null
		) {
			requestParams['lastEvaluatedPlayer'] = {
				'id' : args.lastEvaluatedPlayerId,
				'name' : args.lastEvaluatedPlayerName
			}
		}

		var requestUrl = getUWSServer() + "Profile/QueryPlayersPublicProfilesByName";
		var rawResponse =  http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

		result.value.uws = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e;
	}

	return result;
}
