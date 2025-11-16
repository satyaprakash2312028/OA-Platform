const express = require("express");
const { protectRoute, requiresVerified } = require("../middleware/auth.middleware.js");
const { register, getSelectedTeams, getTeamDetails, isTeamSelected} = require("../controllers/registration.controller.js");

const router = express.Router();

router.post("/register", protectRoute, register);
router.post("/getSelectedTeams", protectRoute, requiresVerified, getSelectedTeams);
router.get("/getTeamDetails", protectRoute, requiresVerified, getTeamDetails);
router.get("/isTeamSelected", protectRoute, requiresVerified, isTeamSelected);
// Add other routes here...

module.exports = { router: router };