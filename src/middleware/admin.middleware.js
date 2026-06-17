const dotenv =  require("dotenv")
const jwt = require("jsonwebtoken")
const {User} =  require("../models/user.model.js");
const {client} = require("../lib/redis.js");
const {createProblemSchema} = require("../validators/problem.schema.js");
const {createAssessmentSchema} = require("../validators/assessment.schema.js");
const {redis_controllers} = require("../utilities/redis_controllers/import.js");
const { de } = require("zod/locales");
const { default: mongoose } = require("mongoose");
dotenv.config();

const login_field_validation = (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ messsage: "All fields are required for login" });
    if (password.length < 6) return res.status(400).json({ messsage: "Password length must be greater than 5" });
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Invalid email format" });
    next();
}

const upload_problem_field_validation = (req, res, next) => {
    const { name, timeLimit, memoryLimit, htmlDescription, isPrivate, interactor, checker, assessment, zipFilePath, problemId, points } = req.body;
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
            problemId,
            points
        }
    };
    const validation = createProblemSchema.safeParse(problemData);
    if (!validation.success) {
        console.log("Received problem data:", validation);
        return res.status(400).json({ message: "Invalid problem data", errors: validation.error.flatten() });
    }
    next();
}

const upload_assessment_field_validation = (req, res, next) => {
    const {startTime, endTime, description, title, maxTeamSize} = req.body;
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
    next();
}

const make_admin_field_validation = (req, res, next) => {
    const user = req.user;
    const {email} = req.body;
    if(!email) return res.status(400).json({message:"Email isn't provided"});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Invalid email format" });
    if(email==user.email) return res.status(200).json({message:"You are already an admin."});
    next();
}


// <------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const activate_assessment_field_validation = async(req, res, next) => {
    const {assessmentId} = req.body;
    if(!Number(assessmentId)) return res.status(400).json({
        message: 'Invalid Object Id.'
    })
    next();
}


// <------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->


const protectAdminRoute = async (req, res, next) => {
    try {
        const token = req.cookies.jwt_admin;
        if(!token) return res.status(401).json({message: "Unauthorized Access - No token provided"});
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(!decoded) return res.status(401).json({message: "Unauthorized Access - Invalid Token"});
        try{
            const cached_admin = await redis_controllers.redis_user.get_user_authentication_info(decoded.userId);
            if(cached_admin){
                req.user = cached_admin;
                return next();
            }
        }catch(error){
            console.log("Error fetching cached admin data: ", error);
        }
        const user = await User.findById(decoded.userId).select("-password");
        if(!user) return res.status(404).json({message: "User Not Found"});
        if(!user.isAdmin) return res.status(404).json({message: "User Don't have admin privelages"});
        req.user = user;
        try{
            await redis_controllers.redis_user.save_user_authentication_info(user);
        }catch(error){
            console.log("Error saving admin data to cache: ", error);
        }
        next();
    } catch (error) {
        console.log("Error in auth middleware ", error);
        return res.status(401).json({message: "Unauthorized Access - Invalid Token"});
    }
};

// <------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->






module.exports = {
    protectAdminRoute,
    upload_problem_field_validation,
    login_field_validation,
    upload_assessment_field_validation,
    make_admin_field_validation,
    activate_assessment_field_validation
};