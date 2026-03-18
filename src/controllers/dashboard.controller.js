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
const pageSize = 25;
const getContests = async (req, res) =>{
    try{
        const user = req.user;
        let pageNumber = Number(req.params.pageNumber) || 1;
        const documentSize = await Assessment.estimatedDocumentCount();
        const totalPages = Math.ceil(documentSize / pageSize);
        pageNumber = Math.min(pageNumber, totalPages);
        pageNumber = Math.max(pageNumber, 1);
        const assessments = await Assessment.find({}).sort({ startTime: -1 }).skip(pageSize * (pageNumber - 1)).limit(pageSize);
        const assessmentIds = assessments.map(p => p._id);

        // 3. Find which of *these* assessments the user is registered for
        const registeredAssessment = await Registration.find({
            user: user._id,           // The current user
            assessment: { $in: assessmentIds },
            isPending: false
        }).select("assessment");

        // 4. Create a Set of registered assessment IDs for O(1) instant lookup
        const registeredSet = new Set(registeredAssessment.map(s => s.assessment.toString()));

        // 5. Add an 'isRegistered' flag to each assessment object
        const assessmentsWithStatus = assessments.map(p => {
            return {
                ...p.toObject(), // Convert Mongoose document to plain JS object
                isRegistered: registeredSet.has(p._id.toString())
            };
        });

        res.status(200).json({
            assessments: assessmentsWithStatus,
            totalPages,
            pageNumber
        });
    }catch(error){
        console.log("Error in getContests controller ", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}


const allOATakenPartInCount = async(req, res)=>{
    try{
        const user = req.user;
        const oaTakenPartInCount = await Registration.countDocuments({
            user: user._id,
            isPending: false
        });
        if(oaTakenPartInCount == null) throw new Error("Internal Server Error");
        res.status(200).json({count: oaTakenPartInCount});
    }catch(error){
        console.log("Error in dashboard controller");
        res.status(500).json({message:"Internal Server Error"});
    }
}

const problemSolved = async(req, res)=>{
    try{
        const user = req.user;
        console.log("hi");
        const result = await Submission.aggregate([
        {
            $match: {
            user: user._id,           // the user's ObjectId
            status: 'Accepted'      // only accepted submissions
            }
        },
        {
            $group: {
            _id: '$problem'         // group by unique problem
            }
        },
        {
            $count: 'totalSolved'     // count unique problems
        }
        ]);
        if(!result){
            return res.status(500).json({message:"Internal Server Error..."});
        }
        if(result[0]) res.status(200).json({problemSolved:result[0].totalSolved});
        else res.status(200).json({problemSolved:0});
    }catch(erorr){
        console.log("Error in problem solved controller");
        res.status(500).json({message:"Internal Server Error....."});
    }
}

const recentSubmissions = async(req, res) =>{
    try{
        const user = req.user;
        const submission = await Submission.find({user:user._id}).sort({createdAt:-1}).limit(10);
        res.status(200).json({submissions:submission});
    }catch(error){
        console.log("Error in recentSubmissions controller ", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}

const lastAcceptedSubmission = async(req, res) => {
    try{
        const user = req.user;
        const submission = await Submission.find({user:user._id, status:"Accepted"}).sort({createdAt:-1}).limit(1);
        if(submission.length===0){
            return res.status(200).json({submission:null});
        }
        res.status(200).json({submission:submission[0]});
    }catch(error){
        console.log("Error in lastAcceptedSubmission controller ", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}
module.exports = {
    getContests,
    problemSolved,
    allOATakenPartInCount,
    recentSubmissions,
    lastAcceptedSubmission
}