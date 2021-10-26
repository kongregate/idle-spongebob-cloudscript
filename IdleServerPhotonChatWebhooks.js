/*
 * Photon Chat Web Hooks, and player chat banning handlers
 * File: IdleServerPhotonChatWebhooks.js
 * bumping version
 */


// ****************************
// *** ChatBan Handlers ***
// ****************************

handlers.chatBanUser = function (args) {
	var updateResult = null;

	if (args != null && args != undefined
		&& args.duration != null && args.duration != undefined) {
			var data = {};
			var banTimeStamp = getServerTimeInternal() + args.duration;
			data[CHAT_BAN_TIMESTAMP_KEY] = banTimeStamp;

			updateResult = setCheaterData(
				currentPlayerId,
				data
			);

			var banData = { "chatBan": data[CHAT_BAN_TIMESTAMP_KEY] };

			updateBanLog(banData);
	}

	return updateResult;
}


handlers.chatUnbanUser = function (args) {
	var banData = { "chatBan": false };

	var updateResult = setCheaterData(
		currentPlayerId,
		undefined,
		[CHAT_BAN_TIMESTAMP_KEY]
	);

	updateBanLog(banData);

	return updateResult;
}

// ****************************
// *** End ChatBan Handlers ***
// ****************************



// ****************************
// *** Photon Chat Handlers ***
// ****************************

/*

Photon debug ResultCode levels
public enum DebugLevel : byte
{
	/// <summary>No debug out.</summary>
	OFF = 0,
	/// <summary>Only error descriptions.</summary>
	ERROR = 1,
	/// <summary>Warnings and errors.</summary>
	WARNING = 2,
	/// <summary>Information about internal workflows, warnings and errors.</summary>
	INFO = 3,
	/// <summary>Most complete workflow description (but lots of debug output), info, warnings and errors.</summary>
	ALL = 5
}

*/


const PHOTON_CHANNEL_STATE_KEY = 'ChannelState';
const PHOTON_CHANNEL_PUBLISH_SUBSCRIBERS_KEY = 'PublishSubscribers';

handlers.PhotonOnChannelCreate = function (args) {
	var result = null;

	server.WriteTitleEvent({ EventName: "PhotonOnChannelCreate" });

	result = {
		"ResultCode": 2,
		"DebugMessage": "Base Channel Initialization",
	}

	if (args != null && args != undefined
		&& args.ChannelName != undefined && args.ChannelName != null ) {
		result.DebugMessage += "; valid args found";

		var requestParams = {
			"gameId": script.titleId,
			"id": args.ChannelName
		};
		var requestUrl = getUWSServer() + "Chat/GetRecordedHistory";

		var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
		log.debug("UWS rawResponse:" + rawResponse + "; typeof:" + typeof rawResponse);

		var response = JSON.parse(rawResponse);
		log.debug("UWS response:" + response +"; typeof:" + typeof response);

		if (response != undefined && response != null
			&& response.history != undefined && response.history != null){
				if (response.history == -1){
					result.ResultCode = 0;
					result.DebugMessage += "; response is null or undefined, new channel being created";
				} else if (response.history.length > 0){
					var channelStateObject = {"BinaryHistory":String(response.history)};
					channelStateObject[PHOTON_CHANNEL_PUBLISH_SUBSCRIBERS_KEY] = true;
					var channelStatePayload = JSON.stringify(channelStateObject);
					if (channelStatePayload != undefined && channelStatePayload != null){
						result[PHOTON_CHANNEL_STATE_KEY] = channelStateObject;
						result.ResultCode = 0;
						result.DebugMessage += "; channel state payload successfully constructed!";
						log.debug("channelStatePayload:" + channelStatePayload);
					}
				} else {
					log.debug("ERROR, response.history found, but invalid");
					result.ResultCode = 1;
				result.DebugMessage += "; ERROR, response.history found, but invalid";
				}
		} else {
			log.debug("ERROR response is invalid");
			result.ResultCode = 1;
			result.DebugMessage += "; ERROR - response is invalid, rawResponse:" + JSON.stringify(rawResponse);
		}
	}

	return result;
};


handlers.PhotonOnChannelSubscribe = function (args) {
	var result = null;

	server.WriteTitleEvent({ EventName: "PhotonOnChannelSubscribe" });

	result = {
		"ResultCode": 0,
		"DebugMessage": "Base Channel Subscription",
	}

	if (args != null && args != undefined) {
		if (args["UserId"] != null && args["UserId"] != undefined) {
			// maybe store UserId for analyitics later
		}

		if (args["ChannelName"] != null && args["ChannelName"] != undefined) {
			// use channelName to guide channel state retrieval
		}
	}

	return result;
};


handlers.PhotonOnChannelUnsubscribe = function (args) {
	var result = null;

	server.WriteTitleEvent({ EventName: "PhotonOnChannelUnsubscribe" });

	result = {
		"ResultCode": 2,
		"DebugMessage": "Base Channel Unsubscription",
	}

	if (args != null && args != undefined) {
		if (args["UserId"] != null && args["UserId"] != undefined) {
			// maybe store UserId for analyitics later
		}

		if (args["ChannelName"] != null && args["ChannelName"] != undefined) {
			// use channelName to guide channel state retrieval
		}
	}

	return result;
};


