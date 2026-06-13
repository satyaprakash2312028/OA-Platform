const dotenv =  require("dotenv")
const jwt = require("jsonwebtoken")
const {User} =  require("../models/user.model.js");
const {client} = require("../lib/redis.js");
const {redis_controllers} = require('../utilities/redis_controllers/import.js');
const { Registration } = require("../models/registration.model.js");
const { Submission } = require("../models/submission.model.js");
dotenv.config();

const signUp_route_validation = (req, res, next) => {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ messsage: "All fields are required for signup" });
    if (password.length < 6) return res.status(400).json({ messsage: "Password length must be greater than 5" });
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Invalid email format" });
    if(!/^[a-zA-Z\s]+$/.test(fullName)) return res.status(400).json({ message: "Full name should only contain letters and spaces" });
    next();
}
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
const login_route_validation = (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ messsage: "All fields are required for login" });
    if (password.length < 6) return res.status(400).json({ messsage: "Password length must be greater than 5" });
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Invalid email format" });
    next();
}
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
const protectRoute = async (req, res, next) => {
    console.log('__________________________________________________________');
    try {
        const token = req.cookies.jwt;
        
        if(!token) return res.status(401).json({message: "Unauthorized Access - No token provided"});
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(!decoded) return res.status(401).json({message: "Unauthorized Access - Invalid Token"});
        try{
            const cached_user = await redis_controllers.redis_user.get_user_authentication_info(decoded.userId);
            if(cached_user){
                req.user = cached_user;
                return next();
            }
        } catch (error) {
            console.log("Error fetching user from Redis", error);
        }
        const user = await User.findById(decoded.userId).select("-password").lean();
        if(!user) return res.status(404).json({message: "User Not Found"});
        try{
            await redis_controllers.redis_user.save_user_authentication_info(user);
        }catch(error){
            console.log("Error saving user to Redis", error);
        }
        req.user = user;
        next();
    } catch (error) {
        console.log("Error in auth middleware ", error);
        return res.status(401).json({message: "Unauthorized Access - Invalid Token"});
    }
};

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
const requiresVerified = (req, res, next) => {
    try {
        if(!req.user.isVerified) return res.status(403).json({message: "Verify your email account first"});
        next();
    } catch (error) {
        console.log("Error in requiresVerified middleware", error);
        return res.status(500).json({message: "Internal Server Error"});
    }
}

// 

const hydrateUserBitmap = async(req, res, next) => {

    const originalSend = res.json;
    
    res.json = function(body) {
        originalSend.call(this, body);

        if(res.statusCode >= 200 && res.statusCode < 300){
            hydrateHelper(body._id).catch((error) => {
                console.log("Error while hydrating bitmaps: "+ error);
            });
            redis_controllers.redis_user.save_user_authentication_info(body);
        }
    }
    next();

}


const hydrateHelper = async(user_id) => {
    try{
        let status = await redis_controllers.redis_user.get_problem_bitmap_existence_status(user_id);
        if(!status){
            const result = await Submission.distinct('problem', {
                user: user_id,
                verdict: 'Accepted'
            });
            await redis_controllers.redis_user.save_problem_to_solved_bitmap(user_id, result);
        }

        status = await redis_controllers.redis_user.get_contest_bitmap_existence_status(user_id);
        if(!status){
            const result = await Registration.distinct('assessment', {
                user: user_id,
                isPending: false
            });
            await redis_controllers.redis_user.save_to_user_given_contest_bitmap(user_id, result);
        }

        
    }catch(error){
        console.log("Error while hydrating contest and problem bitmap: "+ error);
    }
}



module.exports = {protectRoute, requiresVerified, signUp_route_validation, login_route_validation, hydrateUserBitmap};