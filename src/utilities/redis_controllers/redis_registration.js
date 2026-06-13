const {client} = require("../../lib/redis.js");
const {generate_cache_key} = require("../redis_cache.js")
const {REDIS_CONSTANTS} = require("./redis_constants.js");


const redis_registration = {
    post_registration_redis_interaction: async (user_id, assessment_id, team_name, team_id) => {

        const registration_cache_key = generate_cache_key({
            user: user_id,
            assessment: assessment_id,
            purpose: REDIS_CONSTANTS.PURPOSE.REGISTRATION_DETAILS_CACHING
        });
        const team_cache_key_by_name = generate_cache_key({
            team: {name: team_name},
            assessment: assessment_id,
            purpose: REDIS_CONSTANTS.PURPOSE.TEAM_DETAILS_CACHING_BY_NAME
        });
        const team_members_cache_key = generate_cache_key({
            team: team_id,
            purpose: REDIS_CONSTANTS.PURPOSE.TEAM_MEMBERS_CACHING
        });

        const bitmap_key = generate_cache_key({
            user: user_id,
            contest: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.GIVEN_CONTEST_BITMAP
        });

        const client_pipeline = client.pipeline();
    
        try{
            client_pipeline.del(registration_cache_key);
            client_pipeline.del(team_cache_key_by_name);
            client_pipeline.del(team_members_cache_key);
            client_pipeline.setbit(bitmap_key, Number(assessment_id) - REDIS_CONSTANTS.CONTEST_ID_OFFSET, 1);
            const pipeline_results = await client_pipeline.exec();
            console.log('--------------------------------------------post reg--------------------------------------------')
            console.log(pipeline_results);
            return true;
        }catch(error){
            throw new Error("Error clearing registration cache: " + error.message);
        }
    }
};

module.exports = {redis_registration};