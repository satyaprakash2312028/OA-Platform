const { generateToken} = require("../lib/utils.js");
const {User} = require("../models/user.model.js");
const bcrypt = require("bcryptjs");
const {cloudinary} = require("../lib/cloudinary.js");
const signup = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) return res.status(400).json({ message: "some fields are missing" });
        if (password.length < 6) {
            return res.status(400).json({ message: "Password is too short" });
        }
        const user = await User.findOne({ email });
        if (user && user.isVerified) return res.status(400).json({ message: "Email Already exists" });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        // if (user) {
        //     let resendAttemptsCountBuff;
        //     if (new Date() - user.otp.expiresAt > 24 * 60 * 60 * 1000) resendAttemptsCountBuff = 0;
        //     else resendAttemptsCountBuff = user.otp.resendAttemptsCount;
        //     const newUser = await User.findByIdAndUpdate(user._id, {
        //         fullName,
        //         password: hashedPassword,
        //         otp: {
        //             code: "000000",
        //             expiresAt: new Date(Date.now()-1),
        //             resendAttemptsCount: resendAttemptsCountBuff,
        //             nextResendAttempt: user.otp.nextResendAttempt,
        //             verificationAttemptsLeft: user.otp.verificationAttemptsLeft
        //         }
        //     }, { new: true }).select("-password -otp.code -otp.resendAttemptsCount");
        //     generateToken(newUser._id, res);
        //     return res.status(201).json(newUser);
        // }
        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
            isVerified: true,
            otp: {
                code: "000000",
                expiresAt: new Date(Date.now() - 1),
                resendAttemptsCount: 0,
                nextResendAttempt: new Date(),
                verificationAttemptsLeft: 10
            }
        });
        if (newUser) {
            await newUser.save();
            generateToken(newUser._id, res);
            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                isVerified: newUser.isVerified,
                profilePic: newUser.profilePic,
                otp: {
                    expiresAt: newUser.otp.expiresAt,
                    nextResendAttempt: newUser.otp.nextResendAttempt,
                    verificationAttemptsLeft: newUser.otp.verificationAttemptsLeft
                },
                createdAt: newUser.createdAt,
                updatedAt: newUser.updatedAt
            });
        } else {
            return res.status(400).json({ message: "User creation failed" });
        }
    } catch (error) {
        console.log("error in signup: ", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "All fields are required for login" });
        if (password.length < 6) return res.status(400).json({ message: "Password length must be greater than 5" });
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid login credentials" });
        generateToken(user._id, res);
        req.user = user; // Set the user in the request object for caching in middleware
        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email,
            profilePic: user.profilePic,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });
    } catch (error) {
        console.log("Error in login controller ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
const logout = async (req, res) => {
    try {
        res.cookie("jwt", "", {
            maxAge: 0,
            path: '/',        // <-- Add this
            secure: true,     // <-- Add this
            sameSite: 'None', // <-- Add this
            httpOnly: true    // <-- Good practice to include this too
        });
        res.status(200).json({ message: "Logged Out Successfully" });
    } catch (error) {
        console.log("Error in logout controller ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
const updateProfile = async (req, res) => {
    try {
        const { profilePic } = req.body;
        const user = req.user;
        if (!profilePic) return res.status(400).json({ message: "Profile pic isn't provided" });
        if (!user.isVerified) return res.status(403).json({ message: "Verify the email first" });
        const uploadResponse = await cloudinary.uploader.upload(profilePic);
        const updatedUser = await User.findByIdAndUpdate(user._id, { profilePic: uploadResponse.secure_url }, { new: true }).select("-password -otp");
        res.status(200).json(updatedUser);
    } catch (error) {
        console.log("Error Occoured in updating profile pic ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
const checkAuth = async (req, res) => {
    try {
        const user = req.user;
        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
            isVerified: user.isVerified,
            otp: {
                expiresAt: user.otp.expiresAt,
                resendAttemptsCount: user.otp.resendAttemptsCount,
                nextResendAttempt: user.otp.nextResendAttempt,
                verificationAttemptsLeft: user.otp.verificationAttemptsLeft
            },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });
    } catch (error) {
        console.log("Error occoured while checking user authorization ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
const checkVerified = async (req, res) => {
   try {
        const user = req.user;
        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });
   } catch (error) {
        console.log("Error in checkVerified controller", error);
        res.status(500).json({message:"Internal Server Error"});
   }
};
// export const sendOtp = async (req, res) => {
//     try {
//         let user = req.user;
//         if (user.isVerified) return res.status(400).json({ message: "Email already verified" });
//         if (user.otp.nextResendAttempt > new Date()) {
//             return res.status(400).json({ message: "Wait for a while before resending otp" });
//         }
//         let resendAttemptsCountBuff;
//         if (new Date() - user.otp.expiresAt >= 21 * 60 * 60 * 1000) resendAttemptsCountBuff = 1;
//         else resendAttemptsCountBuff = user.otp.resendAttemptsCount + 1;
//         let otpCode = (Math.floor(100000 + Math.random() * 900000)).toString();
//         user = await User.findByIdAndUpdate(user._id, {
//             otp: {
//                 code: otpCode,
//                 expiresAt: new Date(Date.now() + 1000 * 60 * 10 * Math.min(resendAttemptsCountBuff, 6)),
//                 resendAttemptsCount: resendAttemptsCountBuff,
//                 nextResendAttempt: new Date(Date.now() + 1000 * (resendAttemptsCountBuff < 2 ? 100 : (resendAttemptsCountBuff < 5 ? 200 : 12000))),
//                 verificationAttemptsLeft: 10
//             }
//         },{new:true});
//         mailer(user.email, otpCode);
//         res.status(200).json({
//             _id: user._id,
//                 fullName: user.fullName,
//                 email: user.email,
//                 isVerified: user.isVerified,
//                 profilePic: user.profilePic,
//                 otp: {
//                     expiresAt: user.otp.expiresAt,
//                     nextResendAttempt: user.otp.nextResendAttempt,
//                     verificationAttemptsLeft: user.otp.verificationAttemptsLeft
//                 }
//         });
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// };
// export const verifyOtp = async (req, res) => {
//     try {
//         const user = req.user;
//         if (user.isVerified) return res.status(400).json({ message: "Email already verified" });
//         if (user.otp.expiresAt.getTime() < Date.now()) return res.status(400).json({ message: "OTP expired, try resending OTP" });
//         if (!user.otp.verificationAttemptsLeft) return res.status(400).json({ message: "Too many wrong attempts, resend OTP and try again" });
//         if (user.otp.code !== req.body.otp) {
//             await User.findByIdAndUpdate(user._id, {
//                 $inc: { "otp.verificationAttemptsLeft": -1 }
//             }, { new: true });

//             return res.status(400).json({ message: "Wrong OTP, Try again"});
//         }
//         const newUser = await User.findByIdAndUpdate(user._id, {
//             isVerified: true,
//             otp: undefined
//         }, { new: true }).select("-password -otp");
//         res.status(200).json(newUser);
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({message:"Internal Server Error"});
//     }
// };

module.exports = {signup, login, logout, checkVerified, checkAuth, updateProfile};