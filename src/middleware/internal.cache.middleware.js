const dotenv =  require("dotenv")
dotenv.config();
const {client} = require("../lib/redis.js");

const addProblemToSolvedSet = async (req,  res, next) => {
    const {verdict, problemId} = req.body;
    if(verdict === "Accepted"){
        // add the problemId to the solved set for the user in redis
        await client.sadd(`solved:${req.user._id}`, problemId).catch((err) => {
            console.error("Error adding problem to solved set:", err);
        });
    }
    next();
}