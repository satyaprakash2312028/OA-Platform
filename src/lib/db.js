const mongoose =  require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("[API] Mongodb connected successfully.");
    } catch (error) {
        console.log(process.env.MONGODB_URI);
        console.log(error);
    }
};
module.exports = {connectDB};