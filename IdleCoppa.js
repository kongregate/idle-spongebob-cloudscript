
const COPPA = "coppa";

handlers.setCoppaModel = function(args) {
	var result = {
        "success": false,
        "saved" : false
	};

    // if (args.birthdayTimestamp == null
    //     || args.birthdayTimestamp == undefined
    // ) {
    //     return result;
    // }

    result[COPPA] = {
        "hasAdultConsent": (args.hasAdultConsent === true),
        "isMinor": (args.isMinor === true)
    };
    // result[COPPA]["birthdayTimestamp"] = args.birthdayTimestamp;

    // var countryCode = null;
    // try {
    //     var playerProfileResponse = server.GetPlayerProfile({
    //         "PlayFabId" : currentPlayerId,
    //         "ProfileConstraints" : args.constrains
    //     });

    //     countryCode = playerProfileResponse.PlayerProfile.Locations[0].CountryCode;
    //     result[COPPA]["countryCode"] = countryCode;
    // } catch(e) {
    //     result["error"] = evaluatePlayFabError(e);
    //     return { "value" : result };
    // }

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

handlers.serverOverwriteCoppaData = function(args) {

    var result = {
        "success": false
    };

    var data = undefined;
    var keysToRemove = undefined;

    if (args.forceDelete === true) {
        keysToRemove = [ COPPA ];
    } else if (args[COPPA]) {
        data = {};
        data[COPPA] = JSON.stringify(args[COPPA]);
    }

    try {
        server.UpdateUserReadOnlyData({
            "PlayFabId": currentPlayerId,
            "Data" : data,
            "KeysToRemove" : keysToRemove
        });
    } catch(e) {
        result["error"] = evaluatePlayFabError(e);
        return { "value" : result };
    }

    result.success = true;
    return { "value" : result };
}

