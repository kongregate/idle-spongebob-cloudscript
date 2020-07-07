
/*
 Start Guilds
 */

const GUILD_CONFIG_KEY = "guildServerConfig";
const GUILD_NAME_VALIDATION_KEY = "nameValidation";

var getPlayerEntityKeyInternal = function(playerId) {
	return server.GetUserAccountInfo({"PlayFabId":playerId}).UserInfo.TitleInfo.TitlePlayerAccount;
}

var sendJoinGuildRequest = function(playerId, guildName, guildId, guildType, functionName) {
	var requestParams = {
		'gameId' : script.titleId,
		'guildName' : guildName,
		'playerId' : playerId,
		'guildId' : guildId,
		'guildType' : guildType
	};
	var requestUrl = getUWSServer() + "Guild/" + functionName;
	return http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
}

var sendLeaveGuildRequest = function(playerId, functionName, extraParams) {
	var requestParams = {
		'gameId' : script.titleId,
		'playerId' : playerId
	};

	if (extraParams != undefined && extraParams != null) {
		for(field in extraParams) {
			requestParams[field] = extraParams[field];
		}
	}

	var requestUrl = getUWSServer() + "Guild/" + functionName;
	var uwsResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

	return JSON.parse(uwsResponse);
}

var sendDeleteEmptyGuildRequest = function(guildName, guildId, guildType) {
	var requestParams = {
		'gameId' : script.titleId,
		'guildName' : guildName,
		'guildId' : guildId,
		'guildType' : guildType
	};

	var requestUrl = getUWSServer() + "Guild/DeleteEmptyGuild";
	var uwsResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
	var uwsResponseObject = null;

	try {
		uwsResponseObject = JSON.parse(uwsResponse);
	} catch(e) {
		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e
	}

	return (uwsResponseObject != undefined
		&& uwsResponseObject != null
		&& uwsResponseObject.success === true
	);
}

var getGuildProfileInternal = function(guildId, guildType, getGroup, getMembers, getApplications, getInvites) {
	if (getGroup == undefined || getGroup == null) {
		getGroup = true;
	}

	if (getMembers == undefined || getMembers == null) {
		getMembers = true;
	}

	if (getApplications == undefined || getApplications == null) {
		getApplications = true;
	}

	if (getInvites == undefined || getInvites == null) {
		getInvites = true;
	}

	var result = null;

	if (guildId == null
		|| guildId == undefined
		|| guildType == null
		|| guildType == undefined
	) {
		return result;
	}

	result = {};

	var params = {
		'Group' : {
			'Id' : guildId,
			'Type' : guildType
		}
	};

	if (getGroup) {
		result["group"] = entity.GetGroup(params);
	}

	if (getMembers) {
		result['members'] = entity.ListGroupMembers(params).Members;
	}

	if (getApplications) {
		result['applications'] = entity.ListGroupApplications(params).Applications;
	}

	if (getInvites) {
		result['invites'] = entity.ListGroupInvitations(params).Invitations;
	}

	return result;
}

var getPlayerCurrentUwsGuildInternal = function(playerId) {
	var requestParams = {
		"gameId": script.titleId,
		"playerId": playerId
	};

	var requestUrl = getUWSServer() + "Profile/GetPlayerDBProfile";
	var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

	var response = null;

	try {
		response = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e
	}

	if (!response.success) {
		return null;
	}

	if (response.profile.guildData != undefined
		&& response.profile.guildData != null
		&& response.profile.guildData.id
		&& response.profile.guildData.id.trim()
		&& response.profile.guildData.type
		&& response.profile.guildData.type.trim()
		&& response.profile.guildData.name
		&& response.profile.guildData.name.trim()
	) {
		return {
			'guildId' : response.profile.guildData.id,
			'guildType' : response.profile.guildData.type,
			'guildName' : response.profile.guildData.name
		}
	}
}

var getMembersInGuild = function(guildId, guildType) {
	if (guildId == null
		|| guildId == undefined
		|| guildType == null
		|| guildType == undefined
	) {
		return null;
	}

	var rolesAndMembers = entity.ListGroupMembers({
		"Group" : {
			"Id" : guildId,
			"Type" : guildType
		}
	}).Members;

	var membersCount = {};
	for(var idx = 0; idx < rolesAndMembers.length; idx++) {
		membersCount[roleMembers[idx].RoleId] = rolesAndMembers[idx].Members.length;
	}

	return membersCount;
}

