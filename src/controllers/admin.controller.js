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
const {createProblemSchema} = require("../validators/problem.schema.js");
const {createAssessmentSchema} = require("../validators/assessment.schema.js");
const pageSize = 25;

const rejudge = async(req, res) =>{
    try{
        const problemId = req.params.id;
        const submissions = await Submission.find({problem: problemId});
        for(const submission of submissions){
            submission.status = "Pending";
            await submission.save();
            await sendSubmissionToQueue(submission);
        }
        res.status(200).json({message: "Rejudge initiated for all submissions of the problem."});
    }catch(error){
        console.log("Error in rejudge controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

const login = async (req, res) => {
    try{
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ messsage: "All fields are required for login" });
        if (password.length < 6) return res.status(400).json({ messsage: "Password length must be greater than 5" });
        const user = await User.findOne({ email });
        if (!user || !user.isAdmin || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ messsage: "Invalid login credentials" });
        res.cookie("jwt", "", {
            maxAge: 0,
            path: '/',        // <-- Add this
            secure: true,     // <-- Add this
            sameSite: 'None', // <-- Add this
            httpOnly: true    // <-- Good practice to include this too
        });
        generateAdminToken(user._id, res);
        req.user = user; // Set the user in the request object for caching in middleware
        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email,
            profilePic: user.profilePic,
            isVerified: user.isVerified,
            isAdmin: user.isAdmin
        });
    }catch(error){
        console.log("Error in login controller ", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

const logout = async(req, res) => {
    try {
        res.cookie("jwt_admin", "", {
            maxAge: 0,
            path: '/',        // <-- Add this
            secure: true,     // <-- Add this
            sameSite: 'None', // <-- Add this
            httpOnly: true    // <-- Good practice to include this too
        });
        res.status(200).json({ message: "Logged Out Successfully" });
    } catch (error) {
        console.log("Error in logout controller ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

const uploadProblem = async(req, res) =>{ 
    try{
        const { name, timeLimit, memoryLimit, htmlDescription, isPrivate, interactor, checker, assessment, zipFilePath, problemId } = req.body;
        // check with zod
        const problemData = {
            body: {
                name,
                timeLimit,
                memoryLimit,
                htmlDescription,
                isPrivate,
                interactor,
                checker,
                assessment,
                problemId
            }
        };
         // Debug log to check incoming data
        const validation = createProblemSchema.safeParse(problemData);
        if (!validation.success) {
            console.log("Received problem data:", validation);
            return res.status(400).json({ message: "Invalid problem data", errors: validation.error.flatten() });
        }
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
            
        });
        if(newProblem) await newProblem.save();
        else return res.status(400).json({message: "Problem Creation failed."});
        // todo: actual upload of zipfile to be handeled by frontEnd
        const newTest = new Test({
            problem: newProblem._id,
            path: "zipFilePath" // <-- This should be the actual path where the zip file is stored after upload
        });
        if(newTest) await newTest.save();
        else res.status(400).json({message: "Test upload failed"});
        res.status(201).json({message: "Problem uploaded sucessfully"});
    }catch(error){
        console.log("[admin.controller.js] Error while uploading problem", error);
        return res.status(500).json({message: "Internal Server Error"});
    }

}

const startOA = async(req, res) =>{
    const {startTime, endTime, description, title, maxTeamSize} = req.body;
    // check with zod
    const assessmentData = {
        body: {
            startTime,
            endTime,
            description,
            title,
            maxTeamSize
        }
    };
    const validation = createAssessmentSchema.safeParse(assessmentData);
    if (!validation.success) {
        return res.status(400).json({ message: "Invalid assessment data", errors: validation.error.flatten() });
    }

    const newAssessment = new Assessment({
        startTime,
        endTime,
        description,
        title,
        maxTeamSize
    });
    if(newAssessment)  await newAssessment.save();
    else return res.status(400).json({message:"Online Assessment creation failed, try again.."});
    res.status(201).json({message:"Refresh page to see the changes"});
}

const uploadMcq = async(req, res)=>{
    const {question, options, correctAnswerIndex, explanation, assessment} = req.body;
    // check with zod

    const newMcq = new Mcq({
        question,
        options,
        explanation,
        assessment,
        correctAnswerIndex
    });
    if(newMcq) await newMcq.save();
    else return res.status(400).json({message:"Mcq creation failed, try again.."});
    res.status(201).json({message:"Refresh page to see the changes"});
}

const makeAdmin = async(req, res) => {
    try{
        const user = req.user;
        const {email} = req.body;
        if(!email) return res.status(400).json({message:"Email isn't provided"});
        if(email==user.email) return res.status(200).json({message:"You are already an admin."});
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

module.exports = {
    uploadMcq,
    uploadProblem,
    startOA,
    rejudge,
    login,
    logout,
    makeAdmin
}