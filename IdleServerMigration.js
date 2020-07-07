/*
 Start Migration Utility
 */

var sendMigrationLogglyError = function(contentObject) {
    var logglyTag = (PLAYFAB_ENVIRONMENT_CONFIG.configs[script.titleId] != undefined
            && PLAYFAB_ENVIRONMENT_CONFIG.configs[script.titleId] != null
        ) ? PLAYFAB_ENVIRONMENT_CONFIG.configs[script.titleId].logglyTag
        : null;

    if (logglyTag != null && logglyTag != undefined) {
        contentObject["logglyTag"] = logglyTag;

        http.request("http://logs-01.loggly.com/inputs/"
            + LOGGLY_TOKEN
            + "/tag/"
            + logglyTag
            + "/", "post",
            JSON.stringify(contentObject),
            "application/json"
        );
	}
}

handlers.migratePlayersRedisProfilesToDynamoDB = function(args) {
    var data = server.GetTitleInternalData({
        "Keys":[ "uwsDataMigrationIndexStart", "uwsDataMigrationLimit" ]
    });

    var start = parseInt(data.Data["uwsDataMigrationIndexStart"]);
    if (start < 0) {
        var result = {
            'allKeysMigrated' : true,
            'message' : 'uwsDataMigrationIndexStart has been flagged to indicate migration completed'
        }

        sendMigrationLogglyError(result);

        return result;
    }

    var limit = parseInt(data.Data["uwsDataMigrationLimit"]);

    server.SetTitleInternalData({
        "Key": "uwsDataMigrationIndexStart",
        "Value" : start + limit
    });

    var requestUrl = getUWSServer() + "Migration/MigrateRedisPlayersProfilesToDynamoDB";

    var requestParams = {
        'gameId' : script.titleId,
        'start' : start,
        'limit' : limit
    };

    var result = {
        'source' : 'MigratePlayersRedisProfilesToDynamoDB',
        'start' : start,
        'limit' : limit
    };

    var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
    try {
        result['response'] = JSON.parse(rawResponse);
    } catch(e) {
        result['response'] = rawResponse;
        result['message'] = 'Migration failed';

        sendMigrationLogglyError(result);

        return result;
    }

    if (result['response'].allKeysMigrated) {
        server.SetTitleInternalData({
            "Key": "uwsDataMigrationIndexStart",
            "Value" : -1
        });
    }

    return result;
}

/*
 End Migration Utility
 */
