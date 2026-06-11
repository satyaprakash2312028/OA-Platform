const express = require("express")
const { login, logout, signup, updateProfile, checkAuth, checkVerified } = require("../controllers/auth.controller.js");
const { protectRoute, requiresVerified, signUp_route_validation, login_route_validation, hydrateUserBitmap} = require("../middleware/auth.middleware.js");
const {setAuthCache, removeAuthCache} = require("../middleware/auth.cache.middleware.js");
const router = express.Router();
router.post("/signup", signUp_route_validation, signup);
router.post("/login", login_route_validation, hydrateUserBitmap, login);
router.post("/logout", protectRoute, removeAuthCache, logout);
// router.put("/update-profile", protectRoute, requiresVerified,  updateProfile);
router.get("/check", protectRoute, checkAuth);
router.get("/checkVerified", protectRoute, requiresVerified, checkVerified);
module.exports =  {router: router};