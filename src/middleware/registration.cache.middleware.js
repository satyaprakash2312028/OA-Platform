const {client} = require("../lib/redis.js");
const {Submission} = require("../models/submission.model.js");
const {redis_controllers} = require("../utilities/redis_controllers/import.js");

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const removeCachedRegistrationDBCalls = async (req, res, next) => {
    const user = req.user;
    const {teamName, assessmentId, existingTeamID} = req.body;
    const originalSend = res.json;
    res.json = function (body) {
        originalSend.call(this, body);
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            redis_controllers.redis_registration.post_registration_redis_interaction(user._id.toString(), assessmentId, teamName, res.locals.team._id.toString()).catch((error) => {
                console.log("Error in post registration redis interaction." + error);
            });
        }
    }
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

module.exports = {
    removeCachedRegistrationDBCalls
}


