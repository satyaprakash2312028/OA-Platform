const Redis = require("ioredis");
const dotenv = require("dotenv");
const { script } = require('../utilities/redis_controllers/lua_scripts/lua_script_literals');
dotenv.config();

let client;

try {
    client = new Redis(process.env.REDIS_URL, {
        // 1. Reconnect every 60 seconds
        retryStrategy: (times) => {
            console.warn(`[Redis] Connection lost. Retrying in 1 minute... (Attempt ${times})`);
            return 60000; // Return the delay in milliseconds
        },
        // 2. Fail commands immediately instead of queuing them while waiting
        enableOfflineQueue: false 
    });

    const originalPipeline = client.pipeline.bind(client);

    client.pipeline = function (...args) {
        const pipe = originalPipeline(...args);
        const originalExec = pipe.exec.bind(pipe);
        pipe.exec = async function (...execArgs) {
            const results = await originalExec(...execArgs);
            if (Array.isArray(results)) {
                for (const [err, result] of results) {
                    if (err) {
                        throw err; 
                    }
                }
            }
            return results;
        };

        return pipe;
    };
    client.defineCommand('update_team_status', script.update_team_score_in_leaderboard);
    client.defineCommand('add_submission', script.add_submission_to_sorted_set);
    client.defineCommand('get_assessment_with_status', script.get_contest_with_status);
    client.defineCommand('get_problems_with_status', script.get_problems_with_status);
    client.defineCommand('get_leaderboard', script.get_leaderboard_with_solved_problem_list);
    client.defineCommand('incr_if_exists', script.increment_if_exists);
    client.defineCommand('get_submission', script.get_submission_from_sorted_set);
    client.defineCommand('setbit_if_exists', script.setbit_if_exists);
    client.on("connect", () => {
        console.log("Connected to Redis");
    });
    client.on("error", (err) => {
        if (err.code === 'ECONNREFUSED') {
            console.error("Redis connection refused."); 
        } else {
            console.error("Redis error: ", err.message);
        }
    });

} catch (error) {
    console.log(error);
}

module.exports = { client };