var isGuildAdminInternal = function(playerId, guildId, guildType) {
	if (playerId == null
		|| playerId == undefined
		|| guildId == null
		|| guildId == undefined
		|| guildType == null
		|| guildType == undefined
	) {
		return false;
	}

	var roleMembers = entity.ListGroupMembers({
		"Group" : {
			"Id" : guildId,
			"Type" : guildType
		}
	}).Members;

	for(var idx = 0; idx < roleMembers.length; idx++) {
		if (roleMembers[idx].RoleId !== 'admins') {
			continue;
		}

		var memebrs = roleMembers[idx].Members;
		for(var subIdx = 0; subIdx < memebrs.length; subIdx++) {
			var member = memebrs[subIdx];
			if (member.Lineage.master_player_account.Id === playerId) {
				return true;
			}
		}

		break;
	}

	return false;
}

handlers.removeFromGuild = function(args) {
	var result = {
		'value' : {
			'success' : false,
			'pf' : {
				'isAdmin' : false
			},
			'uws' : null
		}
	};

	if (args == undefined
		|| args == null
		|| !args.playerId
		|| !args.guildName
		|| !args.guildId
		|| !args.guildType
	) {
		return result;
	}

	if (currentPlayerId == args.playerId) {
		return result;
	}

	result.value.pf.isAdmin = isGuildAdminInternal(currentPlayerId, args.guildId, args.guildType);
	if (!result.value.pf.isAdmin) {
		return result;
	}

	result.value.uws = sendLeaveGuildRequest(args.playerId,
		'RemoveFromGuild',
		{
			'guildName' : args.guildName,
			'guildId' : args.guildId,
			'guildType' : args.guildType
		}
	);

	if (!result.value.uws || !result.value.uws.success) {
		return result;
	}

	try {
		entity.RemoveMembers({
			'Group' : {
				'Id' : args.guildId,
				'Type' : args.guildType
			},
			'Members' : [
				getPlayerEntityKeyInternal(args.playerId)
			]
		});
	} catch(e) {

	}

	result.value.success = true;
	return result;
}

handlers.leaveGuild = function(args) {
	var result = {
		'value' : {
			'success' : false,
			'pf' : {
				'isAdmin' : false,
				'members' : 0,
				'guildDeleted' : false
			},
			'uws' : null
		}
	};

	var uwsGuildData = getPlayerCurrentUwsGuildInternal(currentPlayerId);

	if (uwsGuildData == undefined
		|| uwsGuildData == null
		|| uwsGuildData.guildName == undefined
		|| uwsGuildData.guildName == null
		|| uwsGuildData.guildId == undefined
		|| uwsGuildData.guildId == null
		|| uwsGuildData.guildType == undefined
		|| uwsGuildData.guildType == null
	) {
		result.value.success = true;
		return result;
	}

	try {
		var membersInGuildByRole = entity.ListGroupMembers({
			"Group" : {
				"Id" : uwsGuildData.guildId,
				"Type" : uwsGuildData.guildType
			}
		}).Members;

		var playerRole = undefined;
		result.value.pf.members = {};

		for(var idx = 0; idx < membersInGuildByRole.length; idx++) {
			var roleData = membersInGuildByRole[idx];
			result.value.pf.members[roleData.RoleId] = roleData.Members.length;

			if (playerRole != undefined) {
				continue;
			}


			for(var subIdx = 0; subIdx < roleData.Members.length; subIdx++) {
				var member = roleData.Members[subIdx];

				if (member.Lineage.master_player_account.Id === currentPlayerId) {
					playerRole = roleData.RoleId;
					break;
				}
			}
		}

		result.value.pf.isAdmin = (playerRole == 'admins');

		if (result.value.pf.isAdmin
			&& result.value.pf.members['admins'] == 1
			&& result.value.pf.members['members'] > 0
		) {
			return result;
		}

		result.value.uws = {
			'player' : sendLeaveGuildRequest(currentPlayerId, 'LeaveGuild')
		};

		if (!result.value.uws.player
			|| !result.value.uws.player.success
		) {
			return result;
		}

		var playerEntity = getPlayerEntityKeyInternal(currentPlayerId);

		entity.RemoveMembers({
			'Group' : {
				'Id' : uwsGuildData.guildId,
				'Type' : uwsGuildData.guildType
			},
			'Members' : [
				playerEntity
			]
		});

		result.value.pf.members[playerRole]--;
		result.value.success = true;
	} catch(e) {
		if (e.apiErrorInfo == null
			|| e.apiErrorInfo == undefined
			|| e.apiErrorInfo.apiError == undefined
			|| e.apiErrorInfo.apiError == null
			|| e.apiErrorInfo.apiError.error != 'ProfileDoesNotExist'
		) {
			throw e;
		}
	}

	var membersInGuild = 0;
	for(var role in result.value.pf.members) {
		membersInGuild += result.value.pf.members[role];
	}

	if (membersInGuild > 0) {
		return result;
	}

	result.value.uws['guildDeleted'] =
		sendDeleteEmptyGuildRequest(uwsGuildData.guildName, uwsGuildData.guildId, uwsGuildData.guildType);

	try {
		// this can only fail if group does not exists
		// or if player is not a member
		entity.DeleteGroup({
			'Group' : {
				'Id' : uwsGuildData.guildId,
				'Type' : uwsGuildData.guildType
			}
		});

		result.value.pf.guildDeleted = true;
	} catch(e) {

	}

	return result;
}

