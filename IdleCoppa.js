
handlers.setAndGetCoppaModel = function(args) {
	var result = {
        "success": false,
        "coppa" : null
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
        var playerProfile = server.GetPlayerProfile({
            "PlayFabId" : currentPlayerId,
            "ProfileConstraints" : args.constrains
        });

        countryCode = playerProfile.Locations[0].CountryCode;
        result.coppa["countryISO3166Code"] = countryCode;
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
    } catch(e) {
        result["error"] = evaluatePlayFabError(e);
        return { "value" : result };
    }

    result.success = true;
    return { "value" : result };

};