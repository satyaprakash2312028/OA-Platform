const script = {

    get_submission_from_sorted_set:{
        numberOfKeys: 2,
        lua: `
            -- KEYS[1]: zset_cache_key
            -- KEYS[2]: hash_cache_key
            -- ARGV[1]: start_index
            -- ARGV[2]: end_index

            local zset_key = KEYS[1]
            local hash_key = KEYS[2]
            local start_idx = tonumber(ARGV[1])
            local end_idx = tonumber(ARGV[2])

            -- 1. Fetch IDs from the Sorted Set in descending order (highest score first)
            -- Note: If you are using Redis 6.2+, you can also use: redis.call('ZRANGE', zset_key, start_idx, end_idx, 'REV')
            local ids = redis.call('ZREVRANGE', zset_key, start_idx, end_idx)

            -- 2. Exit early if the requested range is empty
            if #ids == 0 then
                return {}
            end

            -- 3. Bulk fetch the JSON payloads from the Hash map using the IDs
            -- HMGET returns the values in the exact same order as the requested IDs
            local payloads = redis.call('HMGET', hash_key, unpack(ids))

            return payloads
        `
    },

    increment_if_exists: {
        numberOfKeys:1,
        lua: `
            -- KEYS[1] = The key name
            -- ARGV[1] = The increment amount

            if redis.call("EXISTS", KEYS[1]) == 1 then
                return redis.call("INCRBY", KEYS[1], 1)
            else
                return nil
            end
        `
    },
    add_submission_to_sorted_set: {
        numberOfKeys: 2,
        lua: `
            -- KEYS[1]: zset_cache_key
            -- KEYS[2]: hash_cache_key
            -- ARGV[1]: REDIS_CONSTANTS.SUBMISSION_SORTED_SET_MAX_SIZE
            -- ARGV[2...N]: score1, id1, payload1, score2, id2, payload2...

            local zset_key = KEYS[1]
            local hash_key = KEYS[2]
            local max_size = tonumber(ARGV[1])

            -- Exit early if no data arguments are passed (just max_size is present)
            if #ARGV < 4 then
                return 0
            end

            local zadd_args = {}
            local hset_args = {}
            local z_idx = 1
            local h_idx = 1

            -- 1. Batch data for O(1) network commands rather than looping calls
            for i = 2, #ARGV, 3 do
                zadd_args[z_idx] = ARGV[i]       -- score
                zadd_args[z_idx+1] = ARGV[i+1]   -- id
                z_idx = z_idx + 2
                
                hset_args[h_idx] = ARGV[i+1]     -- id
                hset_args[h_idx+1] = ARGV[i+2]   -- payload
                h_idx = h_idx + 2
            end

            -- 2. Bulk insert into ZSET and HASH
            redis.call('ZADD', zset_key, unpack(zadd_args))
            redis.call('HSET', hash_key, unpack(hset_args))

            -- 3. Check cache size and prune if necessary
            local current_size = redis.call('ZCARD', zset_key)

            if current_size > max_size then
                -- Calculate the highest rank to remove (0-indexed)
                local stop_rank = current_size - max_size - 1
                
                -- Fetch the IDs being evicted to clean up the Hash map
                local evicted_ids = redis.call('ZRANGE', zset_key, 0, stop_rank)
                
                if #evicted_ids > 0 then
                    -- Remove orphaned payloads from Hash map
                    redis.call('HDEL', hash_key, unpack(evicted_ids))
                    
                    -- Remove oldest items from Sorted Set
                    redis.call('ZREMRANGEBYRANK', zset_key, 0, stop_rank)
                end
            end

            return 1
        `
    },

    update_team_score_in_leaderboard: {
        numberOfKeys: 2,
        lua: `
            -- KEYS[1]: assessment_hash
            -- KEYS[2]: leaderboard_tag
            -- ARGV[1]: team_id_string
            -- ARGV[2]: problem_id_string
            -- ARGV[3]: sub_time_epoch (numeric)
            -- ARGV[4]: start_time_field

            local assessment_hash = KEYS[1]
            local leaderboard_tag = KEYS[2]

            local team_id_string = ARGV[1]
            local problem_id_string = ARGV[2]
            local sub_time_epoch = tonumber(ARGV[3])
            local start_time_field = ARGV[4]

            -- 1. Fetch recv_str from the hash
            local recv_str = redis.call("HGET", assessment_hash, team_id_string)
            if not recv_str then
                recv_str = ""
            end

            -- 2. Check if the problem_id_string exists in the 24-character chunks
            local flag = false
            local len = string.len(recv_str)
            local k = math.floor(len / 7)

            -- Note: Lua strings are 1-indexed. 
            -- For i=0, substring is 1 to 7. For i=1, substring is 8 to 14, etc.
            for i = 0, k - 1 do
                local start_idx = (i * 7) + 1
                local end_idx = (i + 1) * 7
                local chunk = string.sub(recv_str, start_idx, end_idx)
                
                if chunk == problem_id_string then
                    flag = true
                    break
                end
            end

            -- 3. Execute scoring logic if flag is false
            if not flag then
                local base_score_str = redis.call("HGET", assessment_hash, problem_id_string)
                local base_time_str = redis.call("HGET", assessment_hash, start_time_field)
                
                -- Safety check in case base_score or base_time doesn't exist
                if not base_score_str or not base_time_str then
                    return -1
                end
                
                local base_score = tonumber(base_score_str)
                local base_time = tonumber(base_time_str)
                
                -- Calculate inc_score
                local inc_score = base_score - ((sub_time_epoch - base_time) / 60000)
                
                -- Increase the score in the sorted set
                redis.call("ZINCRBY", leaderboard_tag, inc_score, team_id_string)
                
                -- Update the hash with the concatenated string
                local new_recv_str = recv_str .. problem_id_string
                redis.call("HSET", assessment_hash, team_id_string, new_recv_str)
                
                -- Return as string to prevent Redis from truncating float values to integers
                return tostring(inc_score)
            else
                -- 4. Return 0 if the problem was already solved
                return 0
            end
        `
    },

    get_contest_with_status: {
        numberOfKeys: 4,
        lua: `
            local lock_key = KEYS[1]
            local zset_key = KEYS[2]
            local bitmap_key = KEYS[3]
            local total_count_key = KEYS[4]

            local start_index = tonumber(ARGV[1])
            local end_index = tonumber(ARGV[2])
            local offset = tonumber(ARGV[3])

            if redis.call('GET', lock_key) ~= 'available' then
                return false
            end

            local items = redis.call('ZREVRANGE', zset_key, start_index, end_index)
            if #items == 0 then
                return items
            end

            local result = {}
            local total_contest_count = redis.call('GET', total_count_key)
            table.insert(result, total_contest_count)
            for i, item_str in ipairs(items) do
                -- 1. Push the raw JSON string to the array
                table.insert(result, item_str)
                
                -- 2. Fast regex to extract contest_id without parsing JSON
                -- Matches "contest_id": 123 or "contest_id": "123"
                local c_id_str = string.match(item_str, '"_id"%s*:%s*"?(%d+)"?')
                
                local has_given = 0
                if c_id_str then
                    local bit_index = tonumber(c_id_str) - offset
                    has_given = redis.call('GETBIT', bitmap_key, bit_index)
                end
                
                -- 3. Push the boolean (0 or 1) to the next index
                table.insert(result, has_given)
            end

            return result
        `
    },

    get_leaderboard_with_solved_problem_list: {
        numberOfKeys: 2,
        lua: `
            local assessment_hash_key = KEYS[1]
            local leaderboard_key = KEYS[2]

            local start_index = tonumber(ARGV[1])
            local end_index = tonumber(ARGV[2])

            
            local items = redis.call('ZREVRANGE', KEYS[1], ARGV[1], ARGV[2], 'WITHSCORES')

            local result = {}

            local zsize = redis.call('ZCARD', leaderboard_key)

            table.insert(result, zsize)
            
            for i = 1, #items, 2 do
                local problem_solved_string  = redis.call('HGET', assessment_hash_key, items[i])
                table.insert(result, items[i])
                table.insert(result, items[i+1])
                table.insert(result, problem_solved_string)
            end

            return result

        `
    },

    get_problems_with_status: {
        numberOfKeys: 4,
        lua: `
            local lock_key = KEYS[1]
            local zset_key = KEYS[2]
            local bitmap_key = KEYS[3]
            local total_count_key = KEYS[4]

            local start_index = tonumber(ARGV[1])
            local end_index = tonumber(ARGV[2])
            local offset = tonumber(ARGV[3])

            -- 1. Validity Check (The Lock)
            if redis.call('GET', lock_key) ~= 'available' then
                return false
            end

            -- 2. Fetch Page from Public Sorted Set using ZREVRANGE
            -- (Equiv to zrange(key, start, end, 'REV'))
            local items = redis.call('ZREVRANGE', zset_key, start_index, end_index)
            if #items == 0 then
                return items
            end

            local result = {}
            local total_problem_count = redis.call('GET', total_count_key)
            table.insert(result, total_problem_count)
            for i, item_str in ipairs(items) do
                -- 3a. Push the raw JSON string to the even index
                table.insert(result, item_str)
                
                -- 3b. Fast regex to extract the problem ID (Change "problem_id" if needed)
                local p_id_str = string.match(item_str, '"problem_id"%s*:%s*"?(%d+)"?')
                
                local has_solved = 0
                if p_id_str then
                    local bit_index = tonumber(p_id_str) - offset
                    has_solved = redis.call('GETBIT', bitmap_key, bit_index)
                end
                
                -- 3c. Push the boolean (0 or 1) to the next odd index
                table.insert(result, has_solved)
            end

            return result
        `
    }
    
}

module.exports = {script}