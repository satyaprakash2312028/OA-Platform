const { generateToken} = require("../lib/utils.js");
const {User} = require("../models/user.model.js");
const bcrypt = require("bcryptjs");
const {cloudinary} = require("../lib/cloudinary.js");
const {Assessment} = require("../models/assessment.model.js");
const {Registration} = require("../models/registration.model.js");
const {Team} = require("../models/team.model.js");
const { mongoose } = require("mongoose");

const register = async(req, res) => {
    try{
        const {teamName, assessmentId, existingTeamID} = req.body;
        const user = req.user;
        if(teamName.trim().length<=0) return res.status(400).json({ message: "Team name isn't provided." });
        if(assessmentId.trim().length<=0) return res.status(400).json({ message: "Assessment ID isn't provided." });
        const assessment = await Assessment.findById(assessmentId);
        if(!assessment) return res.status(400).json({ message: "Assessment ID is wrong." });
        if(assessment.startTime<(new Date())) return res.status(400).json({ message: "Can't register for this contest." });
        let teamID;
        const regFlag = await Registration.findOne({
            user: user._id,
            assessment: assessmentId
        });
        if(regFlag) return res.status(400).json({message: "User is already registered for the Hackathon."});
        if(!existingTeamID){
            const team = await Team.findOne({name: teamName, assessment:assessmentId});
            if(!team){
                const newTeam = new Team({
                    name: teamName,
                    leader: user._id,
                    assessment: assessmentId
                });
                if(!newTeam) return res.status(500).json({message: "Not able to create the team. Try using different name."});
                await newTeam.save();
                teamID = newTeam._id;
            }else{
                return res.status(400).json({ message: "Team name already exists. Please choose a different name or join existing team." });
            }
        }else{
            if(!mongoose.Types.ObjectId.isValid(existingTeamID)) return res.status(400).json({ message: "Team ID is wrong." });
            const team = await Team.findById(existingTeamID);
            if(!team) return res.status(400).json({ message: "Team ID is wrong." });
            const memeberCount = await Registration.find({team:existingTeamID});
            if(memeberCount.length >= assessment.maxTeamSize) return res.status(400).json({message: "Max team size reached already"});
            teamID = existingTeamID;
            console.log("Bye");
        }
        const newRegistration = new Registration({
            assessment: assessmentId,
            team: teamID,
            user: user._id,
            isPending: false
        });
        if(newRegistration) await newRegistration.save();
        else return res.status(400).json({ message: "Invalid Attempt..." });
        console.log(newRegistration.toJSON());
        res.status(201).json(newRegistration.toJSON());
    }catch(error){
        console.log("Error in register controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};


const getSelectedTeams = async (req, res) => {
    try {
        const { assessmentId } = req.body; // Or req.params if using URL parameters
        if (!assessmentId) return res.status(400).json({ message: "Assessment ID is required" });
        const assessmentRelated = await Assessment.findById(assessmentId);
        const endTimeMs = assessmentRelated.endTime.getTime();
        const currentTimeMs = new Date().getTime();
        if((currentTimeMs)<(endTimeMs+3*24*60*60*1000)){
            return res.status(400).json({message:"Result Isn't ready yet"});
        }
        const teams = await TeamScore.find({
            score: { $gt: 40 }
        });
        if(!teams) throw new Error("teams array isn't formed");
        res.status(200).json({ selectedTeams: teams }); // Corrected key to match original code

    } catch (error) {
        console.log("Error in getSelectedTeams controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

const getTeamDetails = async(req, res) =>{
    try{
        const { assessmentId } = req.body;
        const userId = req.user._id;

        if (!assessmentId) {
            return res.status(400).json({ message: "Assessment ID is required" });
        }

        const result = await Registration.aggregate([
            // Step 1: Find the team of the current user for this assessment
            {
                $match: {
                    user: userId,
                    assessment: new mongoose.Types.ObjectId(assessmentId)
                }
            },
            // Step 2: Extract teamId
            {
                $project: { team: 1 }
            },
            // Step 3: Lookup all registrations for this team
            {
                $lookup: {
                    from: "registrations",
                    localField: "team",
                    foreignField: "team",
                    as: "teamMembers"
                }
            },
            { $unwind: "$teamMembers" },

            // Step 4: Lookup corresponding user data for each member
            {
                $lookup: {
                    from: "users",
                    localField: "teamMembers.user",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
            { $unwind: "$userInfo" },

            // Step 5: Return only needed fields
            {
                $project: {
                    _id: "$userInfo._id",
                    name: "$userInfo.name",
                    email: "$userInfo.email"
                }
            }
        ]);
        if(!result) return res.status(400).json({message:"Result Not found"});
        res.status(200).json({ teamMembers: result });
    }catch(error){
        console.log("Error in registration controller. ", error);
        return res.status(400).json({message:"Internal Server Error"});
    }
}
const isTeamSelected = async(req, res) => {
    try{
        const userId = req.user._id;
        const {assessmentId} = req.body;
        if(!assessmentId) return res.status(400).json({message:"Assessemnt Id isn't provided"});
        const assessmentRelated = await Assessment.findById(assessmentId);
        if(!assessmentRelated) return res.status(400).json({message:"No Assignment found"});
        const endTimeMs = assessmentRelated.endTime.getTime();
        const currentTimeMs = new Date().getTime();
        if((currentTimeMs)<(endTimeMs+3*24*60*60*1000)){
            return res.status(400).json({message:"Result Isn't ready yet"});
        }
        const result = await Registration.aggregate([
        // Stage 1: Find the specific registration document for the user.
        {
            $match: {
            user: new mongoose.Types.ObjectId(userId),
            assessment: new mongoose.Types.ObjectId(assessmentId)
            }
        },

        // Stage 2: Look up the corresponding document in the 'teamscores' collection.
        {
            $lookup: {
            from: 'teamscores', // The collection name for the TeamScore model
            let: {
                teamId: '$team',       // 'team' ID from the Registration doc
                assessId: '$assessment' // 'assessment' ID from the Registration doc
            },
            pipeline: [
                {
                $match: {
                    $expr: {
                    $and: [
                        { $eq: ['$team', '$$teamId'] },         
                        { $eq: ['$assessment', '$$assessId'] },  
                        { $gte: ['$score', 40] }                
                    ]
                    }
                }
                },
                { $limit: 1 }
            ],
            as: 'matchingScore'
            }
        },
        {
            $project: {
            _id: 0,
            hasHighEnoughScore: { $gt: [{ $size: '$matchingScore' }, 0] }
            }
        }
        ]);
        if(!result){
            throw new Error("result isn't found");
        }
        if (result.length === 0) {
        console.log('No registration found for user.');
        return res.status(400).json({message:"User wasn't registered for this contest."});
        }
        res.status(200).json({isSelected:result[0].hasHighEnoughScore});
    }catch(error){
        console.log("Error in registration controller. ", error);
        return res.status(400).json({message:"Internal Server Error"});
    }
    

}
module.exports = {register, getSelectedTeams, getTeamDetails, isTeamSelected};


