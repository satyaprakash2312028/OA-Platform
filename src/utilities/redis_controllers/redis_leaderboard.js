const {client} = require("../../lib/redis.js");
const {generate_cache_key} = require("../redis_cache.js")
const {REDIS_CONSTANTS} = require("./redis_constants.js");


const redis_leaderboard = {
    
    increase_team_score: async(team_id, assessment_id, increment_value) => {
        const cache_key = generate_cache_key({
            assessment: assessment_id,
            purpose: REDIS_CONSTANTS.PURPOSE.LEADERBOARD
        });

        try{
            const received_data = await client.zadd(cache_key, 'INCR', increment_value, team_id);
            return received_data;
        }catch(error){
            throw new Error("Error in redis_leaderboard.increase_team_score: "+ error);
        }
        return null;
    },

    get_leaderboard_by_page_number: async(assessment_id, page_number, team_id) =>{
        if(page_number<1){
            return [0];
        }

        console.log(assessment_id, page_number, team_id)
        
        const assessment_hash_key = generate_cache_key({
            assessment: assessment_id,
            purpose: REDIS_CONSTANTS.PURPOSE.ACTIVE_ASSESSMENT_DATA
        });

        const leaderboard_key = generate_cache_key({
            assessment: assessment_id,
            purpose: REDIS_CONSTANTS.PURPOSE.LEADERBOARD
        });

        try{
            const start_index = REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE/REDIS_CONSTANTS.MAX_PAGES*(page_number-1);
            const end_index = REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE/REDIS_CONSTANTS.MAX_PAGES*page_number - 1;

            const client_pipeline = client.pipeline();

            client_pipeline.get_leaderboard(
                assessment_hash_key,
                leaderboard_key,
                start_index,
                end_index
            );
            client_pipeline.zscore(leaderboard_key, team_id);
            client_pipeline.hget(assessment_hash_key, team_id);
            client_pipeline.zrevrank(leaderboard_key, team_id);

            const pipeline_results = await client_pipeline.exec();
            
            console.log(pipeline_results);

            const received_data = pipeline_results[0][1];

            let parsed_data = [];
            for(let i = 1; i<received_data.length; i+=3){
                let problem_id_list = [];
                let arr_length = received_data[i+2].length;
                for(let j = 0; j<arr_length; j+=7){
                    problem_id_list.push(received_data[i+2].substr(j, 7));
                }

                problem_id_list.sort(function(a, b){
                    return Number(b) - Number(a);
                })

                const tempJSON = {
                    team: received_data[i],
                    score: Number(received_data[i+1]),
                    problems: problem_id_list
                }
                parsed_data.push(tempJSON);
            }

            let user_problem_id_list = [];
            let user_string = pipeline_results[2][1];
            if(user_string === null) user_string = "";

            for(let i = 0; i<user_string.length; i+=7){
                user_problem_id_list.push(user_string.substr(i, 7));
            }

            user_problem_id_list.sort(function(a, b){
                return Number(b) - Number(a);
            })

            const final_data = {
                teams: parsed_data,
                totalPages: Math.ceil(Number(received_data[0])/REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE),
                pageNumber: page_number,
                self: {
                    score: Number(pipeline_results[1][1]) || 0,
                    rank: (pipeline_results[3][1]===null)? -1:Number(pipeline_results[3][1] + 1),
                    problems: user_problem_id_list
                }
            }
            return final_data;
        }catch(error){
            throw new Error("Error in redis_leaderboard.get_leaderboard_by_page_number: "+ error);
        }
        return null;

    },

    update_team_score_in_leaderboard: async(judge_verdict_payload_object) => {
        const assessment_hash_key = generate_cache_key({
            assessment: judge_verdict_payload_object.assessment,
            purpose: REDIS_CONSTANTS.PURPOSE.ACTIVE_ASSESSMENT_DATA
        });
        
        const leaderboard_key = generate_cache_key({
            assessment: judge_verdict_payload_object.assessment,
            purpose: REDIS_CONSTANTS.PURPOSE.LEADERBOARD
        });
        
        const start_time_field_key = generate_cache_key({
            purpose: REDIS_CONSTANTS.PURPOSE.START_TIME
        })
        
        if(judge_verdict_payload_object.verdict!=='Accepted') return null;
        
        console.log('----------------------------------------------------------------this is issue----------------------------------------------------------------')
        try{
            const received_data = await client.update_team_status(
                assessment_hash_key,
                leaderboard_key,
                judge_verdict_payload_object.team,
                judge_verdict_payload_object.problem,
                JSON.stringify(new Date(judge_verdict_payload_object.createdAt).getTime()),
                start_time_field_key
            );
            console.log(received_data);
            return received_data;
        }catch(error){
            throw new Error("Error in redis_leaderboard.update_team_score_in_leaderboard: "+ error);
        }
        return null;
    },

    update_team_score_in_leaderboard_and_submission_status: async(judge_verdict_payload_object) => {
        const assessment_hash_key = generate_cache_key({
            assessment: judge_verdict_payload_object.assessment,
            purpose: REDIS_CONSTANTS.PURPOSE.ACTIVE_ASSESSMENT_DATA
        });
        
        const leaderboard_key = generate_cache_key({
            assessment: judge_verdict_payload_object.assessment,
            purpose: REDIS_CONSTANTS.PURPOSE.LEADERBOARD
        });
        
        const start_time_field_key = generate_cache_key({
            purpose: REDIS_CONSTANTS.PURPOSE.START_TIME
        })

        const zset_cache_key = generate_cache_key({
            user: judge_verdict_payload_object.user,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION,
        });

        const hash_cache_key = generate_cache_key({
            user: judge_verdict_payload_object.user,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.SUBMISSION_HASH,
        });

        const cache_key_lock = generate_cache_key({
            user: judge_verdict_payload_object.user,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION_LOCK,
        });

        const db_call_hash_key = generate_cache_key({
            user: judge_verdict_payload_object.user,
            purpose: REDIS_CONSTANTS.PURPOSE.USER_SUBMISSION_PAGES_CACHING
        });


        const total_count_key = generate_cache_key({
            user: judge_verdict_payload_object.user,
            purpose: REDIS_CONSTANTS.PURPOSE.USER_SUBMISSION_PAGES_COUNT_CACHING
        });


        const bitmap_key = generate_cache_key({
            user: judge_verdict_payload_object.user,
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SOLVED_PROBLEM_TO_BITMAP,
        });
        const last_acc_sub_key = generate_cache_key({
            user: judge_verdict_payload_object.user,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.LAST_ACCEPTED_SUBMISSION,
        });
        
        
        
        try{
            const client_pipeline = client.pipeline();
            judge_verdict_payload_object.status = judge_verdict_payload_object.verdict;
            delete judge_verdict_payload_object.verdict;
            if(judge_verdict_payload_object.status === 'Accepted'){
                client_pipeline.update_team_status(
                    assessment_hash_key,
                    leaderboard_key,
                    judge_verdict_payload_object.team,
                    judge_verdict_payload_object.problem,
                    JSON.stringify(new Date(judge_verdict_payload_object.createdAt).getTime()),
                    start_time_field_key
                );
                
                client_pipeline.setbit_if_exists(bitmap_key, Number(judge_verdict_payload_object.problem) - REDIS_CONSTANTS.PROBLEM_ID_OFFSET, 1);
                client_pipeline.setex(last_acc_sub_key, REDIS_CONSTANTS.DURATION.THREE_DAYS, JSON.stringify(judge_verdict_payload_object));
                
            }
            
            delete judge_verdict_payload_object.team;
            client_pipeline.add_submission(
                zset_cache_key,
                hash_cache_key,
                REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE,
                new Date(judge_verdict_payload_object.createdAt).getTime(),
                judge_verdict_payload_object._id.toString(),
                JSON.stringify(judge_verdict_payload_object)
            );
            client_pipeline.expire(cache_key_lock, REDIS_CONSTANTS.DURATION.THREE_DAYS);
            client_pipeline.expire(zset_cache_key, REDIS_CONSTANTS.DURATION.THREE_DAYS);
            client_pipeline.expire(hash_cache_key, REDIS_CONSTANTS.DURATION.THREE_DAYS);
            const received_data = await client_pipeline.exec();
            return received_data;
        }catch(error){
            throw new Error("Error in redis_leaderboard.update_team_score_in_leaderboard_and_submission_status: "+ error);
        }
        return null;
    }

}

module.exports = {redis_leaderboard};