var sanitizeGuildProfile = function(publicProfile, privateProfile) {
	var data = server.GetTitleData({ "Keys":[ GUILD_CONFIG_KEY ] });
	var guildConfig = JSON.parse(data.Data[GUILD_CONFIG_KEY]);

	if (privateProfile.internalMessage
		&& privateProfile.internalMessage.length > guildConfig.internalMessageCap
	) {
		privateProfile.internalMessage =
			privateProfile.internalMessage.substring(0, guildConfig.internalMessageCap);
	}

	if (publicProfile.introMessage
		&& publicProfile.introMessage.length > guildConfig.introMessageCap
	) {
		publicProfile.introMessage =
			publicProfile.introMessage.substring(0, guildConfig.introMessageCap);
	}
}

// ceate guild flow
// 1. Player cannot be in a guild in order to create one
handlers.createGuild = function(args) {
	var result = {
		'validName' : false,
		"pf" : null,
		"uws" : null
	};

	if (args.name == null || args.name == undefined ) {
		return { 'value' : result };
	}

	var data = server.GetTitleData({ "Keys":[ GUILD_CONFIG_KEY ] });
	var guildConfig = JSON.parse(data.Data[GUILD_CONFIG_KEY]);
	var guildValidation = guildConfig[GUILD_NAME_VALIDATION_KEY];

	var trimGuildName = args.name.trim();
	if (!trimGuildName || trimGuildName.length > guildValidation.maxChar) {
		return { 'value' : result };
	}

	if (guildValidation.blackList != null && guildValidation.blackList != undefined) {
		for(var idx = 0; idx < guildValidation.blackList.length; idx++) {
			if (args.name.search(guildValidation.blackList[idx]) >= 0) {
				return { 'value' : result };
			}
		}
	};

	result.validName = true;

	result.pf = {};

	result.pf['group'] = entity.CreateGroup({
		'Entity': getPlayerEntityKeyInternal(currentPlayerId),
		'GroupName': trimGuildName
	});

	var requestParams = {
		"gameId" : script.titleId,
		"playerId" : currentPlayerId,
		"guildId" : result.pf['group'].Group.Id,
		"guildType" : result.pf['group'].Group.Type,
		"guildName" : result.pf['group'].GroupName,
		"profile" : {}
	};

	requestParams.profile["public"] = (args.publicProfile)
		? args.publicProfile
		: {};

	requestParams.profile["private"] = (args.privateProfile)
		? args.privateProfile
		: {};

	sanitizeGuildProfile(requestParams.profile.public, requestParams.profile.private);

	var requestUrl = getUWSServer() + "Guild/CreateGuild";
	var uwsResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

	try {
		result.uws = JSON.parse(uwsResponse);
	} catch(e) {
		entity.DeleteGroup({
			'Group' : result.pf['group'].Group
		});

		log.error(uwsResponse);
		throw e
	}

	// Either guild has key already exists or
	// player is already in a guild
	if (!result.uws || !result.uws.success) {
		entity.DeleteGroup({
			'Group' : result.pf['group'].Group
		});

		result.pf = null;
		return {'value' : result };
	}

	return { 'value' : result };
}