handlers.RoomClosed = function (args) {
	var result = {
		"ResultCode": 2,
		"DebugMessage": "RoomClosed initialize"
	}
	server.WriteTitleEvent({ EventName: "RoomClosed" });

	if (args != null && args != undefined
		&& args.ChannelState != undefined && args.ChannelState != null
		&& args.ChannelState.BinaryHistory != undefined && args.ChannelState.BinaryHistory != null
		&& args.ChannelName != undefined && args.ChannelName != null
	) {
		result.DebugMessage += "; valid args found";

		var channelStatePayload = args.ChannelState.BinaryHistory;

		var requestParams = {
			"gameId": script.titleId,
			"id": args.ChannelName,
			"history": channelStatePayload
		};
		var requestUrl = getUWSServer() + "Chat/SetRecordedHistory";

		var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
		log.debug("UWS rawResponse:" + rawResponse);
		var response = JSON.parse(rawResponse);
		if (response != -1) {
			result.ResultCode = 0;
			result.DebugMessage += "; response.success!";
		} else {
			result.ResultCode = 1;
			result.DebugMessage += "; ERROR - response";
			log.debug("ERROR - UWS reseponse was unsuccessful:" + JSON.stringify(response));
		}
	}

	return result;
};

const USER_INTERNAL_DATA_CHAT_HISTORY_COUNT_LIMIT = 1000;
const USER_INTERNAL_DATA_CHAT_HISTORY_TIME_LIMIT_S = 15552000; // 6 months

handlers.PhotonOnPublishMessage = function (args) {
	var result = {
		"ResultCode": 2,
		"DebugMessage": "PhotonOnPublishMessage initialize"
	}

	server.WriteTitleEvent({ EventName: "PhotonOnPublishMessage" });

	if (args != null && args != undefined
		&& args.ChannelName != undefined && args.ChannelName != null
		&& args.UserId != undefined && args.UserId != null
		&& args.Message != undefined && args.Message != null
	) {
		// args are valid, now unpack messageObject
		var messageObject = JSON.parse(args.Message);
		if (messageObject != undefined && messageObject != null
			&& messageObject.playfabID != undefined && messageObject.playfabID != null
			&& messageObject.timeStamp != undefined && messageObject.timeStamp != null
			&& messageObject.msg != undefined && messageObject.msg != null) {
			// messageObject is valid, try and find user chat history object in their internal data.
			var playerInternalData = server.GetUserInternalData({
				"PlayFabId": messageObject.playfabID,
				"Keys": ["chatHistory"]
			});

			if (playerInternalData != undefined && playerInternalData != null) {
				var chatHistory = null;
				if (playerInternalData.Data != undefined && playerInternalData.Data != null
					&& playerInternalData.Data["chatHistory"] != undefined && playerInternalData.Data["chatHistory"] != null
					&& playerInternalData.Data["chatHistory"].Value != undefined && playerInternalData.Data["chatHistory"].Value != null) {
					chatHistory = JSON.parse(playerInternalData.Data["chatHistory"].Value);
				}

				if (chatHistory == undefined || chatHistory == null){
					chatHistory = [];
				}

				// limit number of total messages to store
				if (chatHistory.length > USER_INTERNAL_DATA_CHAT_HISTORY_COUNT_LIMIT){
					chatHistory.shift();
				}

				// remove messages over a certain duration old (6 months)
				for (var i = 0; i < chatHistory.length; i++){
					var chatObject = chatHistory[i];
					var serverTime = getServerTimeInternal().serverTime;
					result.DebugMessage += ";serverTime - " + serverTime;
					result.DebugMessage += ";chatObject - " + chatObject;
					if (chatObject != undefined && chatObject != null) {
						var timeSinceMessage = serverTime - chatObject.timeStamp;
						result.DebugMessage += ";timeSinceMessage - " + timeSinceMessage;
						if (timeSinceMessage > USER_INTERNAL_DATA_CHAT_HISTORY_TIME_LIMIT_S) {
							chatHistory.shift();
							i = 0;
						} else {
							break;
						}
					}
				}

				chatHistory.push(messageObject);

				var chatHistoryPayload = JSON.stringify(chatHistory);

				if (chatHistoryPayload != undefined && chatHistoryPayload != null){
					var updateUserDataResult = server.UpdateUserInternalData({
						"PlayFabId": messageObject.playfabID,
						"Data": { "chatHistory": JSON.stringify(chatHistory) }
					});

					if (updateUserDataResult != undefined && updateUserDataResult != null
						&& updateUserDataResult.error == undefined && updateUserDataResult.error == null) {
						// alh set debug return to warning during development
						// result.ResultCode = 1;
						result.ResultCode = 0;
						result.DebugMessage += "; chatHistory updated successfully";
					} else {
						result.ResultCode = 2;
						result.DebugMessage += "; error UpdateUserInternalData is null";
						if (updateUserDataResult != undefined && updateUserDataResult != null) {
							result.DebugMessage += "; error UpdateUserInternalData error: " + updateUserDataResult.error;
						}
					}
				} else {
						result.ResultCode = 2;
						result.DebugMessage += ";error chatHistoryPayload is invalid:";
				}

			} else {
				result.ResultCode = 2;
				result.DebugMessage += "; Error - player internal data could not be found";
			}
		} else {
			result.ResultCode = 2;
			result.DebugMessage += ";Error - messageObject could not be found or parsed";
		}
	} else {
		result.ResultCode = 2;
		result.DebugMessage += ";Error - webhook args are invalid";
	}

	return result;
};

// ********************************
// *** End Photon Chat Handlers ***
// ********************************

/*
 * END Photon Chat Web Hooks, and player chat banning handlers
 * File: IdleServerPhotonChatWebhooks.js
 */