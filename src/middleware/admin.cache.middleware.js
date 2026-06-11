// cache the authentication result for 5 minutes to reduce the load on the authentication service
const { ca } = require("zod/locales");
const { client } = require("../lib/redis.js");
const { redis_controllers } = require("../utilities/redis_controllers/import.js");

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const setAuthCache = async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const cacheKey = `auth:adminInfo:${req.user._id}`;
            client.setex(cacheKey, 3600, JSON.stringify(req.user)).catch((err) => {
                console.error("Error caching auth result:", err);
            });
        }
        originalSend.call(this, body);
    }
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const removeAuthCache = async (req, res, next) => {
    const user_id = req.user._id.toString();
    const originalSend = res.send;
    res.send = function (body) {
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            
            redis_controllers.redis_user.remove_user_authentication_info(user_id).catch((err) => {
                console.error("Error caching auth result:", err);
            });
            
        }
        originalSend.call(this, body);
    }
    return next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const activateAssessmentCache = async(req, res, next) =>{
    const problem_mongoose_object_list = res.locals.problems;
    const assessment_mongoose_object = res.locals.assessment;

    const originalSend = res.send;
    res.send = function(body){
        if(res.statusCode >= 200 && res.statusCode < 300){
            
            (async () => {
                await redis_controllers.redis_assessment.make_assessment_active(problem_mongoose_object_list, assessment_mongoose_object);
            })();
            
        }
        originalSend.call(this, body);
    }
    next();

}

module.exports = {
    setAuthCache,
    removeAuthCache,
    activateAssessmentCache
}