var getPlayerGuildInternal = function(playerId, profileTypes) {
	if (playerId == null || playerId == undefined) {
		return null;
	}

	var requestParams = {
		"gameId": script.titleId,
		"playerId": playerId
	};

	if (profileTypes != undefined && profileTypes != null) {
		requestParams['types'] = profileTypes;
	}

	var requestUrl = getUWSServer() + "Guild/GetPlayerGuildProfile";
	var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

	try {
		return JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e
	}
}

handlers.getPlayerPublicGuild = function(args) {
	var result = {
		'uws' : null,
		'pf' : null
	};

	result.uws = getPlayerGuildInternal(args.playerId, ['public', 'members']);

	if (result.uws
		&& result.uws.success
		&& result.uws.profile
		&& result.uws.profile.public
		&& result.uws.profile.public.id
		&& result.uws.profile.public.type
	) {
		result.pf = getGuildProfileInternal(
			result.uws.profile.public.id,
			result.uws.profile.public.type,
			true,
			true,
			false,
			false
		);
	}

	return { 'value' : result };
}

handlers.getCurrentPlayerGuild = function(args) {
	var result = {
		'pf' : null,
		'uws' : null
	};

	result.uws = getPlayerGuildInternal(currentPlayerId);

	result.success = true;

	if (!result.uws
		|| !result.uws.success
		|| !result.uws.profile
		|| result.uws.profile == -1
		|| !result.uws.profile.public
	) {
		return { 'value' : result };
	}

	result.pf = getGuildProfileInternal(result.uws.profile.public.id, result.uws.profile.public.type);

	return { 'value' : result };
}

var removePlayerGuildInvitation = function(playerId, guildId, guildType) {
	var playerEntity = getPlayerEntityKeyInternal(playerId);

	var invitations = getPlayerMembershipOpportunities(playerId).Invitations;
	for(var idx = 0; idx < invitations.length; idx++) {
		var invitation = invitations[idx];

		if (invitation.Group.Id == guildId
			&& invitation.InvitedEntity.Id == playerEntity.Id
		) {
			try {
				entity.RemoveGroupInvitation({
					'Entity' : playerEntity,
					'Group' : {
						'Id' : guildId,
						'Type' : guildType
					},
				});
			} catch(e) {
				// invitation can not exist due to race conditions
			}

			sendUwsRemoveGuildJoinInquiry(playerId,
				guildId,
				guildType,
				"Invites"
			);

			break;
		}
	}
}

var removePlayerGuildApplication = function(playerId, guildId, guildType) {
	var playerEntity = getPlayerEntityKeyInternal(playerId);

	var applications = getPlayerMembershipOpportunities(playerId).Applications;
	for(var idx = 0; idx < applications.length; idx++) {
		var application = applications[idx];

		if (application.Group.Id == guildId
			&& application.Entity.Id == playerEntity.Id
		) {
			try {
				entity.RemoveGroupApplication({
					'Entity' : playerEntity,
					'Group' : {
						'Id' : guildId,
						'Type' : guildType
					},
				});
			} catch(e) {
				// application can not exist due to race conditions
			}

			sendUwsRemoveGuildJoinInquiry(playerId,
				guildId,
				guildType,
				"Applications"
			);

			break;
		}
	}
}

// current player accept invitation flow
handlers.acceptGuildInvite = function(args) {
	var result = {
		"value" : {
			"success" : false,
			"uws" : null
		}
	};

	if (args.guildName == undefined
		|| args.guildName == null
		|| args.guildId == undefined
		|| args.guildId == null
		|| args.guildType == undefined
		|| args.guildType == null
	) {
		return result;
	}

	var invitedPlayerEntityKey = getPlayerEntityKeyInternal(currentPlayerId);

	entity.AcceptGroupInvitation({
		"Entity" : invitedPlayerEntityKey,
		"Group" : {
			"Id" : args.guildId,
			"Type" : args.guildType
		}
	});

	try {
		var uwsResponse = sendJoinGuildRequest(
			currentPlayerId,
			args.guildName,
			args.guildId,
			args.guildType,
			"JoinGuild"
		);

		result.value['uws'] = JSON.parse(uwsResponse);
	} catch(e) {
		try {
			entity.RemoveMembers({
				'Group' : {
					'Id' : args.guildId,
					'Type' : args.guildType
				},
				'Members' : [
					invitedPlayerEntityKey
				]
			});
		} catch(ex) {

		}

		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e
	}

	if (!result.value['uws'] || !result.value['uws'].success) {
		try {
			entity.RemoveMembers({
				'Group' : {
					'Id' : args.guildId,
					'Type' : args.guildType
				},
				'Members' : [
					invitedPlayerEntityKey
				]
			});
		} catch(e) {

		}

		return result;
	}

	removePlayerGuildApplication(currentPlayerId, args.guildId, args.guildType);

	result.value.success = true;

	return result;
}

