const jwt =  require("jsonwebtoken")
const dotenv = require("dotenv")
dotenv.config();
const generateToken = (userId, res) => {
    const token = jwt.sign({userId}, process.env.JWT_SECRET, {
        expiresIn: "7d"
    });
        res.cookie("jwt", token, {
            maxAge: 24*60*60*7*1000,
            httpOnly: true,
            sameSite: "none",
            secure: true,
            path: "/"
        });
    return token;
};

const generateAdminToken = (userId, res) => {
    const token = jwt.sign({userId}, process.env.JWT_SECRET, {
        expiresIn: "7d"
    });
        res.cookie("jwt_admin", token, {
            maxAge: 24*60*60*7*1000,
            httpOnly: true,
            sameSite: "none",
            secure: true,
            path: "/"
        });
    return token;
}

module.exports = {generateToken, generateAdminToken};