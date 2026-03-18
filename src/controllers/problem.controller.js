const {Problem} = require("../models/problem.model.js");
const {Mcq} = require("../models/mcq.model.js");
const {McqSubmission} = require("../models/mcqSubmission.model.js");
const {Submission} = require("../models/submission.model.js");
const {Registration} = require("../models/registration.model.js");
const { Assessment } = require("../models/assessment.model.js");
const {TeamScore} = require("../models/teamScore.model.js");
const {Team} = require("../models/team.model.js");
const {sendSubmissionToQueue} = require("../lib/queue.js");
const {client} = require("../lib/redis.js");
const pageSize = 25;
const getCode = async(req, res) => {
    try{
        const {id:submissionId} = req.params;
        if(!submissionId) return res.status(400).json({message: "Submission ID is required"});
        const submission = await Submission.findById(submissionId);
        if(!submission) return res.status(404).json({message: "Submission not found"});
        res.status(200).json(submission);
    }catch(error){
        console.log("Error in getCode controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
const submitProblem = async(req, res) => {
    try{
        const user = req.user;
        const {code, language, assessmentID} = req.body;
        const {id: problemId} = req.params;
        if(code.trim().length<=0) res.status(400).json({message: "Code cannot be empty"});
        if(language.trim().length<=0) res.status(400).json({message: "Language cannot be empty"});
        if(language!="python" && language!="javascript" && language!="cpp"&& language!="java"){
            return res.status(400).json({message: "Unsupported language"});
        }
        const problem = await Problem.findById(problemId);
        console.log(problemId);
        if(!problem) return res.status(404).json({message: "Problem not found"});
        if(assessmentID){
            const assessment = await Assessment.findById(assessmentID);
            if(!assessment) return res.status(404).json({message: "Assessment not found"});
            if(!problem.isPrivate) return res.status(400).json({message: "Problem is not part of any assessment"});
            if(assessmentID!= problem.assessment.toString()){
                return res.status(400).json({message: "Problem is not part of the specified assessment"});
            }
            const registration = await Registration.findOne({assessment: assessmentID, user: user._id});
            if(!registration) return res.status(403).json({message: "You are not registered for this assessment"});
            if(Date.now()<assessment.startTime) return res.status(403).json({message: "Assessment hasn't started yet"});
            if(Date.now()>assessment.endTime) return res.status(403).json({message: "Assessment has ended"});
            const newSubmission  = new Submission({
                user: user._id,
                problem: problem._id,
                assesment: assessment._id,
                code,
                language,
                status: "Pending"
            });
            if(newSubmission) await newSubmission.save();
            else return res.status(500).json({message: "Could not create submission"});
            const payload = {
                submissionId: newSubmission._id.toString(),
                problem: newSubmission.problem.toString(),
                code: newSubmission.code,
                language: newSubmission.language,
                userId: newSubmission.user.toString(),
                timeLimit: problem.timeLimit,
                memoryLimit: problem.memoryLimit
            };
            await sendSubmissionToQueue(payload);
            return  res.status(201).json({message: "Submission received", submissionId: newSubmission._id});
        }else{
            if(problem.isPrivate){
                return res.status(403).json({message: "Problem is private and can only be submitted as part of an assessment"});
            }
            const submission = new Submission({
                user: user._id,
                problem: problem._id,
                code,
                language,
                status: "Pending",
            });
            if(submission) await submission.save();
            else return res.status(500).json({message: "Could not create submission"});
            // convert ._id to string before logging
            console.log("Submission created with ID:", submission._id.toString());
            const payload = {
                submissionId: submission._id.toString(),
                problem: submission.problem.toString(),
                code: submission.code,
                language: submission.language,
                userId: submission.user.toString(),
                timeLimit: problem.timeLimit,
                memoryLimit: problem.memoryLimit
            };
            await sendSubmissionToQueue(payload);
            res.status(201).json({message: "Submission received", submissionId: submission._id});
        }
    }catch(error){
        console.log("Error in submit controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

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




const submitMcq = async(req, res) => {
    try{
        const user = req.user;
        const {mcqId, optionSelected} = req.body;
        const mcq = await Mcq.findById(mcqId);
        if(!mcq) return res.status(404).json({message: "MCQ not found"});   
        if(optionSelected<0 || optionSelected>=mcq.options.length){
            return res.status(400).json({message: "Invalid option selected"});
        }
        
        if(!mcq.assessment) {
            return res.status(400).json({message: "MCQ is not part of any assessment"});
        }
        const assessment = await Assessment.findById(mcq.assessment);
        if(!assessment) return res.status(404).json({message: "Assessment not found"});
        const registration = await Registration.findOne({assessment: mcq.assessment, user: user._id});
        if(!registration) return res.status(403).json({message: "You are not registered for this assessment"});
        if(Date.now()<assessment.startTime) return res.status(403).json({message: "Assessment hasn't started yet"});
        if(Date.now()>assessment.endTime) return res.status(403).json({message: "Assessment has ended"});
        const mcqSubmission = new McqSubmission({
            user: user._id,
            mcq: mcq._id,
            optionSelected,
            isCorrect: mcq.correctAnswerIndex===optionSelected
        });
        if(mcqSubmission) await mcqSubmission.save();
        else return res.status(500).json({message: "Could not create MCQ submission"}); 
        if(mcqSubmission.isCorrect){
            const previousSubmissions = await McqSubmission.findOne({
                user: user._id,
                mcq: mcq._id,
                isCorrect: true,
                _id: { $ne: mcqSubmission._id } // Exclude current submission
            });

            if(!previousSubmissions) await TeamScore.findOneAndUpdate({team: registration.team, assessment: mcq.assessment}, {
                $inc: {score: 1}
            });
        }
        res.status(201).json({message: "MCQ Submission received", mcqSubmissionId: mcqSubmission._id});
    }catch(error){
        console.log("Error in MCQ submit controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

const getProblem = async (req, res) => {
    console.log("trigerred");
    try{
        const {id:problemId} = req.params;
        if(!problemId) return res.status(400).json({message: "Problem Id isn't provided"});
        const problem = await Problem.findById(problemId);
        if(!problem) return res.status(400).json({message: "Problem isn't available"});

        // Determine if the current user has solved this problem (if logged in)
        let isSolved = false;
        if (req.user) {
            const submission = await Submission.findOne({ user: req.user._id, problem: problemId, status: "Accepted" });
            if (submission) isSolved = true;
        }

        return res.status(200).json({
            problemId,
            name: problem.name,
            timeLimit: problem.timeLimit,
            memoryLimit: problem.memoryLimit,
            htmlDescription: problem.htmlDescription,
            interactive: !(!(problem.interactor)),
            assessment: problem.assessment,
            isSolved
        });
    }catch(error){
        console.log("Error in getProblem controller", error);
        return res.status(500).json({message: "Internal Server Error"});
    }
}

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

const getOAssessments = async(req, res) => {
    try{
        const user = req.user;
        const {assessmentId} = req.params;
        if(!assessmentId) return res.status(400).json({message: "Assessment ID is required"});
        const assessment = await Assessment.findOne({_id: assessmentId});
        if(!assessment) return res.status(400).json({message: "No such Assessment found"});
        const registration = await Registration.findOne({assessment: assessmentId, user: user._id});
        if(!registration) return res.status(403).json({message: "You are not registered for this assessment"});
        if(Date.now() < assessment.startTime) return res.status(423).json({message: "Assessment hasn't started yet", startTime: assessment.startTime, endTime:  assessment.endTime});

        const problems = await Problem.find({assessment: assessmentId}).sort({createdAt:-1}).select("problemId name timeLimit memoryLimit").cache({key: `assessment:${assessmentId}`, ttl: 30000});
        console.log(problems);
        const problemIds = problems.map(p => p._id);

        // 3. Find which of *these* problems have an 'Accepted' submission by the user
        // (Assuming you have req.user._id from your auth middleware)
        const solvedSubmissions = await Submission.find({
            user: user._id,           // The current user
            problem: { $in: problemIds }, // Only look for problems currently visible
            status: "Accepted"            // Only count if they actually solved it
        }).select("problem");

        // 4. Create a Set of solved problem IDs for O(1) instant lookup
        const solvedSet = new Set(solvedSubmissions.map(s => s.problem.toString()));

        // 5. Add an 'isSolved' flag to each problem object
        const problemsWithStatus = problems.map(p => {
            return {
                ...p.toObject(), // Convert Mongoose document to plain JS object
                isSolved: solvedSet.has(p._id.toString())
            };
        });

        res.status(200).json({
            problems: problemsWithStatus,
            startTime: assessment.startTime,
            endTime: assessment.endTime
        });
        // const mcqs = await Mcq.find({assessment: assessmentId});
        // res.status(200).json({problems});
    }catch(error){
        console.log("Error in getOAssessments controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

const getSubmissions = async(req, res) => {
    // try{
    //     const user = req.user;
    //     const {assessmentId} = req.body;
    //     if(assessmentId){
    //         const submissions = await Submission.find({user: user._id, assesment: assessmentId});
    //         res.status(200).json({submissions});
    //     }else{
    //         const submissions = await Submission.find({user: user._id});
    //         res.status(200).json({submissions});
    //     }
    // }catch(error){
    //     console.log("Error in getSubmissions controller.", error);
    //     return res.status(500).json({ message: "Internal Server Error" });
    // }
    try{
        let pageNumber = Number(req.params.pageNumber) || 1;
        const user = req.user;
        const documentSize = await Submission.countDocuments({user: user._id});
        const totalPages = Math.ceil(documentSize / pageSize);
        pageNumber = Math.min(pageNumber, totalPages);
        pageNumber = Math.max(pageNumber, 1);
        const submissions = await Submission.find({ user: user })
        .sort({ createdAt: -1 })
        .select("language status executionTime memoryUsed problem")
        .skip(pageSize * (pageNumber - 1))
        .limit(pageSize);
        res.status(200).json({submissions, totalPages, pageNumber});
    }catch(error){
        console.log("Error in getSubmissions controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

const allProblems = async(req, res)=>{

    try{
        const user = req.user;
        let query = {};
        if(!user.isAdmin) query.isPrivate = false;
        let pageNumber = Number(req.params.pageNumber) || 1;
        const documentSize = await Problem.countDocuments(query);
        const totalPages = Math.ceil(documentSize / pageSize);
        pageNumber = Math.min(pageNumber, totalPages);
        pageNumber = Math.max(pageNumber, 1);
        const problems = await Problem.find(query).sort({ createdAt: -1 }).select("name problemId timeLimit memoryLimit").skip(pageSize * (pageNumber - 1)).limit(pageSize).cache({key: `problem`, ttl: 30000});
        const problemIds = problems.map(p => p._id.toString());

        // 3. Find which of *these* problems have an 'Accepted' submission by the user using redis hashset
        const result = await client.smismember(`solved:${user._id}`, problemIds); // return an array of 0s and 1s corresponding to whether each problemId is in the solved set for the user


        // 5. Add an 'isSolved' flag to each problem object
        const problemsWithStatus = problems.map((p, index) => {
            return {
                ...p.toObject(), // Convert Mongoose document to plain JS object
                isSolved: result[index] === 1
            };
        });

        res.status(200).json({
            problems: problemsWithStatus, 
            totalPages, 
            pageNumber
        });
    }catch(error){
        console.log("Error in allProblems controller ", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}

module.exports = {
    submitProblem,
    submitMcq,
    getOAssessments,
    getSubmissions,
    getProblem,
    allProblems,
    getCode
};