// guild accpetance of application flow
handlers.acceptGuildApplication = function(args) {
	var result = { "value" : {
		"success" : false,
		"pf" : null,
		"uws" : null
	} };

	if (args.playerId == null
		|| args.playerId == undefined
		|| args.guildName == undefined
		|| args.guildName == null
		|| args.guildId == undefined
		|| args.guildId == null
		|| args.guildType == undefined
		|| args.guildType == null
	) {
		return result;
	}

	result.value.pf = {
		"isAdmin" : false,	// flag indicating whether player is guild admin
	};

	result.value.pf.isAdmin = isGuildAdminInternal(currentPlayerId, args.guildId, args.guildType);
	if (!result.value.pf.isAdmin) {
		return result;
	}

	var applyingPlayerEntity = getPlayerEntityKeyInternal(args.playerId);

	entity.AcceptGroupApplication({
		"Entity" : applyingPlayerEntity,
		"Group" : {
			"Id" : args.guildId,
			"Type" : args.guildType
		}
	});

	try {
		var uwsResponse = sendJoinGuildRequest(
			args.playerId,
			args.guildName,
			args.guildId,
			args.guildType,
			"JoinGuild"
		);
		result.value['uws'] =  JSON.parse(uwsResponse);
	} catch(e) {
		entity.RemoveMembers({
			'Group' : {
				'Id' : args.guildId,
				'Type' : args.guildType
			},
			'Members' : [
				applyingPlayerEntity
			]
		});

		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e;
	}

	if (!result.value['uws'] || !result.value['uws'].success) {
		try {
			entity.RemoveMembers({
				"Group" : {
					"Id" : args.guildId,
					"Type" : args.guildType
				},
				'Members' : [
					applyingPlayerEntity
				]
			});
		} catch(e) {

		}

		return result;
	}

	removePlayerGuildInvitation(args.playerId, args.guildId, args.guildType);

	result.value.success = true;

	return result;
}

// guild accpetance of application flow
handlers.joinGuildWithoutApplication = function(args) {
	var result = {
		"value" : {
			"success" : false,
			"uws" : null
		}
	};

	if (args.guildName == undefined
		|| args.guildName == null
		|| args.guildId == undefined
		|| args.guildId == null
		|| args.guildType == undefined
		|| args.guildType == null
	) {
		return result;
	}

	var playerEntityKey = getPlayerEntityKeyInternal(currentPlayerId);

	entity.AddMembers({
		'Group' : {
			'Id' : args.guildId,
			'Type' : args.guildType
		},
		'Members' : [
			playerEntityKey
		]
	});

	try {
		var uwsResponse = sendJoinGuildRequest(
			currentPlayerId,
			args.guildName,
			args.guildId,
			args.guildType,
			'JoinPublicGuildWithoutApplication'
		);

		result.value['uws'] = JSON.parse(uwsResponse);
	} catch(e) {
		try {
			entity.RemoveMembers({
				'Group' : {
					'Id' : args.guildId,
					'Type' : args.guildType
				},
				'Members' : [
					playerEntityKey
				]
			});
		} catch(ex) {

		}

		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e
	}

	if (!result.value['uws'] || !result.value['uws'].success) {
		try {
			entity.RemoveMembers({
				'Group' : {
					'Id' : args.guildId,
					'Type' : args.guildType
				},
				'Members' : [
					playerEntityKey
				]
			});
		} catch(e) {

		}

		return result;
	}

	removePlayerGuildInvitation(currentPlayerId, args.guildId, args.guildType);
	removePlayerGuildApplication(currentPlayerId, args.guildId, args.guildType);

	result.value.success = true;

	return result;
}

