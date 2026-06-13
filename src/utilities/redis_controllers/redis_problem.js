const {client} = require("../../lib/redis.js");
const { Problem } = require("../../models/problem.model.js");
const {generate_cache_key} = require("../redis_cache.js")
const {REDIS_CONSTANTS} = require("./redis_constants.js");

const problem_header_extractor_to_string = (problem_mongoose_object) => {
    return JSON.stringify(problem_mongoose_object);
}

const redis_problem = {

    // save_problem_details: async (problem_mongoose_object) => {
    //     const cache_key = generate_cache_key({
    //             problem: problem_mongoose_object._id.toString(),
    //             purpose: REDIS_CONSTANTS.PURPOSE.PROBLEM_DETAILS,
    //     });

    //     try{
    //         const received_data = await client.setex(cache_key, REDIS_CONSTANTS.DURATION.ONE_DAY, JSON.stringify(problem_mongoose_object.toJSON()));
    //         return received_data;
    //     }catch(error){
    //         throw new Error("Error caching problem details: " + error.message);
    //     }
    //     return null;
    // },

    // get_problem_details: async (problem_id) => {
    //     const cache_key = generate_cache_key({
    //             problem: problem_id,
    //             purpose: REDIS_CONSTANTS.PURPOSE.PROBLEM_DETAILS,
    //     });

    //     try{
    //         const received_data = await client.get(cache_key);
    //         if(received_data) return JSON.parse(received_data);
    //         return null;
    //     }catch(error){
    //         throw new Error("Error fetching cached problem details: " + error.message);
    //     }
    //     return null;
    // },

    // remove_problem_details: async (problem_id) => {
    //     const cache_key = generate_cache_key({
    //             problem: problem_id,
    //             purpose: REDIS_CONSTANTS.PURPOSE.PROBLEM_DETAILS,
    //     });
        
    //     try{
    //         const received_data = await client.del(cache_key);
    //         return received_data;
    //     }catch(error){
    //         throw new Error("Error removing cached problem details: " + error.message);
    //     }
    //     return null;
    // },

    save_problem_to_private_set: async (problem_mongoose_object) => {
        const cache_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PRIVATE_SET,
        });

        const cache_key_lock_private = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PRIVATE_SET_LOCK,
        });

        const db_call_hash_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.PRIVATE_PROBLEM_PAGES_CACHING
        })

        const total_count_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.PRIVATE_PROBLEM_PAGES_COUNT_CACHING
        });


        try{
            const client_pipeline = client.pipeline();
            client_pipeline.zadd(cache_key, new Date(problem_mongoose_object.createdAt).getTime(), problem_header_extractor_to_string(problem_mongoose_object));
            client_pipeline.zremrangebyrank(cache_key, 0, -1*REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE - 1);

            client_pipeline.incr_if_exists(total_count_key);

            client_pipeline.expire(cache_key, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            client_pipeline.expire(cache_key_lock_private, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            


            client_pipeline.del(db_call_hash_key);

            const pipeline_results = await client_pipeline.exec();
            
            return pipeline_results[0][1];

        }catch(error){
            throw new Error("Error saving problem to private set: " + error.message);
        }
        return null;
    },

    save_problem_to_public_set: async (problem_mongoose_object) => {
        const cache_key_public = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PUBLIC_SET,
        });
        const cache_key_private = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PRIVATE_SET,
        });

        const cache_key_lock_public = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PUBLIC_SET_LOCK,
        });
        const cache_key_lock_private = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PRIVATE_SET_LOCK,
        });

        const db_call_hash_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.PUBLIC_PROBLEM_PAGES_CACHING
        })

        const private_total_count_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.PRIVATE_PROBLEM_PAGES_COUNT_CACHING
        });
        const public_total_count_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.PUBLIC_PROBLEM_PAGES_COUNT_CACHING
        });

        try{
            const client_pipeline = client.pipeline();
            client_pipeline.zadd(cache_key_public, new Date(problem_mongoose_object.createdAt).getTime(), problem_header_extractor_to_string(problem_mongoose_object));
            client_pipeline.zadd(cache_key_private, new Date(problem_mongoose_object.createdAt).getTime(), problem_header_extractor_to_string(problem_mongoose_object));

            client_pipeline.zremrangebyrank(cache_key_public, 0, -1*REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE - 1);
            client_pipeline.zremrangebyrank(cache_key_private, 0, -1*REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE - 1);

            client_pipeline.incr_if_exists(public_total_count_key);
            client_pipeline.incr_if_exists(private_total_count_key);

            client_pipeline.expire(cache_key_public, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            client_pipeline.expire(cache_key_private, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            client_pipeline.expire(cache_key_lock_public, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            client_pipeline.expire(cache_key_lock_private, REDIS_CONSTANTS.DURATION.ONE_MONTH);

            
            

            client_pipeline.del(db_call_hash_key);

            const pipeline_results = await client_pipeline.exec();
            return pipeline_results[0][1];
        }catch(error){
            throw new Error("Error saving problem to public set: " + error.message);
        }
        return null;
    },

    save_problems_to_public_set: async(problem_mongoose_object_list, total_document_count) =>{
        const cache_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PUBLIC_SET,
        });

        const cache_key_lock = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PUBLIC_SET_LOCK,
        });

        const total_count_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.PUBLIC_PROBLEM_PAGES_COUNT_CACHING
        });

        try{
            const client_pipeline = client.pipeline();


            problem_mongoose_object_list.forEach((item) => {
                client_pipeline.zadd(cache_key, new Date(item.createdAt).getTime(), problem_header_extractor_to_string(item));
            });


            client_pipeline.zremrangebyrank(cache_key, 0, -1*REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE - 1);
            client_pipeline.setex(cache_key_lock, REDIS_CONSTANTS.DURATION.ONE_MONTH, 'available');

            client_pipeline.set(total_count_key, total_document_count);
            

            client_pipeline.expire(cache_key, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            const received_data = await client_pipeline.exec();
            return true;
        }catch(error){
            throw new Error("Error uploading problem to sorted set: "+ error);
        }
    },

    save_problems_to_private_set: async(problem_mongoose_object_list, total_document_count) =>{
        const cache_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PRIVATE_SET,
        });

        const cache_key_lock = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PRIVATE_SET_LOCK,
        });

        const total_count_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.PRIVATE_PROBLEM_PAGES_COUNT_CACHING
        });

        try{
            const client_pipeline = client.pipeline();


            problem_mongoose_object_list.forEach((item) => {
                client_pipeline.zadd(cache_key, new Date(item.createdAt).getTime(), problem_header_extractor_to_string(item));
            });


            client_pipeline.zremrangebyrank(cache_key, 0, -1*REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE - 1);
            client_pipeline.setex(cache_key_lock, REDIS_CONSTANTS.DURATION.ONE_MONTH, 'available');
            client_pipeline.set(total_count_key, total_document_count);
            
            
            client_pipeline.expire(cache_key, REDIS_CONSTANTS.DURATION.ONE_MONTH);
            const received_data = await client_pipeline.exec();
            return true;
        }catch(error){
            throw new Error("Error uploading problem to sorted set: "+ error);
        }
    },

    get_problems_from_private_set: async (page_number, user_id) => {
        if (page_number < 1 || page_number > REDIS_CONSTANTS.MAX_PAGES) return null;

        const cache_key_lock = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PRIVATE_SET_LOCK, 
        });

        const cache_key_zset = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PRIVATE_SET,
        });

        const cache_key_bitmap = generate_cache_key({
            user: user_id,
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.SOLVED_PROBLEM_TO_BITMAP,
        });

        const total_count_key = generate_cache_key({
            problem: REDIS_CONSTANTS.MANY_ENTITIES,
            purpose: REDIS_CONSTANTS.PURPOSE.PRIVATE_PROBLEM_PAGES_COUNT_CACHING
        });

        try {
            const start_index = 0;
            const end_index = Math.floor(REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE / REDIS_CONSTANTS.MAX_PAGES * page_number) - 1;
            const offset = REDIS_CONSTANTS.PROBLEM_ID_OFFSET;

            const raw_data = await client.get_problems_with_status(
                cache_key_lock,
                cache_key_zset,
                cache_key_bitmap,
                total_count_key,
                start_index,
                end_index,
                offset
            );

            if (!raw_data) return null;

            const parsed_data = [];

            for (let i = 1; i < raw_data.length; i += 2) {
                try {
                    const temp = JSON.parse(raw_data[i]);
                    if (temp !== null) {
                        temp.isSolved = raw_data[i + 1] === 1;
                        parsed_data.push(temp);
                    }
                } catch (error) {
                    console.log("Error parsing this element: " + raw_data[i]);
                }
            }

            const final_data = {
                problems: parsed_data,
                totalPages: Math.ceil(Number(raw_data[0])/REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE),
                pageNumber: page_number
            }
            return final_data;

        } catch (error) {
            throw new Error("Error fetching private problems with status: " + error.message);
        }
    },

    get_problems_from_public_set: async (page_number, user_id) => {
        console.log("here")
    if (page_number < 1 || page_number > REDIS_CONSTANTS.MAX_PAGES) return null;
    console.log("there")
    const cache_key_lock = generate_cache_key({
        problem: REDIS_CONSTANTS.MANY_ENTITIES,
        purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PUBLIC_SET_LOCK,
    });

    const cache_key_zset = generate_cache_key({
        problem: REDIS_CONSTANTS.MANY_ENTITIES,
        purpose: REDIS_CONSTANTS.PURPOSE.SAVE_PROBLEM_TO_PUBLIC_SET,
    });

    const cache_key_bitmap = generate_cache_key({
        user: user_id,
        problem: REDIS_CONSTANTS.MANY_ENTITIES,
        purpose: REDIS_CONSTANTS.PURPOSE.SOLVED_PROBLEM_TO_BITMAP,
    });

    const total_count_key = generate_cache_key({
        problem: REDIS_CONSTANTS.MANY_ENTITIES,
        purpose: REDIS_CONSTANTS.PURPOSE.PUBLIC_PROBLEM_PAGES_COUNT_CACHING
    });

    try {
        const start_index = 0;
        const end_index = REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE / REDIS_CONSTANTS.MAX_PAGES * page_number - 1;
        const offset = REDIS_CONSTANTS.PROBLEM_ID_OFFSET;

        const raw_data = await client.get_problems_with_status(
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
                    temp.isSolved = raw_data[i + 1] === 1;
                    parsed_data.push(temp);
                }
            } catch (error) {
                console.log("Error parsing this element: " + raw_data[i]);
            }
        }

        const final_data = {
            problems: parsed_data,
            totalPages: Math.ceil(Number(raw_data[0])/REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE),
            pageNumber: page_number
        }
        return final_data;

    } catch (error) {
        throw new Error("Error fetching public problems with status: " + error.message);
    }
}

    
}

module.exports = {redis_problem};