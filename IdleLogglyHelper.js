
var GetLogglyTag = function () {
	var result = null;

	var playfabGameId = script.titleId;
	if (playfabGameId != null && playfabGameId != undefined) {
		if (SERVER_CONFIG.logglyTag.hasOwnProperty(playfabGameId)) {
			result = SERVER_CONFIG.logglyTag[playfabGameId];
		} else {
			log.debug("Unable to locate Loggly environment tag for " + playfabGameId);
		}
	}

	return result;
}

var SendLogglyError = function (source, content) {
	var logglyTag = this.GetLogglyTag();

	content["source"] = source;

	if (logglyTag != null && logglyTag != undefined) {
		content["logglyTag"] = logglyTag;
		http.request("http://logs-01.loggly.com/inputs/" + LOGGLY_TOKEN + "/tag/" + logglyTag + "/", "post", JSON.stringify(content), "application/json");
	}

	console.log(JSON.stringify(content));
}
