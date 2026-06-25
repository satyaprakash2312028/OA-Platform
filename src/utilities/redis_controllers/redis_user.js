const {client} = require("../../lib/redis.js");
const {generate_cache_key} = require("../redis_cache.js")
const {REDIS_CONSTANTS} = require("./redis_constants.js");


const redis_user = {


    save_user_authentication_info: async (user_mongoose_object) => {
        const cache_key = generate_cache_key({
                user: user_mongoose_object._id,
                purpose: REDIS_CONSTANTS.PURPOSE.AUTHENTICATION,
        });
        
        try{           
            await client.setex(cache_key, REDIS_CONSTANTS.DURATION.ONE_HOUR, JSON.stringify(user_mongoose_object)); 
        }catch(err){
            throw new Error("Error caching user authentication info: " + err.message);
        }
    },

    get_user_authentication_info: async (user_id) => {
        const cache_key = generate_cache_key({
                user: user_id,
                purpose: REDIS_CONSTANTS.PURPOSE.AUTHENTICATION,
        });

        try{
            const cached_data = await client.get(cache_key);
            return cached_data ? JSON.parse(cached_data) : null;
        }catch(error){
            throw new Error("Error fetching cached user authentication info: " + error.message);
        }
        return null;
    },

    remove_user_authentication_info: async (user_id) => {
        const cache_key = generate_cache_key({
                user: user_id,
                purpose: REDIS_CONSTANTS.PURPOSE.AUTHENTICATION,
        });

        try{
            const received_data = await client.del(cache_key);
            return received_data;
        }catch(error){
            throw new Error("Error removing cached user authentication info: " + error.message);
        }
        return null;
    },

    get_user_contest_count: async (user_id) => {
        const cache_key = generate_cache_key({
            user: user_id,
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.GIVEN_CONTEST_BITMAP
        });
        try{
            const client_pipeline = client.pipeline();
            client_pipeline.exists(cache_key);
            client_pipeline.bitcount(cache_key);
            const pipeline_results = await client_pipeline.exec();
            if(pipeline_results[0][1] === 0) return null;

            const final_data = {
                count: Number(pipeline_results[1][1])-1
            }
            return final_data;
        }catch(error){
            throw new Error("Error fetching cached contest count: " + error.message);
        }
    },

    save_user_submission : async (user_id, submission_mongoose_object) => {
        const zset_cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION,
        });

        const hash_cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.SUBMISSION_HASH,
        });

        const cache_key_lock = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION_LOCK,
        });

        const db_call_hash_key = generate_cache_key({
            user: user_id,
            purpose: REDIS_CONSTANTS.PURPOSE.USER_SUBMISSION_PAGES_CACHING
        });

        const total_count_key = generate_cache_key({
            user: user_id,
            purpose: REDIS_CONSTANTS.PURPOSE.USER_SUBMISSION_PAGES_COUNT_CACHING
        });


        const bitmap_key = generate_cache_key({
            user: user_id,
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SOLVED_PROBLEM_TO_BITMAP,
        });
        const last_acc_sub_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.LAST_ACCEPTED_SUBMISSION,
        });

        
        try{
            const client_pipeline = client.pipeline();
            client_pipeline.add_submission(
                zset_cache_key,
                hash_cache_key,
                REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE,
                new Date(submission_mongoose_object.createdAt).getTime(),
                submission_mongoose_object._id.toString(),
                JSON.stringify(submission_mongoose_object)
            );
            client_pipeline.expire(cache_key_lock, REDIS_CONSTANTS.DURATION.THREE_DAYS);
            client_pipeline.expire(zset_cache_key, REDIS_CONSTANTS.DURATION.THREE_DAYS);
            client_pipeline.expire(hash_cache_key, REDIS_CONSTANTS.DURATION.THREE_DAYS);
            

            if(submission_mongoose_object.status === 'Pending') {
                client_pipeline.incr_if_exists(total_count_key);
            }

            if(submission_mongoose_object.status === 'Accepted'){
                client_pipeline.setbit_if_exists(bitmap_key, Number(submission_mongoose_object.problem) - REDIS_CONSTANTS.PROBLEM_ID_OFFSET, 1);
                client_pipeline.setex(last_acc_sub_key, REDIS_CONSTANTS.DURATION.THREE_DAYS, JSON.stringify(submission_mongoose_object));
            }


            const pipeline_results = await client_pipeline.exec();
            return pipeline_results[0][1];
        }catch(error){
            throw new Error("Error caching user submission: " + error.message);
        }
        return null;
    },

    get_user_submissions: async (user_id, page_number) => {
        if(page_number < 1 || page_number > REDIS_CONSTANTS.MAX_PAGES) return null;
        const zset_cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION,
        });

        const hash_cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.SUBMISSION_HASH,
        });

        const cache_key_lock = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION_LOCK,
        });

        const total_count_key = generate_cache_key({
            user: user_id,
            purpose: REDIS_CONSTANTS.PURPOSE.USER_SUBMISSION_PAGES_COUNT_CACHING
        });
        

        try{
            const start_index = REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE/REDIS_CONSTANTS.MAX_PAGES*(page_number - 1);
            const end_index = REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE/REDIS_CONSTANTS.MAX_PAGES*page_number - 1;
            const client_pipeline = client.pipeline();
            client_pipeline.get_submission(
                zset_cache_key,
                hash_cache_key,
                start_index,
                end_index
            );
            client_pipeline.get(cache_key_lock);
            client_pipeline.get(total_count_key);
            const pipeline_results = await client_pipeline.exec();
            const lock_status = pipeline_results[1][1];
            if(pipeline_results[0][0] || pipeline_results[1][0] || pipeline_results[2][0]) return null;
            if(lock_status === "locked"){
                
                const received_data = pipeline_results[0][1];
                if (!received_data || !Array.isArray(received_data)) return null;
                const parsed_data = received_data.reduce((acc, item) => {
                    try {
                        const parsedItem = JSON.parse(item);
                        if (parsedItem !== null) {
                            acc.push(parsedItem);
                        }
                    } catch {
                    }
                    return acc;
                }, []);
                const final_data = {
                    submissions: parsed_data,
                    totalPages: Math.ceil(Number(pipeline_results[2][1])/REDIS_CONSTANTS.ASSESSMENT_SORTED_SET_MAX_SIZE),
                    pageNumber: page_number
                }
                return final_data;
            }else{
                return null;
            }
        }catch(error){
            throw new Error("Error fetching cached user submissions: " + error.message);
        }
    },

    get_user_recent_submissions: async (user_id) => {
        const zset_cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION,
        });

        const hash_cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.SUBMISSION_HASH,
        });

        const cache_key_lock = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION_LOCK,
        });

        try{
            const start_index = 0;
            const end_index = REDIS_CONSTANTS.RECENT_SUBMISSION_COUNT - 1;
            const client_pipeline = client.pipeline();
            client_pipeline.get_submission(
                zset_cache_key,
                hash_cache_key,
                start_index,
                end_index
            );
            client_pipeline.get(cache_key_lock);
            const pipeline_results = await client_pipeline.exec();
            console.log(pipeline_results)
            const lock_status = pipeline_results[1][1];
            if(pipeline_results[0][0] || pipeline_results[1][0]) return null;
            if(lock_status === "locked"){
                const received_data = pipeline_results[0][1];
                const parsed_data = received_data.reduce((acc, item) => {
                    try {
                        const parsedItem = JSON.parse(item);
                        if (parsedItem !== null) {
                            acc.push(parsedItem);
                        }
                    } catch {
                    }
                    return acc;
                }, []);

                const final_data = {
                    submissions: parsed_data
                }
                return final_data;
            }else{
                return null;
            }
        }catch(error){
            throw new Error("Error fetching cached user recent submissions: " + error.message);
        }
    },

    save_user_submissions: async (user_id, submission_mongoose_object_list, total_document_count) => {
        const zset_cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION,
        });

        const hash_cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.SUBMISSION_HASH,
        });

        const cache_key_lock = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.ADD_SUBMISSION_LOCK,
        });

        const total_count_key = generate_cache_key({
            user: user_id,
            purpose: REDIS_CONSTANTS.PURPOSE.USER_SUBMISSION_PAGES_COUNT_CACHING
        });

        try {
            const lua_args = [];
            
            submission_mongoose_object_list.forEach((item) => {
                const doc = item;
                const score = new Date(doc.createdAt).getTime(); 
                const id = doc._id.toString();
                const payload = JSON.stringify(doc);
                lua_args.push(score, id, payload);
            });

            const client_pipeline = client.pipeline();
            
            client_pipeline.add_submission(
                zset_cache_key,
                hash_cache_key,
                REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE,
                ...lua_args
            );
            
            client_pipeline.setex(cache_key_lock, REDIS_CONSTANTS.DURATION.THREE_DAYS, "locked");
            client_pipeline.expire(zset_cache_key, REDIS_CONSTANTS.DURATION.THREE_DAYS);
            client_pipeline.expire(hash_cache_key, REDIS_CONSTANTS.DURATION.THREE_DAYS);
            client_pipeline.set(total_count_key, total_document_count);
            
            
            const pipeline_results = await client_pipeline.exec();
            console.log(pipeline_results)
            return pipeline_results[0][1];
        } catch(error) {
            throw new Error("Error caching user submissions: " + error.message);
        }
    },

    save_last_accepted_submission : async (user_id, submission_mongoose_object) => {
        const cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.LAST_ACCEPTED_SUBMISSION,
        });

        try{
            const received_data = await client.setex(cache_key, REDIS_CONSTANTS.DURATION.THREE_DAYS, JSON.stringify(submission_mongoose_object));
            return received_data;
        }catch(error){
            throw new Error("Error caching last accepted submission: " + error.message);
        }
        return null;
    },

    get_last_accepted_submission: async (user_id) => {
        const cache_key = generate_cache_key({
            user: user_id,
            submission: REDIS_CONSTANTS.ONE_ENTITY,
            purpose: REDIS_CONSTANTS.PURPOSE.LAST_ACCEPTED_SUBMISSION,
        });
        try{
            const cached_data = await client.get(cache_key);
            if(!cached_data) return null;
            const parsed_data = JSON.parse(cached_data);

            const final_data = {
                submission: parsed_data
            }
            return final_data;
        }catch(error){
            throw new Error("Error fetching cached last accepted submission: " + error.message);
        }
        return null;  
    },

    save_problem_to_solved_bitmap : async(user_id, problem_id_list) => {
        const cache_key = generate_cache_key({
            user: user_id,
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SOLVED_PROBLEM_TO_BITMAP,
        });

        try{
            const client_pipeline = client.pipeline();
            client_pipeline.setbit(cache_key, 0, 1);
            for(let problem_id of problem_id_list){
                client_pipeline.setbit(cache_key, Number(problem_id) - REDIS_CONSTANTS.PROBLEM_ID_OFFSET, 1);
            }
            const pipeline_results = await client_pipeline.exec();
            return true;
        }catch(error){
            throw new Error("Error caching solved problem: " + error.message);
        }
        return null;
    },

    check_problems_in_solved_bitmap : async(user_id, problem_id_list) => {
        const cache_key = generate_cache_key({
            user: user_id,
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SOLVED_PROBLEM_TO_BITMAP,
        });
        try{
            const client_pipeline = client.pipeline();
            client_pipeline.exists(cache_key);
            for(let problem_id of problem_id_list){
                client_pipeline.getbit(cache_key, Number(problem_id) - REDIS_CONSTANTS.PROBLEM_ID_OFFSET);
            }
            const pipeline_results = await client_pipeline.exec();
            if(!pipeline_results[0][1]) return null;
            const parsed_data = pipeline_results.reduce((acc, item, index) => {
                if(!index) return acc;
                if(item[0]){
                    acc.push(null)
                }
                else acc.push(item[1]); 
                return acc;
            }, []);
            return parsed_data;
        }catch(error){
            throw new Error("Error checking problems in solved set: " + error.message);
        }
    },

    save_to_user_given_contest_bitmap : async(user_id, contest_id_list) => {
        
        const cache_key = generate_cache_key({
            user: user_id,
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.GIVEN_CONTEST_BITMAP
        });
        try{
            const client_pipeline = client.pipeline();
            client_pipeline.setbit(cache_key, 0, 1);
            for(let contest_id of contest_id_list){
                client_pipeline.setbit(cache_key, Number(contest_id) - REDIS_CONSTANTS.CONTEST_ID_OFFSET, 1);
            }
            const pipeline_results = await client_pipeline.exec();
            console.log("-----------------------------------Done here-----------------------------------");
            console.log(contest_id_list);
            return true;
        }catch(error){
            throw new Error("Error caching given contest: " + error.message);
        }
    },

    check_contests_in_given_bitmap : async(user_id, contest_id_list) => {
        const cache_key = generate_cache_key({
            user: user_id,
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.GIVEN_CONTEST_BITMAP
        });
        try{
            const client_pipeline = client.pipeline();
            client_pipeline.exists(cache_key);
            for(let contest_id of contest_id_list){
                client_pipeline.getbit(cache_key, Number(contest_id) - REDIS_CONSTANTS.CONTEST_ID_OFFSET);
            }

            const pipeline_results = await client_pipeline.exec();
            if(!pipeline_results[0][1]) return null;
            const parsed_data = pipeline_results.reduce((acc, item, index) => {
                if(!index) return acc;
                if(item[0]){
                    acc.push(null);
                }
                else acc.push(item[1]); 
                return acc;
            }, []);
            return parsed_data;
        }catch(error){
            throw new Error("Error checking contests in given set: " + error.message);
        }
    },

    get_problem_solved_count: async(user_id) => {
        const cache_key = generate_cache_key({
            user: user_id,
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SOLVED_PROBLEM_TO_BITMAP,
        });
        try{
            
            const client_pipeline = client.pipeline();
            client_pipeline.exists(cache_key);
            client_pipeline.bitcount(cache_key);
            const pipeline_results = await client_pipeline.exec();
            if(pipeline_results[0][1] === 0) return null;
            const final_data = {
                problemSolved: Number(pipeline_results[1][1]) - 1
            }
            return final_data;
        }catch(error){
            
            throw new Error("Error fetching cached problem solved count: " + error.message);
        }
    },

    get_problem_bitmap_existence_status : async(user_id) => {
        const bitmap_key = generate_cache_key({
            user: user_id,
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SOLVED_PROBLEM_TO_BITMAP,
        });

        try{
            const received_data = await client.exists(bitmap_key);
            return received_data;
        }catch(error){
            throw new Error("Error in get_problem_bitmap_existence_status: "+ error);
        }
    },

    get_contest_bitmap_existence_status : async(user_id) => {
        const bitmap_key = generate_cache_key({
            user: user_id,
            assessment: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.GIVEN_CONTEST_BITMAP
        });

        try{
            const received_data = await client.exists(bitmap_key);
            return received_data;
        }catch(error){
            throw new Error("Error in get_contest_bitmap_existence_status: "+ error);
        }
    }
}

module.exports = {redis_user};