handlers.updateGuildProfile = function(args) {
	var result = {
		'value' : {
			'isAdmin' : false,
			'uws' : null
		}
	};

	if (args == undefined
		|| args == null
		|| args.guildName == undefined
		|| args.guildName == null
		|| args.guildId == undefined
		|| args.guildId == null
		|| args.guildType == undefined
		|| args.guildType == null
		|| ((args.public == undefined || args.public == null)
			&& (args.private == undefined || args.private == null)
		)
	) {
		return result;
	}

	try {
		result.value.isAdmin = isGuildAdminInternal(currentPlayerId, args.guildId, args.guildType);
		if(!result.value.isAdmin) {
			return result;
		}

		var requestParams = {
			'gameId' : script.titleId,
			'guildName' : args.guildName,
			'playerId' : currentPlayerId,
			'guildId' : args.guildId,
			'guildType' : args.guildType,
			'profile' : { }
		};


		requestParams.profile['public'] = (args.public)
			? args.public
			: {};

		requestParams.profile['private'] = (args.private)
			? args.private
			: {};

		sanitizeGuildProfile(requestParams.profile['public'], requestParams.profile['private']);

		var requestUrl = getUWSServer() + "Guild/UpdateGuildProfile";
		var rawResponse =  http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

		result.value.uws = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;

		throw e;
	}

	return result;
}

handlers.swapGuildMemberRoles = function(args) {
	var result = { 'value' : {
		'success' : false,
		'isAdmin' : false,
		'swap' : []
	} };

	if (!args.playerId
		|| !args.playerRoleId
		|| !args.currentRoleId
		|| !args.guildId
		|| !args.guildType
	) {
		return result;
	}

	result.value['isAdmin'] = isGuildAdminInternal(currentPlayerId,
		args.guildId,
		args.guildType
	);
	if (!result.value.isAdmin) {
		return result;
	}

	entity.ChangeMemberRole({
		'DestinationRoleId' : args.currentRoleId,
		'Group' : {
			'Id' : args.guildId,
			'Type' : args.guildType
		},
		'Members' : [ getPlayerEntityKeyInternal(args.playerId) ],
		'OriginRoleId' : args.playerRoleId
	});

	result.value.swap.push({
		"playerId" : args.playerId,
		"oldRoleId" : args.playerRoleId,
		"newRoleId" : args.currentRoleId
	});

	entity.ChangeMemberRole({
		'DestinationRoleId' : args.playerRoleId,
		'Group' : {
			'Id' : args.guildId,
			'Type' : args.guildType
		},
		'Members' : [ getPlayerEntityKeyInternal(currentPlayerId) ],
		'OriginRoleId' : args.currentRoleId
	});

	result.value.swap.push({
		"playerId" : currentPlayerId,
		"oldRoleId" : args.currentRoleId,
		"newRoleId" : args.playerRoleId
	});

	result.value.success = true;

	return result;
}

handlers.searchGuildsToJoin = function(args) {
	var result = { 'value' : { 'uws' : null } };

	try {
		var requestParams = {
			'gameId' : script.titleId,
			'limit' : (args.limit) ? args.limit : 0
		};

		if (args.lastEvaluatedGuildId
			&& args.lastEvaluatedGuildType
		) {
			requestParams['lastEvaluatedGuild'] = {
				'name' : args.lastEvaluatedGuildName,
				'id' : args.lastEvaluatedGuildId,
				'type' : args.lastEvaluatedGuildType
			};
		}

		var requestUrl = getUWSServer() + "Guild/QueryPublicGuildProfiles";
		var rawResponse =  http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

		result.value.uws = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e;
	}

	return result;
}

handlers.searchGuildByName = function(args) {
	var result = { 'value' : { 'uws' : null } };

	if (args.name == undefined || args.name == null) {
		return result;
	}

	try {
		var requestParams = {
			'gameId' : script.titleId,
			'name' : args.name,
			'limit' : (args.limit) ? args.limit : 0
		};

		if (args.lastEvaluatedGuildId
			&& args.lastEvaluatedGuildType
		) {
			requestParams['lastEvaluatedGuild'] = {
				'name' : args.lastEvaluatedGuildName,
				'id' : args.lastEvaluatedGuildId,
				'type' : args.lastEvaluatedGuildType
			};
		}

		var requestUrl = getUWSServer() + "Guild/QueryGuildPublicProfilesByName";
		var rawResponse =  http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

		result.value.uws = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e;
	}

	return result;
}

handlers.getGuildsProfiles = function(args) {

	var result = {
		'value' : {
			'success' : false,
			'uws' : null
		}
	}

	if (args.guildModels == undefined
		|| args.guildModels == null
	) {
		return result;
	}

	try {
		var requestParams = {
			'gameId' : script.titleId,
			'guildModels' : args.guildModels
		};

		var requestUrl = getUWSServer() + "Guild/GetGuildsProfiles";
		var rawResponse =  http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

		result.value.success = true;
		result.value.uws = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e;
	}

	return result
}

