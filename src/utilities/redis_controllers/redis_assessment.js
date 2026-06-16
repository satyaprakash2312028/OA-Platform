const {client} = require("../../lib/redis.js");
const {generate_cache_key} = require("../redis_cache.js")
const {REDIS_CONSTANTS} = require("./redis_constants.js");


const redis_assessment = {

    save_assessment_info_to_sorted_set: async (assessment_mongoose_object) => {
        const cache_key = generate_cache_key({
                assessment: REDIS_CONSTANTS.MANY_ENTITIES,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_INFO,
        });

        const cache_key_lock = generate_cache_key({
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_INFO_LOCK,
        });

        const db_call_hash_key = generate_cache_key({
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_PAGES_CACHING
        });
        const total_count_key = generate_cache_key({
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_PAGES_COUNT_CACHING
        });

        try{
            const client_pipeline = client.pipeline();
            client_pipeline.zadd(cache_key, new Date(assessment_mongoose_object.startTime).getTime(), JSON.stringify(assessment_mongoose_object));
            client_pipeline.zremrangebyrank(cache_key, 0, -1*REDIS_CONSTANTS.ASSESSMENT_SORTED_SET_MAX_SIZE - 1);
            client_pipeline.incr_if_exists(total_count_key);

            client_pipeline.expire(cache_key, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            client_pipeline.expire(cache_key_lock, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            

            client_pipeline.del(db_call_hash_key);
            
            const pipeline_results = await client_pipeline.exec();
            
            return pipeline_results[0][1];
        }catch(error){
            throw new Error("Error saving assessment info to sorted set: " + error.message);
        }
        return null;
    },

    get_assessment_info_from_sorted_set_by_page_number: async (page_number, user_id) => {
        if (page_number < 1 || page_number > REDIS_CONSTANTS.MAX_PAGES) return null;

        const cache_key_lock = generate_cache_key({
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_INFO_LOCK,
        });

        const cache_key_zset = generate_cache_key({
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_INFO,
        });

        const cache_key_bitmap = generate_cache_key({
            user: user_id,
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.GIVEN_CONTEST_BITMAP
        });

        const total_count_key = generate_cache_key({
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_PAGES_COUNT_CACHING
        });

        try {
            const start_index = 0;
            const end_index = REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE / REDIS_CONSTANTS.MAX_PAGES * page_number - 1;
            const offset = REDIS_CONSTANTS.CONTEST_ID_OFFSET;

            const raw_data = await client.get_assessment_with_status(
                cache_key_lock,
                cache_key_zset,
                cache_key_bitmap,
                total_count_key,
                start_index,
                end_index,
                offset
            );
            console.log(raw_data);
            if (!raw_data) return null;

            const parsed_data = [];
            for (let i = 1; i < raw_data.length; i += 2) {
                try {
                    const temp = JSON.parse(raw_data[i]);
                    if (temp !== null) {
                        temp.isRegistered = (raw_data[i + 1] === 1);
                        parsed_data.push(temp);
                    }
                } catch {
                    console.error(`Cache corruption: Failed to parse assessment info.`, error);
                }
            }
            const final_data = {
                assessments: parsed_data,
                totalPages: Math.ceil(Number(raw_data[0])/REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE),
                pageNumber: page_number
            }
            return final_data;

        } catch (error) {
            throw new Error("Error fetching fast assessment info: " + error.message);
        }
    },
    
    save_assessment_array_to_sorted_set : async (assessment_mongoose_object_list, total_document_count) => {
        const cache_key = generate_cache_key({
                assessment: REDIS_CONSTANTS.MANY_ENTITIES,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_INFO,
        });

        const cache_key_lock = generate_cache_key({
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_INFO_LOCK,
        });

        const total_count_key = generate_cache_key({
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_PAGES_COUNT_CACHING
        });

        try{
            const client_pipeline = client.pipeline();
            assessment_mongoose_object_list.forEach(assessment_mongoose_object => {
                client_pipeline.zadd(cache_key, new Date(assessment_mongoose_object.startTime).getTime(), JSON.stringify(assessment_mongoose_object));
            });
            client_pipeline.zremrangebyrank(cache_key, 0, -1*REDIS_CONSTANTS.ASSESSMENT_SORTED_SET_MAX_SIZE - 1);
            client_pipeline.setex(cache_key_lock, REDIS_CONSTANTS.DURATION.ONE_MONTH, 'available');
            client_pipeline.set(total_count_key, total_document_count);

            client_pipeline.expire(cache_key, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            const received_data = await client_pipeline.exec();
            return true;
        }catch(error){
            throw new Error("Error saving assessment array to sorted set: " + error.message);
        }
        return null;
    },

    add_problem_to_active_hash: async(problem_mongoose_object) =>{

        const hash_key = generate_cache_key({
            assessment: problem_mongoose_object.assessment.toString(),
            purpose: REDIS_CONSTANTS.PURPOSE.ACTIVE_ASSESSMENT_DATA
        });

        const field_key = generate_cache_key({
            problem: problem_mongoose_object._id.toString()
        })

        try{
            const received_data = await client.hset(hash_key, field_key, JSON.stringify(problem_mongoose_object));
            return received_data;
        }catch(error){
            throw new Error("Error in redis_assessment.add_problem_to_active_hash: "+ error);
        }

        return null;
    },

    make_assessment_inactive: async(assessment_id) => {

        const leaderboard_key = generate_cache_key({
            assessment: assessment_id,
            purpose: REDIS_CONSTANTS.PURPOSE.LEADERBOARD
        });

        const assessment_hash_key = generate_cache_key({
            assessment: assessment_id,
            purpose: REDIS_CONSTANTS.PURPOSE.ACTIVE_ASSESSMENT_DATA
        });

        try{
            const client_pipeline = client.pipeline();
            client_pipeline.del(leaderboard_key);
            client_pipeline.del(assessment_hash_key);

            const received_data = await client_pipeline.exec();
            return received_data[0][1];
        }catch(error){
            throw new Error("Error in redis_assessment.make_assessment_inactive: "+ error);
        }
        return null;
    },

    make_assessment_active: async(problem_mongoose_object_list, assessment_mongoose_object) => {
        const assessment_hash_key = generate_cache_key({
            assessment: assessment_mongoose_object._id.toString(),
            purpose: REDIS_CONSTANTS.PURPOSE.ACTIVE_ASSESSMENT_DATA
        });
        const start_time_field_key = generate_cache_key({
            purpose: REDIS_CONSTANTS.PURPOSE.START_TIME
        })
        try{
            const client_pipeline = client.pipeline();
            let field_key;
            problem_mongoose_object_list.forEach((item) => {
                field_key = item._id.toString();
                client_pipeline.hset(assessment_hash_key, field_key, item.points);
            });

            client_pipeline.hset(assessment_hash_key, start_time_field_key, new Date(assessment_mongoose_object.startTime).getTime());
            client_pipeline.expire(assessment_hash_key, REDIS_CONSTANTS.DURATION.ONE_WEEK);
            const pipeline_results = await client_pipeline.exec();

            return true;
        }catch(error){
            throw new Error("Error while activating assessment using redis hash: "+ error);
        }
    }
    
}

module.exports = {redis_assessment};