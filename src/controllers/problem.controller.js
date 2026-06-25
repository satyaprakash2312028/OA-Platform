const {Problem} =               require("../models/problem.model.js");
const {Mcq} =                   require("../models/mcq.model.js");
const {McqSubmission} =         require("../models/mcqSubmission.model.js");
const {Submission} =            require("../models/submission.model.js");
const {Registration} =          require("../models/registration.model.js");
const { Assessment } =          require("../models/assessment.model.js");
const {TeamScore} =             require("../models/teamScore.model.js");
const {Team} =                  require("../models/team.model.js");
const {sendSubmissionToQueue} = require("../utilities/bull_mq_controllers/bull_mq_submission.js");
const {client} =                require("../lib/redis.js");
const { REDIS_CONSTANTS } = require("../utilities/redis_controllers/redis_constants.js");
const {generate_cache_key} = require("../utilities/redis_cache.js");
const pageSize = 25;

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const getCode = async(req, res) => {
    try{
        const {id:submissionId} = req.params;
        const submission = await Submission.findById(submissionId)
        .lean()
        .cache({
            ttl: REDIS_CONSTANTS.DURATION.SIX_HOURS,
            key: generate_cache_key({
                submission: submissionId,
                purpose: REDIS_CONSTANTS.PURPOSE.SUBMISSION_CODE_CACHING
            })
        });
        if(!submission) return res.status(404).json({message: "Submission not found"});
        console.log(submission);
        res.status(200).json(submission);
    }catch(error){
        console.log("Error in getCode controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const submitProblem = async(req, res) => {
    
    console.log(req.body);
    try{
        const user = req.user;
        const {code, language, assessmentID} = req.body;
        const {id: problemId} = req.params;
        const problem = await Problem.findById(problemId)
        .lean()
        .cache(
            {
                ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
                key: generate_cache_key({
                    problem: problemId,
                    purpose: REDIS_CONSTANTS.PURPOSE.PROBLEM_DETAILS_CACHING
                })
            }
        );

        if(!problem) return res.status(404).json({message: "Problem not found"});

        if(assessmentID){
            const assessment = await Assessment.findById(assessmentID)
            .lean()
            .cache({
                ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
                key: generate_cache_key({
                    assessment: assessmentID,
                    purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_DETAILS_CACHING
                })
            });
            if(!assessment)                                     return res.status(404).json({message: "Assessment not found"});
            if(!problem.isPrivate)                              return res.status(400).json({message: "Problem is not part of any assessment"});
            if(assessmentID!= problem.assessment.toString())    return res.status(400).json({message: "Problem is not part of the specified assessment"});
            if(Date.now()<assessment.startTime)                 return res.status(403).json({message: "Assessment hasn't started yet"});
            if(Date.now()>assessment.endTime)                   return res.status(403).json({message: "Assessment has ended"});



            const registration = await Registration.findOne({assessment: assessmentID, user: user._id})
            .lean()
            .cache({
                ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
                key: generate_cache_key({
                    assessment: assessmentID,
                    user: user._id,
                    purpose: REDIS_CONSTANTS.PURPOSE.REGISTRATION_DETAILS_CACHING
                })
            });
            
            if(!registration) return res.status(403).json({message: "You are not registered for this assessment"});
            const newSubmission  = new Submission({
                user: user._id,
                problem: problem._id,
                assessment: assessment._id,
                code,
                language,
                status: "Pending"
            });
            await newSubmission.save();
            console.log(newSubmission);
            const payload = newSubmission.toJSON();
            res.locals = {...payload, code: undefined};
            const resPayload = {...payload};
            
            payload._id = payload._id.toString();
            payload.user = payload.user.toString();
            payload.timeLimit = problem.timeLimit
            payload.memoryLimit = problem.memoryLimit
            payload.problem = payload.problem.toString();
            payload.assessment = payload?.assessment?.toString() || null;
            payload.team = registration.team.toString();

            delete resPayload.code;
            await sendSubmissionToQueue(payload);
            res.status(201).json(resPayload);
        }else{
            if(problem.isPrivate){
                return res.status(403).json({message: "Problem is private and can only be submitted as part of an assessment"});
            }
            const newSubmission = new Submission({
                user: user._id,
                problem: problem._id,
                code,
                language,
                status: "Pending",
            });
            await newSubmission.save();
            console.log(newSubmission);
            const payload = newSubmission.toJSON();
            const resPayload = {...payload};
            res.locals = {...payload, code: undefined};
            
            payload._id = payload._id.toString();
            payload.user = payload.user.toString();
            payload.timeLimit = problem.timeLimit
            payload.memoryLimit = problem.memoryLimit
            payload.problem = payload.problem.toString();
            payload.assessment = payload?.assessment?.toString() || null;

            delete resPayload.code;
            await sendSubmissionToQueue(payload);
            res.status(201).json(resPayload);
        }
    }catch(error){
        console.log("Error in submit controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

// Endpoint for online judge Code submission

// 'Pending', // Waiting in the queue
// 'Judging', // Actively being processed by a worker
// 'Accepted', // Passed all test cases
// 'Wrong Answer',
// 'Time Limit Exceeded',
// 'Memory Limit Exceeded',
// 'Compilation Error',
// 'Runtime Error', // e.g., segfault, unhandled exception
// 'Internal Error' // Error within the judge system itself
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->



// const submitMcq = async(req, res) => {
//     try{
//         const user = req.user;
//         const {mcqId, optionSelected} = req.body;
//         const mcq = await Mcq.findById(mcqId);
//         if(!mcq) return res.status(404).json({message: "MCQ not found"});   
//         if(optionSelected<0 || optionSelected>=mcq.options.length){
//             return res.status(400).json({message: "Invalid option selected"});
//         }
        
//         if(!mcq.assessment) {
//             return res.status(400).json({message: "MCQ is not part of any assessment"});
//         }


//         const assessment =      await Assessment.findById(mcq.assessment);
//         if(!assessment)         return res.status(404).json({message: "Assessment not found"});


//         const registration =    await Registration.findOne({assessment: mcq.assessment, user: user._id});
//         if(!registration)       return res.status(403).json({message: "You are not registered for this assessment"});


//         if(Date.now()<assessment.startTime)     return res.status(403).json({message: "Assessment hasn't started yet"});
//         if(Date.now()>assessment.endTime)       return res.status(403).json({message: "Assessment has ended"});


        
//         const mcqSubmission = new McqSubmission({
//             user: user._id,
//             mcq: mcq._id,
//             optionSelected,
//             isCorrect: mcq.correctAnswerIndex===optionSelected
//         });
//         if(mcqSubmission) await mcqSubmission.save();
//         else return res.status(500).json({message: "Could not create MCQ submission"}); 
//         if(mcqSubmission.isCorrect){
//             const previousSubmissions = await McqSubmission.findOne({
//                 user: user._id,
//                 mcq: mcq._id,
//                 isCorrect: true,
//                 _id: { $ne: mcqSubmission._id } // Exclude current submission
//             });

//             if(!previousSubmissions) await TeamScore.findOneAndUpdate({team: registration.team, assessment: mcq.assessment}, {
//                 $inc: {score: 1}
//             });
//         }
//         res.status(201).json({message: "MCQ Submission received", mcqSubmissionId: mcqSubmission._id});
//     }catch(error){
//         console.log("Error in MCQ submit controller.", error);
//         return res.status(500).json({ message: "Internal Server Error" });
//     }
// }
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const getProblem = async (req, res) => {
    try{
        const {id:problemId} = req.params;
        const problem = await Problem.findById(problemId)
        .lean()
        .cache({
            ttl:REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                    problem: problemId,
                    purpose: REDIS_CONSTANTS.PURPOSE.PROBLEM_DETAILS_CACHING
                }),
        });
        if(!problem) return res.status(400).json({message: "Problem isn't available"});

        return res.status(200).json({
            problemId,
            name: problem.name,
            timeLimit: problem.timeLimit,
            memoryLimit: problem.memoryLimit,
            htmlDescription: problem.htmlDescription,
            interactive: !(!(problem.interactor)),
            assessment: problem.assessment,
        });
    }catch(error){
        console.log("Error in getProblem controller", error);
        return res.status(500).json({message: "Internal Server Error"});
    }
}
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
// const getAllProblems = async(req, res) => {
//     try{
//         const user = req.user;
//         let problems = null;
//         if(user.isAdmin){
//             problems = await Problem.find({});
//         }else{
//             problems = await Problem.find({
//                 isPrivate: false
//             });
//         }
//         if(!problems) throw new Error("Internal Server Error");
//         res.status(200).json({problems: problems});
//     }catch(error){
//         console.log("Error in problem controller", error);
//         res.status(500).json({message: "Internal Server Error"});
//     }
// }
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->


const getOAssessments = async(req, res) => {
    try{
        const user = req.user;
        const {assessmentId} = req.params;
        if(!assessmentId) return res.status(400).json({message: "Assessment ID is required"});
        const assessment = await Assessment.findOne({_id: assessmentId})
        .lean()
        .cache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                assessment: assessmentId,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_DETAILS_CACHING
            })
        });
        console.log('problemproblemproblemproblemproblemproblemproblemproblemproblemproblem')
        console.log(assessmentId)
        if(!assessment) return res.status(400).json({message: "No such Assessment found"});
        if(new Date().getTime() < new Date(assessment.startTime).getTime()) return res.status(423).json({message: "Assessment hasn't started yet", startTime: assessment.startTime, endTime:  assessment.endTime});
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
        
        res.status(200).json({
            problems,
            startTime: assessment.startTime,
            endTime: assessment.endTime
        });
    }catch(error){
        console.log("Error in getOAssessments controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const getSubmissions = async(req, res) => {
    try{
        let pageNumber = Number(req.params.pageNumber) || 2;
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
        console.log(documentSize);
        const totalPages = Math.ceil(documentSize / pageSize);
        pageNumber = Math.min(pageNumber, totalPages);
        pageNumber = Math.max(pageNumber, 1);
        const submissions = await Submission.find({ user: user._id })
        .sort({ createdAt: -1 })
        .select("-code")
        .skip(pageSize * (pageNumber - 1))
        .limit(pageSize)
        .lean()
        .hashCache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                user: user._id,
                purpose: REDIS_CONSTANTS.PURPOSE.USER_SUBMISSION_PAGES_CACHING
            })
        });
        res.locals = {submissions, totalDocuments: documentSize, pageNumber};
        console.log(submissions);
        res.status(200).json({submissions, totalPages, pageNumber});
    }catch(error){
        console.log("Error in getSubmissions controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const allProblems = async(req, res)=>{
    
    try{
        const user = req.user;
        let query = {};
        if(!user.isAdmin) query.isPrivate = false;
        let pageNumber = Number(req.params.pageNumber) || 1;
        const documentSize = await Problem.countDocuments(query)
        .lean()
        .cache({
            ttl: -1,
            key: generate_cache_key({
                problem: REDIS_CONSTANTS.MANY_ENTITIES,
                purpose: user.isAdmin?REDIS_CONSTANTS.PURPOSE.PRIVATE_PROBLEM_PAGES_COUNT_CACHING:REDIS_CONSTANTS.PURPOSE.PUBLIC_PROBLEM_PAGES_COUNT_CACHING
            })
        });
        console.log(documentSize)
        const totalPages = Math.ceil(documentSize / pageSize);
        pageNumber = Math.min(pageNumber, totalPages);
        pageNumber = Math.max(pageNumber, 1);
        const problems = await Problem.find(query)
        .sort({ createdAt: -1 })
        .select("-htmlDescription")
        .skip(pageSize * (pageNumber - 1))
        .limit(pageSize)
        .lean()
        .hashCache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                problem: REDIS_CONSTANTS.MANY_ENTITIES,
                purpose: (user.isAdmin)?REDIS_CONSTANTS.PURPOSE.PRIVATE_PROBLEM_PAGES_CACHING:REDIS_CONSTANTS.PURPOSE.PUBLIC_PROBLEM_PAGES_CACHING,
             }),
        });
        res.locals = {
            problems, 
            totalDocuments: documentSize, 
            pageNumber
        }
        res.status(200).json({
            problems, 
            totalPages, 
            pageNumber
        });
    }catch(error){
        console.log("Error in allProblems controller ", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

module.exports = {
    submitProblem,
    getOAssessments,
    getSubmissions,
    getProblem,
    allProblems,
    getCode
};