const dotenv =  require("dotenv")
const {redis_controllers} = require("../utilities/redis_controllers/import.js");
dotenv.config();
const {client} = require("../lib/redis.js");

const addProblemToSolvedSet = async (req,  res, next) => {
    const {verdict, problemId} = req.body;
    
    next();
}
module.exports = {
    addProblemToSolvedSet
}