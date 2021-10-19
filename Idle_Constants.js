const HISTORY_LOG_SIZE = 100;

const SUCCESS_CODE = 200;
const RESOURCE_LOCKED_CODE = 423;
const TIER_LEADERBOARD_KEY = 'tieredLeaderboardData';
const TITLE_ID_TOP_TIER_SUFFIX = '_TopTier';
const TITLE_ID_GLOBAL_SUFFIX = '_Global';
const CHEATER_SUFFIX = "_Cheater";
const TIER_LEADERBOARD_SUFFIX = '_Tier';
const GLOBAL_LEADERBOARD_BUCKET = '_1';

const SERVER_CONFIG = {
        leaderboardServers: {
                "3D16B": "http://UltrabitWebServicesProd.ya4zvdebvk.us-west-2.elasticbeanstalk.com/", // kongregate/production
                "19081": "http://uws-dev-env.ddhjvp3mrf.us-west-1.elasticbeanstalk.com/", // staging
                "18A45": "http://uws-dev-env.ddhjvp3mrf.us-west-1.elasticbeanstalk.com/"  // auto
        },
        logglyTag: {
                "3D16B": "idle-spongebob-kongregate-ops", // kongregate/production
                "19081": "idle-spongebob-auto-ops", // staging
                "18A45": "idle-spongebob-auto-ops"  // auto
        }
};

const LOGGLY_TOKEN = '00cced27-e9fd-49e2-b332-87d611e71937';

const IS_CHEATER = 'isCheater';
const CHAT_BAN_TIMESTAMP_KEY = "chatBanEndTimeStamp";

const CHEATER_DATA_MIGRATION = "CheaterDataMigration";
const CHEATER_DATA_INTERNAL = "CheaterDataInternal";
const CHEATER_DATA_BEHAVIOR = CHEATER_DATA_MIGRATION;

const SHORT_LEADERBOARD_BUCKET_SIZE = 50;