handlers.adminDisbandGuild = function(args) {
	var result = {
		'value' : {
			'success' : false,
			'uws' : null,
			'pf' : {
				'guildDeleted' : false
			}
		}
	}

	if (args.guildId == undefined
		|| args.guildId == null
		|| args.guildType == undefined
		|| args.guildType == null
	) {
		return result;
	}

	try {
		var requestParams = {
			'gameId' : script.titleId,
			'guildId' : args.guildId,
			'guildType' : args.guildType
		};

		var requestUrl = getUWSServer() + "AdminGuild/DisbandGuild";
		var rawResponse =  http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

		result.value.success = true;
		result.value.uws = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e;
	}

	entity.DeleteGroup({
		'Group' : {
			'Id' : uwsGuildData.guildId,
			'Type' : uwsGuildData.guildType
		}
	});

	result.value.pf.guildDeleted = true;

	return result
}

var sendUwsGuildJoinInquiry = function(functionName, playerId, guildId, guildType, guildName, expiration) {
	var requestUrl = getUWSServer() + "Guild/" + functionName;
	var requestParams = {
		"gameId" : script.titleId,
		"playerId" : playerId,
		"guildId" : guildId,
		"guildName" : guildName,
		"guildType" : guildType,
		"epochExpirationTime" : expiration
	}
	return http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
}

var sendUwsRemoveGuildJoinInquiry = function(playerId, guildId, guildType, inquiryType) {
	var requestUrl = getUWSServer() + "Guild/DeletePlayerGuildInviteOrApplication";
	var requestParams = {
		"gameId" : script.titleId,
		"playerId" : playerId,
		"guildId" : guildId,
		"guildType" : guildType,
		"inquiryTypes" : [ inquiryType ]
	}
	return http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
}

handlers.sendGuildInvite = function(args) {
	var result = {
		'value' : {
			'success' : false,
			'uws' : null,
			'pf' : {
				'isAdmin' : false,
				'invite' : null
			}
		}
	}

	if (!args.guildId
		|| !args.guildType
		|| !args.guildName
		|| !args.playerId
		|| !args.roleId
	) {
		return result;
	}

	result.value.pf.isAdmin = isGuildAdminInternal(currentPlayerId, args.guildId, args.guildType);
	if (!result.value.pf.isAdmin) {
		return result;
	}

	result.value.pf.invite = entity.InviteToGroup({
		'Entity' : getPlayerEntityKeyInternal(args.playerId),
		'Group' : {
			'Id' : args.guildId,
			'Type' : args.guildType
		},
		'RoleId' : args.roleId,
		'AutoAcceptOutstandingApplication' : false
	});

	var uwsResponse = undefined;

	try {
		uwsResponse = sendUwsGuildJoinInquiry("RecordGuildInvitationRequest",
			args.playerId,
			args.guildId,
			args.guildType,
			args.guildName,
			Date.parse(result.value.pf.invite.Expires)
		);
		result.value.uws = JSON.parse(uwsResponse);
	} catch(e) {
		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e
	}

	result.value.success = true;
	return result;
}

handlers.cancelGuildInvite = function(args) {
	var result = {
		'value' : {
			'success' : false,
			'uws' : null,
			'pf' : {
				'isAdmin' : false,
				'isInvitedPlayer' : false
			}
		}
	}

	if (!args.guildId
		|| !args.guildType
		|| !args.playerId
	) {
		return result;
	}

	result.value.pf.isInvitedPlayer = (currentPlayerId == args.playerId);

	if (!result.value.pf.isInvitedPlayer) {
		result.value.pf.isAdmin = isGuildAdminInternal(currentPlayerId, args.guildId, args.guildType);
	}

	if (!result.value.pf.isAdmin && !result.value.pf.isInvitedPlayer) {
		return result;
	}

	entity.RemoveGroupInvitation({
		'Entity' : getPlayerEntityKeyInternal(args.playerId),
		'Group' : {
			'Id' : args.guildId,
			'Type' : args.guildType
		},
	});

	var uwsResponse = undefined;

	try {
		uwsResponse = sendUwsRemoveGuildJoinInquiry(args.playerId,
			args.guildId,
			args.guildType,
			"Invites"
		);
		result.value.uws = JSON.parse(uwsResponse);
	} catch(e) {
		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e
	}

	result.value.success = true;
	return result;
}

