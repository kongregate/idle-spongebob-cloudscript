
const COPPA = "coppa";

handlers.setAndGetCoppaModel = function(args) {
	var result = {
        "success": false,
        "saved" : false
	};

    if (args.birthdayTimestamp == null
        || args.birthdayTimestamp == undefined
    ) {
        return result;
    }

    result[COPPA] = {};
    result[COPPA]["birthdayTimestamp"] = args.birthdayTimestamp;

    var countryCode = null;
    try {
        var playerProfileResponse = server.GetPlayerProfile({
            "PlayFabId" : currentPlayerId,
            "ProfileConstraints" : args.constrains
        });

        countryCode = playerProfileResponse.PlayerProfile.Locations[0].CountryCode;
        result[COPPA]["countryCode"] = countryCode;
    } catch(e) {
        result["error"] = evaluatePlayFabError(e);
        return { "value" : result };
    }

    try {
        var data = {};
        data[COPPA] = JSON.stringify(result[COPPA]);

        server.UpdateUserReadOnlyData({
            "PlayFabId": currentPlayerId,
            "Data" : data
        });

        result.saved = true;
    } catch(e) {
        result["error"] = evaluatePlayFabError(e);
        return { "value" : result };
    }

    result.success = true;
    return { "value" : result };

};

