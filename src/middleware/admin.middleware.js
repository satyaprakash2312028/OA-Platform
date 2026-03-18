const dotenv =  require("dotenv")
const jwt = require("jsonwebtoken")
const {User} =  require("../models/user.model.js");
const {client} = require("../lib/redis.js");
dotenv.config();
const protectAdminRoute = async (req, res, next) => {
    try {
        const token = req.cookies.jwt_admin;
        if(!token) return res.status(401).json({message: "Unauthorized Access - No token provided"});
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(!decoded) return res.status(401).json({message: "Unauthorized Access - Invalid Token"});
        // Check redis cache for user data
        const cachedUser = await client.get(`auth:adminInfo:${decoded.userId}`);  
        if(cachedUser){
            req.user = JSON.parse(cachedUser);
            return next();
        }
        const user = await User.findById(decoded.userId).select("-password");
        if(!user) return res.status(404).json({message: "User Not Found"});
        if(!user.isAdmin) return res.status(404).json({message: "User Don't have admin privelages"});
        // Set cache for the user data with an expiration time of 1 hour
        client.setex(`auth:adminInfo:${user._id}`, 3600, JSON.stringify(user));
        // Set user data in request object for downstream use
        req.user = user;
        next();
    } catch (error) {
        console.log("Error in auth middleware ", error);
    }
};

module.exports = {protectAdminRoute};