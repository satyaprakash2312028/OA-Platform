const dotenv =  require("dotenv")
dotenv.config();

const internalRouteChecks = (req, res, next) => {
    try{
        const secret = req.headers['x-internal-secret'];
        console.log(secret);
        if(!secret || secret !== process.env.WORKER_SECRET_KEY){
            return res.status(401).json({message: "Unauthorized Access - Invalid Internal Secret"});
        }else{
            next();
        }
    }catch(error){
        console.log("Error in internalRouteChecks middleware", error);
        return res.status(500).json({message: "Internal Server Error"});
    }
}

module.exports = {internalRouteChecks};