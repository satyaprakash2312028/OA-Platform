const {Problem} = require("../models/problem.model.js");
const {Mcq} = require("../models/mcq.model.js");
const {McqSubmission} = require("../models/mcqSubmission.model.js");
const {Submission} = require("../models/submission.model.js");
const {Registration} = require("../models/registration.model.js");
const { Assessment } = require("../models/assessment.model.js");
const {TeamScore} = require("../models/teamScore.model.js");
const {Team} = require("../models/team.model.js");

const {generateAdminToken} = require("../lib/utils.js");
const { User } = require("../models/user.model.js");
const { Test } = require("../models/test.model.js");
const bcrypt = require("bcryptjs");
const { REDIS_CONSTANTS } = require("../utilities/redis_controllers/redis_constants.js");
const { generate_cache_key } = require("../utilities/redis_cache.js");
const pageSize = 25;

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
const getContests = async (req, res) =>{
    try{
        const user = req.user;
        let pageNumber = Number(req.params.pageNumber) || 2;
        const documentSize = await Assessment.countDocuments()
        .lean()
        .cache({
            ttl: -1,
            key: generate_cache_key({
                assessment: REDIS_CONSTANTS.MANY_ENTITIES,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_PAGES_COUNT_CACHING
            })
        });
        const totalPages = Math.ceil(documentSize / pageSize);
        pageNumber = Math.min(pageNumber, totalPages);
        pageNumber = Math.max(pageNumber, 1);
        const assessments = await Assessment.find({})
        .sort({ startTime: -1 })
        .skip(pageSize * (pageNumber - 1))
        .limit(pageSize)
        .lean()
        .hashCache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                assessment: REDIS_CONSTANTS.MANY_ENTITIES,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_PAGES_CACHING
            })
        });
        res.locals = {
            assessments,
            totalDocuments: documentSize,
            pageNumber
        }

        res.status(200).json({
            assessments,
            totalPages,
            pageNumber
        });
    }catch(error){
        console.log("Error in getContests controller ", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const allOATakenPartInCount = async(req, res)=>{
    try{
        const user = req.user;

        const result = await Registration.distinct('assessment', {
            user: user._id,
            isPending: false
        }).lean();

        res.locals.assessmentList = result;
        res.status(200).json({count: result.length});
    }catch(error){
        console.log("Error in dashboard controller");
        res.status(500).json({message:"Internal Server Error"});
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const problemSolved = async(req, res)=>{
    try{
        const user = req.user;
        const result = await Submission.distinct('problem', {
            user: user._id,
            status: 'Accepted'
        }).lean();

        res.locals.problemList = result;
        res.status(200).json({problemSolved:result.length});
    }catch(erorr){
        console.log("Error in problem solved controller");
        res.status(500).json({message:"Internal Server Error....."});
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const recentSubmissions = async(req, res) =>{
    try{
        const user = req.user;
        const documentSize = await Submission.countDocuments({user: user._id})
        .lean()
        .cache(
            {
                ttl: -1,
                key: generate_cache_key({
                    user: user._id,
                    purpose: REDIS_CONSTANTS.PURPOSE.USER_SUBMISSION_PAGES_COUNT_CACHING
                })
            }
        );
        const submissions = await Submission.find({user:user._id})
        .sort({createdAt:-1})
        .select("-code")
        .limit(25)
        .lean();
        res.locals.submissionList = [...submissions];
        res.locals.totalDocuments = documentSize;
        submissions.splice(10, Infinity);
        res.status(200).json({submissions:submissions});
    }catch(error){
        console.log("Error in recentSubmissions controller ", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const lastAcceptedSubmission = async(req, res) => {
    try{
        const user = req.user;
        const submission = await Submission.find({user:user._id, status:"Accepted"})
        .sort({createdAt:-1})
        .limit(1)
        .lean();
        if(submission.length===0){
            return res.status(200).json({submission:null});
        }
        res.status(200).json({submission:submission[0]});
    }catch(error){
        console.log("Error in lastAcceptedSubmission controller ", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->   
const getLeaderboard = async(req, res) => {
    const user = req.user;
    const assessmentId = req.params.assessmentId;
    const pageNumber =  req.params.pageNumber;
    if(pageNumber<1)  return res.status(400).json({message: 'Invalid page number'});
    try{
        const assessment = await Assessment.findOne({_id: assessmentId})
        .lean()
        .cache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                assessment: assessmentId,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_DETAILS_CACHING
            })
        });
        if(!assessment) return res.status(400).json({message: 'Invalid assessment id'});

        const registration = await Registration.findOne({assessment: assessmentId, user: user._id})
        .lean()
        .cache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                assessment: assessmentId,
                user: user._id,
                purpose: REDIS_CONSTANTS.PURPOSE.REGISTRATION_DETAILS_CACHING
            })
        });
        if(!registration) return res.status(403).json({message: "You are not registered for this assessment"});
        const problems = await Problem.find({assessment: assessmentId})
        .sort({createdAt:-1})
        .select("-htmlDescription")
        .lean()
        .cache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                assessment: assessmentId,
                purpose: REDIS_CONSTANTS.PURPOSE.PROBLEMS_OF_ASSESSMENT_CACHING
            })
        });
        res.locals.registration = registration;
        const problemIdList = problems.map(item => item._id.toString());

        res.status(200).json({
            problems: problemIdList
        });

        
    }catch(error){
        console.log("Error in get Leaderboard controller: "+ error);
        res.status(400).json({message: 'Internal Server Error'});
    }
}
module.exports = {
    getContests,
    problemSolved,
    allOATakenPartInCount,
    recentSubmissions,
    lastAcceptedSubmission,
    getLeaderboard
}