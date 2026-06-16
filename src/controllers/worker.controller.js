const {Submission} = require("../models/submission.model.js");
const {TeamScore} = require("../models/teamScore.model.js");
const {Registration} = require("../models/registration.model.js");
const {io, getReceiverSocketId}  = require('../lib/socket.js');
const {redis_controllers} = require('../utilities/redis_controllers/import.js');

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const getJudgeVedict = async(req, res) => {
    try{
        req.user = { _id: req.body.user };
        const {_id, verdict, executionTime, memoryUsed, status, user} = req.body;
        const userSocketId = getReceiverSocketId(user);
        if(userSocketId){
            io.to(userSocketId).emit("statusUpdate", {_id, verdict, status});
        }
        // continue from here
        console.log("Received judge verdict for submissionId:", req.body);
        console.log(verdict);
        const submission = await Submission.findByIdAndUpdate(_id, {
            status: verdict,
            executionTime,
            memoryUsed
        }, { new: true });
        if(!submission) return res.status(404).json({message: "Submission not found"});
        
        if(submission.assessment&&(verdict==="Accepted")){
            redis_controllers.redis_leaderboard.update_team_score_in_leaderboard(req.body).catch((error)=>{
                console.log("Error while updating team score in redis leaderboad. " + error);
            });
            redis_controllers.redis_user.save_user_submission(user, submission).catch((error)=>{
                console.log("Error while saving user submission to sorted set. " + error);
            });
        }else{
            redis_controllers.redis_user.save_user_submission(user, submission).catch((error)=>{
                console.log("Error while saving user submission to sorted set. " + error);
            });
        }
        res.status(200).json({message: "Judge vedict processed successfully"});
    }catch(error){
        console.log("Error in getJudgeVedict controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }   
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const getStatus = async(req, res) => {
    try{
        const {_id, status, verdict, user} = req.body;
        
        const userSocketId = getReceiverSocketId(user);
        if(userSocketId){
            io.to(userSocketId).emit("statusUpdate", {_id, status, verdict});
        }
        res.status(200).json({message: "Status update sent successfully"});
    }catch(error){
        console.log("Error in getStatus controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

module.exports = {getJudgeVedict, getStatus};