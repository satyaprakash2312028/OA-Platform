

const redis_controllers = {
    redis_assessment: require("./redis_assessment.js").redis_assessment,
    redis_problem: require("./redis_problem.js").redis_problem,
    redis_user: require("./redis_user.js").redis_user,
    redis_leaderboard: require("./redis_leaderboard.js").redis_leaderboard,
    redis_registration: require("./redis_registration.js").redis_registration
}

module.exports = {redis_controllers};