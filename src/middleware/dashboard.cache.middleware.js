const {client} = require("../lib/redis.js");
const {redis_controllers} = require("../utilities/redis_controllers/import.js");

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const cacheContestPages = async (req, res, next) => {
    const page_number = Number(req.params.pageNumber)||1;
    if(page_number > 1){
        return next();
    }
    try{
        const cached_data = await redis_controllers.redis_assessment.get_assessment_info_from_sorted_set_by_page_number(page_number, req.user._id.toString());
        if(cached_data){
            return res.status(200).json(cached_data);
        }
    }catch(error){
        console.error("Error fetching cached assessment info:", error);
        return next();
    }
    const originalSend = res.send;
    res.send = function (body) {
        originalSend.call(this, body);
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {

            redis_controllers.redis_assessment.save_assessment_array_to_sorted_set(res.locals.assessments, res.locals.totalDocuments).catch((error) => {
                console.log("Error while saving contests: "+ error);
            });
            
        }
    }
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
// to be fixed, todo
const cacheProblemSolvedCount = async (req, res, next) => {
    const user = req.user;
    try{
        const cached_data = await redis_controllers.redis_user.get_problem_solved_count(user._id.toString());
        if(cached_data !== null){
            return res.status(200).json(cached_data);
        }
    }catch(error){
        console.error("Error fetching cached problem solved count:", error);
        return next();
    }
    const originalSend = res.send;
    res.send = function (body) {
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            redis_controllers.redis_user.save_problem_to_solved_bitmap(user._id.toString(), res.locals.problemList).catch((error) => {
                console.log("Error while caching solved problems: "+ error);
            })
        }
        originalSend.call(this, body);
    };
    next();
}
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

// to be fixed, todo
const cacheContestCount = async (req, res, next) => {
    const user = req.user;
    try{
        const cached_data = await redis_controllers.redis_user.get_user_contest_count(user._id.toString());
        if(cached_data !== null){
            return res.status(200).json(cached_data);
        }
    }catch(error){
        console.error("Error fetching cached contest count:", error);
        return next();
    }
    const originalSend = res.send;
    res.send = function (body) {
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            redis_controllers.redis_user.save_to_user_given_contest_bitmap(user._id.toString(), res.locals.assessmentList)
            .catch((error) => {
                console.log("Error while caching contest to given bitmap: "+ error);
            });
        }
        originalSend.call(this, body);
    };
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const cacheRecentSubmissions = async (req, res, next) => {
    const user = req.user;
    try{
        const cached_data = await redis_controllers.redis_user.get_user_recent_submissions(user._id);
        console.log(cached_data);
        if(cached_data){
            return res.status(200).json(cached_data);
        }
    }catch(error){
        console.error("Error fetching cached recent submissions:", error);
        return next();
    }

    const originalSend = res.send;
    res.send = function (body) {
        originalSend.call(this, body);
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            console.log(res.locals.totalDocuments);
            redis_controllers.redis_user.save_user_submissions(user._id.toString(), res.locals.submissionList, res.locals.totalDocuments).catch((error) => {
                console.log("Error occoured while caching recent submission: " + error);
            });
        }
    };
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
const cacheLastAcceptedSubmission = async (req, res, next) => {
    const user = req.user;
    try{
        const cached_data = await redis_controllers.redis_user.get_last_accepted_submission(user._id.toString());
        if(cached_data){
            return res.status(200).json(cached_data);
        }
    }catch(error){
        console.error("Error fetching cached last accepted submission:", error);
        return next();
    }
    const originalSend = res.send;
    res.send = function (body) {
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            redis_controllers.redis_user.save_last_accepted_submission(user._id.toString(), body.submission).catch((error) => {
                console.log("Error while caching last accepted submission: "+ error);
            });
        }
        originalSend.call(this, body);
    };
    next();
}
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const hydrateWithRegisteredStatus = async(req,res,next) => {
    const user = req.user;
    try{
        const originalSend = res.send;
        res.send = function(body) {
            body = JSON.parse(body);
            if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304){
                (async () => {
                    try {
                        const id_array = body.assessments.map(p => p._id.toString());

                        const result = await redis_controllers.redis_user.check_contests_in_given_bitmap(req.user._id.toString(), id_array);
                        for (let i = 0; i < body.assessments.length; i++) {
                            body.assessments[i].isSolved = (result[i] === 1); 
                        }
                        originalSend.call(res, JSON.stringify(body));

                    } catch (error) {
                        console.error("Error while hydrating all contest body with is registered data: ", error);
                        originalSend.call(res, JSON.stringify(body));
                    }
                })();
                return;
            }
            originalSend.call(this, JSON.stringify(body));
        }
        next();
    }catch(error){
        console.log("Error while hydrating all problem response: " + error);
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const hydrateLeaderboad = async(req, res, next) => {

    const originalSend = res.send;
    res.send = function(body){
        body = JSON.parse(body);
        if((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304){
            const pageNumber = Number(req.params.pageNumber) || 1;
            const assessmentId = req.params.assessmentId;
            
            (async () => {
                try{
                    const data = await redis_controllers.redis_leaderboard.get_leaderboard_by_page_number(assessmentId, pageNumber, res.locals.registration.team.toString());
                    body = {
                        ...body,
                        ...data
                    }
                    originalSend.call(res, JSON.stringify(body));
                }catch(error){
                    console.error("Error while hydrating leaderboard ", error);
                    originalSend.call(res, JSON.stringify(body));
                }
            })();
            return;
        }
        originalSend.call(this, JSON.stringify(body));
    }
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
module.exports = {
    cacheContestPages,
    cacheProblemSolvedCount,
    cacheContestCount,
    cacheRecentSubmissions, 
    cacheLastAcceptedSubmission,
    hydrateWithRegisteredStatus,
    hydrateLeaderboad

}