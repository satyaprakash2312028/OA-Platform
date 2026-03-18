const dotenv =  require("dotenv")
const jwt = require("jsonwebtoken")
const {User} =  require("../models/user.model.js");
const {client} = require("../lib/redis.js");
dotenv.config();
const protectRoute = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if(!token) return res.status(401).json({message: "Unauthorized Access - No token provided"});
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(!decoded) return res.status(401).json({message: "Unauthorized Access - Invalid Token"});
        // Check redis cache for user data
        const cachedUser = await client.get(`auth:userInfo:${decoded.userId}`);  
        if(cachedUser){
            req.user = JSON.parse(cachedUser);
            return next();
        }
        // If not in cache, fetch from database and set cache
        const user = await User.findById(decoded.userId).select("-password");
        if(!user) return res.status(404).json({message: "User Not Found"});
        // Set cache for the user data with an expiration time of 1 hour
        client.setex(`auth:userInfo:${user._id}`, 3600, JSON.stringify(user));
        req.user = user;
        next();
    } catch (error) {
        console.log("Error in auth middleware ", error);
    }
};
const requiresVerified = (req, res, next) => {
    try {
        if(!req.user.isVerified) return res.status(403).json({message: "Verify your email account first"});
        next();
    } catch (error) {
        console.log("Error in requiresVerified middleware", error);
    }
}


module.exports = {protectRoute, requiresVerified};