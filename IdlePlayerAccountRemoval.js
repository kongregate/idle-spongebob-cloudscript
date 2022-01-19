
// NOTE : server.DeletePlayer needs to be enabled in game web portal

handlers.deleteMyAccount = function(args) {
    var result = {};

    result['delete'] = deletePlayerAccountInternal(currentPlayerId);

    result["success"] = true;

    return {
        "value": result
    }
}

handlers.deletePlayerAccount = function(args) {
    var result = {};

    result['delete'] = deletePlayerAccountInternal(args.playerId);

    result["success"] = true;

    return {
        "value": result
    }
}

var deletePlayerAccountInternal = function(playerId) {
    return server.DeletePlayer({
        "PlayFabId":playerId
    });
}
