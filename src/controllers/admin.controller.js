const {Problem} = require("../models/problem.model.js");
const {Mcq} = require("../models/mcq.model.js");
const {McqSubmission} = require("../models/mcqSubmission.model.js");
const {Submission} = require("../models/submission.model.js");
const {Registration} = require("../models/registration.model.js");
const { Assessment } = require("../models/assessment.model.js");
const {TeamScore} = require("../models/teamScore.model.js");
const {Team} = require("../models/team.model.js");
const {sendSubmissionToQueue} = require("../lib/queue.js");
const {generateAdminToken} = require("../lib/utils.js");
const { User } = require("../models/user.model.js");
const { Test } = require("../models/test.model.js");
const bcrypt = require("bcryptjs");

const {createAssessmentSchema} = require("../validators/assessment.schema.js");
const { REDIS_CONSTANTS } = require("../utilities/redis_controllers/redis_constants.js");
const pageSize = 25;
//<---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
// const rejudge = async(req, res) =>{
//     try{
//         const problemId = req.params.id;
//         const submissions = await Submission.find({problem: problemId});
//         for(const submission of submissions){
//             submission.status = "Pending";
//             await submission.save();
//             await sendSubmissionToQueue(submission);
//         }
//         res.status(200).json({message: "Rejudge initiated for all submissions of the problem."});
//     }catch(error){
//         console.log("Error in rejudge controller.", error);
//         return res.status(500).json({ message: "Internal Server Error" });
//     }
// }

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const login = async (req, res) => {
    try{
        const { email, password } = req.body;
        const user = await User.findOne({ email }).lean();
        if (!user || !user.isAdmin || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ messsage: "Invalid login credentials" });
        res.cookie("jwt", "", {
            maxAge: 0,
            path: '/',        // <-- Add this
            secure: true,     // <-- Add this
            sameSite: 'None', // <-- Add this
            httpOnly: true    // <-- Good practice to include this too
        });
        generateAdminToken(user._id.toString(), res);
        req.user = user; // Set the user in the request object for caching in middleware


        user._id = user._id.toString();
        delete user.password,
        delete user.otp,

        res.status(200).json(user);
    }catch(error){
        console.log("Error in login controller ", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const logout = async(req, res) => {
    try {
        res.cookie("jwt_admin", "", {
            maxAge: 0,
            path: '/',        
            secure: true,     
            sameSite: 'None', 
            httpOnly: true    
        });
        res.status(200).json({ message: "Logged Out Successfully" });
    } catch (error) {
        console.log("Error in logout controller ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const uploadProblem = async(req, res) =>{ 
    try{
        const { name, timeLimit, memoryLimit, htmlDescription, isPrivate, interactor, checker, assessment, problemId, points } = req.body;
        const newProblem = new Problem({
            problemId,
            name,
            timeLimit,
            memoryLimit,
            htmlDescription,
            isPrivate,
            interactor,
            checker,
            assessment,
            points
            
        });
        await newProblem.save();


        const payload = newProblem.toJSON();
        delete payload.htmlDescription;

        res.locals = payload;

        res.status(201).json(payload);
    }catch(error){
        console.log("[admin.controller.js] Error while uploading problem", error);
        return res.status(500).json({message: "Internal Server Error"});
    }

}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const startOA = async(req, res) =>{
    const {startTime, endTime, description, title, maxTeamSize} = req.body;
    try{
        const newAssessment = new Assessment({
            startTime,
            endTime,
            description,
            title,
            maxTeamSize
        });
        await newAssessment.save();

        const payload = newAssessment.toJSON();
        delete payload.description;
        res.locals = payload;
        res.status(201).json(payload);
    }catch(error){
        console.log("[admin.controller.js] Error while uploading assessment", error);
        return res.status(500).json({message: "Internal Server Error"});
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

// const uploadMcq = async(req, res)=>{
//     const {question, options, correctAnswerIndex, explanation, assessment} = req.body;
//     const newMcq = new Mcq({
//         question,
//         options,
//         explanation,
//         assessment,
//         correctAnswerIndex
//     });
//     await newMcq.save();
//     res.status(201).json({message:"Refresh page to see the changes"});
// }

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const makeAdmin = async(req, res) => {
    try{
        const user = req.user;
        const {email} = req.body;
        const updatedUser = await User.findOneAndUpdate({email}, {
            isAdmin: true
        });
        if(!updatedUser) return res.status(400).json({message:"User not found"});
        res.status(200).json({message:`${updatedUser.fullName} is an Admin now`});
    }catch(error){
        console.log("Error in admin controller while adding admin...");
        return res.status(500).json({message: "Internal Server Error...."});
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

    const activateAssessment = async(req, res) => {
        try{
            const {assessmentId} = req.body;
            const assessment = await Assessment.findOne({_id: assessmentId})
            .lean()
            .cache({
                ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
                key: generate_cache_key({
                    assessment: assessmentId,
                    purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_DETAILS_CACHING
                })
            });
            if(!assessment) return res.status(500).json({
                message: `${assessmentId} doesn't exists.`
            });
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

            res.locals.problems = problems;
            res.locals.assessment = assessment;
            res.status(200).json({
                message: `Contest id ${assessmentId} has been activated.`
            })
        }catch(error){
            console.log("Error while activting assessment: "+ error);
            res.status(500).json({
                message: `Failed to activate contest with id ${assessmentId}.`
            });
        }

    }

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

module.exports = {
    uploadProblem,
    startOA,
    login,
    logout,
    makeAdmin,
    activateAssessment
}