handlers.sendGuildApplication = function(args) {
	var result = {
		'value' : {
			'success' : false,
			'uws' : null,
			'pf' : {
				'application' : null
			}
		}
	}

	if (!args.guildId
		|| !args.guildType
		|| !args.guildName
	) {
		return result;
	}

	result.value.pf.application = entity.ApplyToGroup({
		'Entity' : getPlayerEntityKeyInternal(currentPlayerId),
		'Group' : {
			'Id' : args.guildId,
			'Type' : args.guildType
		},
		'AutoAcceptOutstandingInvite' : false
	});

	var uwsResponse = undefined;

	try {
		uwsResponse = sendUwsGuildJoinInquiry("RecordGuildApplicationRequest",
			currentPlayerId,
			args.guildId,
			args.guildType,
			args.guildName,
			Date.parse(result.value.pf.application.Expires)
		);
		result.value.uws = JSON.parse(uwsResponse);
	} catch(e) {
		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e
	}

	result.value.success = true;
	return result;
}

handlers.cancelGuildApplication = function(args) {
	var result = {
		'value' : {
			'success' : false,
			'uws' : null,
			'pf' : {
				'isAdmin' : false,
				'isApplyingPlayer' : false
			}
		}
	}

	if (!args.guildId
		|| !args.guildType
		|| !args.playerId
	) {
		return result;
	}

	result.value.pf.isApplyingPlayer = (currentPlayerId == args.playerId);

	if (!result.value.pf.isApplyingPlayer) {
		result.value.pf.isAdmin = isGuildAdminInternal(currentPlayerId, args.guildId, args.guildType);
	}

	if (!result.value.pf.isAdmin && !result.value.pf.isApplyingPlayer) {
		return result;
	}

	entity.RemoveGroupApplication({
		'Entity' : getPlayerEntityKeyInternal(args.playerId),
		'Group' : {
			'Id' : args.guildId,
			'Type' : args.guildType
		},
	});

	var uwsResponse = undefined;

	try {
		uwsResponse = sendUwsRemoveGuildJoinInquiry(args.playerId,
			args.guildId,
			args.guildType,
			"Applications"
		);
		result.value.uws = JSON.parse(uwsResponse);
	} catch(e) {
		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e
	}

	result.value.success = true;
	return result;
}

var getPlayerMembershipOpportunities = function(playerId) {
	return entity.ListMembershipOpportunities({
		'Entity' : getPlayerEntityKeyInternal(playerId)
	});
}

handlers.getPlayerJoinGuildInquiries = function(args) {

	var result = {
		'value' : {
			'success' : false,
			'pf' : null,
			'uws' : null
		}
	}

	result.value.pf = getPlayerMembershipOpportunities(currentPlayerId);

	var requestUrl = getUWSServer() + "Guild/GetAllPlayerGuildJoinInquiry";
	var requestParams = {
		"gameId" : script.titleId,
		"playerId" : currentPlayerId
	}
	var uwsResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");
	try {
		result.value.uws = JSON.parse(uwsResponse);
	} catch(e) {
		log.error(uwsResponse);
		e.message += ' : ' + uwsResponse;
		throw e
	}

	result.value.success = true;
	return result;
}

handlers.getGuildPublicProfile = function(args) {
	var result =  {
		'value' : {
			'success' : false,
			'uws' : null,
			'pf' : null
		}
	}

	if (!args.guildName
		|| !args.guildId
		|| !args.guildType
	) {
		return result;
	}

	result.value.pf = getGuildProfileInternal(args.guildId, args.guildType, true, true, false, false);

	var requestParams = {
		"gameId": script.titleId,
		"guildName": args.guildName,
		"guildId": args.guildId,
		"guildType": args.guildType,
		"types" : [ 'public', 'members' ]
	};

	var requestUrl = getUWSServer() + "Guild/GetGuildProfile";
	var rawResponse = http.request(requestUrl, "post", JSON.stringify(requestParams), "application/json");

	try {
		result.value.uws = JSON.parse(rawResponse);
	} catch(e) {
		log.error(rawResponse);
		e.message += ' : ' + rawResponse;
		throw e
	}

	result.value.success = true;
	return result;
}

/*
 End Guilds
 */
