
handlers.setAndGetCoppaModel = function(args) {
	var result = {
        "success": false,
        "coppa" : null,
        "saved" : false
	};

    if (args.birthdayTimestamp == null
        || args.birthdayTimestamp == undefined
    ) {
        return result;
    }

    result.coppa = {};
    result.coppa["birthdayTimestamp"] = args.birthdayTimestamp;

    var countryCode = null;
    try {
        var playerProfileResponse = server.GetPlayerProfile({
            "PlayFabId" : currentPlayerId,
            "ProfileConstraints" : args.constrains
        });

        countryCode = playerProfileResponse.PlayerProfile.Locations[0].CountryCode;
        result.coppa["countryCode"] = countryCode;
    } catch(e) {
        result["error"] = evaluatePlayFabError(e);
        return { "value" : result };
    }

    try {
        server.UpdateUserReadOnlyData({
            "PlayFabId" : currentPlayerId,
            "Data" : {
                "coppa" : result.coppa
            }
        });

        result.saved = true;
    } catch(e) {
        result["error"] = evaluatePlayFabError(e);
        return { "value" : result };
    }

    result.success = true;
    return { "value" : result };

};