const Redis = require("ioredis");
const dotenv = require("dotenv");
const {script} = require('../utilities/redis_controllers/lua_scripts/lua_script_literals');
dotenv.config();
const client = new Redis(process.env.REDIS_URL);
client.defineCommand('update_team_status' , script.update_team_score_in_leaderboard);
client.defineCommand('add_submission', script.add_submission_to_sorted_set);
client.defineCommand('get_assessment_with_status' , script.get_contest_with_status);
client.defineCommand('get_problems_with_status' , script.get_problems_with_status);
client.defineCommand('get_leaderboard' , script.get_leaderboard_with_solved_problem_list);
client.defineCommand('incr_if_exists' , script.increment_if_exists);
client.defineCommand('get_submission' , script.get_submission_from_sorted_set);
client.on("connect", () => {
    console.log("Connected to Redis");
});
client.on("error", (err) => {
    console.error("Redis connection error: ", err);
});
module.exports = {client};