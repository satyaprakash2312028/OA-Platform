const {client} = require("../lib/redis.js");
const { Problem } = require("../models/problem.model.js");
const { Registration } = require("../models/registration.model.js");
const {Submission} = require("../models/submission.model.js");
const {redis_controllers} = require("../utilities/redis_controllers/import.js");

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

// todo: add total pages somehow
const cachedSubmissionPages = async (req, res, next) => {
    if(Number(req.params.pageNumber) > 1){
        return next();
    }
    try{
        const page_number = Number(req.params.pageNumber)||1;
        const cached_data = await redis_controllers.redis_user.get_user_submissions(req.user._id.toString(), page_number);
        if(cached_data){
            return res.status(200).json(cached_data);
        }

    }catch(error){
        console.error("Error fetching cached submission pages:", error);
        return next();
    }

    const originalSend = res.send;
    res.send = function (body) {

        originalSend.call(this, body);
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            redis_controllers.redis_user.save_user_submissions(req.user._id.toString(), res.locals.submissions, res.locals.totalDocuments).catch((error) => {
                console.log("Error while saving user submissions: "+ error);
            });
        }
    }
    next();

}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->


const cachedAssessmentPages = async (req, res, next) => {
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

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
const cachedProblemSet = async (req, res, next) => {

    const page_number = Number(req.params.pageNumber)||1;
    if(page_number > 1){
        return next();
    }

    const isAdmin = req.user.isAdmin;
    if(isAdmin){
        try{
            const cached_data = await redis_controllers.redis_problem.get_problems_from_private_set(page_number, req.user._id.toString());
            
            if(cached_data){
                return res.status(200).json(cached_data);
            }
            console.log('// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->')
        }catch(error){
            console.error("Error fetching cached problem set:", error);
            return next();
        }
        const originalSend = res.send;
        res.send = function (body) {
            originalSend.call(this, body);
            if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
                redis_controllers.redis_problem.save_problems_to_private_set(res.locals.problems, res.locals.totalDocuments).catch((error) => {
                    console.log("Error while saving problemset: "+ error);
                });
            }
        }
        next();
    }else{
        console.log("Reached Here");
        try{
            const cached_data = await redis_controllers.redis_problem.get_problems_from_public_set(page_number, req.user._id.toString());
            console.log(cached_data);
            if(cached_data){
                return res.status(200).json(cached_data);
            }
        }catch(error){
            console.error("Error fetching cached problem set:", error);
            return next();
        }
        const originalSend = res.send;
        res.send = function (body) {
            originalSend.call(this, body);
            console.log(res.statusCode);
            if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
                console.log("hiyihi");
                redis_controllers.redis_problem.save_problems_to_public_set(res.locals.problems, res.locals.totalDocuments).catch((error) => {
                    console.log("Error while saving problemset: "+ error);
                });
            }
        }
        next();
        console.log("exited Here");
    }
}
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const addProblemtoCache = async(req, res, next) => {
    const originalSend = res.send;
    const user = req.user;
    res.send = function (body) {
        originalSend.call(this, body);
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            if(req.isPrivate) redis_controllers.redis_problem.save_problem_to_private_set(res.locals).catch((error) => {
                console.log("Error while adding problem to cache: " + error);
            });
            else redis_controllers.redis_problem.save_problem_to_public_set(res.locals).catch((error) => {
                console.log("Error while adding problem to cache: " + error);
            });
        }
    }
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const addAssessmenttoCache = async(req, res, next) => {
    const originalSend = res.send;
    const user = req.user;
    res.send = function (body) {
        originalSend.call(this, body);
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304) {
            redis_controllers.redis_assessment.save_assessment_info_to_sorted_set(res.locals).catch((error) => {
                console.log("Error while adding assessment to cache: "+ error);
            });
        }
    }
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const cacheNewSubmission = async (req, res, next) => {
    const user = req.user;
    const {code, language, assessmentID} = req.body;
    const {id: problemId} = req.params;
    const originalSend = res.send;
    res.send = function (body) {
        originalSend.call(this, body);
        if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304){
            redis_controllers.redis_user.save_user_submission(user._id.toString(), res.locals).catch((error) => {
                console.log("Error while adding new submission to cache: "+ error);
            });
        }
    }
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const hydrateWithSolvedStatus = async(req,res,next) => {
    const user = req.user;
    try{
        const originalSend = res.send;
        res.send = function(body) {
            body = JSON.parse(body);
            if ((res.statusCode >= 200 && res.statusCode < 300)||res.statusCode === 304){
                (async () => {
                    try {
                        const id_array = body.problems.map(p => p._id.toString());
                        const result = await redis_controllers.redis_user.check_problems_in_solved_bitmap(req.user._id, id_array);
                        for (let i = 0; i < body.problems.length; i++) {
                            body.problems[i].isSolved = (result[i] === 1); 
                        }
                        originalSend.call(res, JSON.stringify(body));
                    } catch (error) {
                        console.error("Error while hydrating all problems body with is solved data: ", error);
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

module.exports = {
    cachedSubmissionPages,
    cachedAssessmentPages,
    cachedProblemSet,
    addProblemtoCache,
    addAssessmenttoCache,
    cacheNewSubmission,
    hydrateWithSolvedStatus
}


