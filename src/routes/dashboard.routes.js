const express = require("express")
const { getContests, problemSolved, allOATakenPartInCount, recentSubmissions, lastAcceptedSubmission, getLeaderboard} = require("../controllers/dashboard.controller.js");
const { protectRoute, requiresVerified } = require("../middleware/auth.middleware.js");
const { hydrateWithRegisteredStatus, cacheContestPages, cacheProblemSolvedCount, cacheContestCount, cacheLastAcceptedSubmission, cacheRecentSubmissions, hydrateLeaderboad } = require("../middleware/dashboard.cache.middleware.js");
const { populateSolvedSet } = require("../middleware/problem.cache.middleware.js");
const router = express.Router();


router.get("/getContests/page/:pageNumber", protectRoute, requiresVerified, cacheContestPages, hydrateWithRegisteredStatus, getContests);
router.get("/problemSolved", protectRoute, requiresVerified, cacheProblemSolvedCount, problemSolved);
router.get("/totalContestCount", protectRoute, requiresVerified, cacheContestCount, allOATakenPartInCount);
router.get("/recentSubmissions", protectRoute, requiresVerified, cacheRecentSubmissions, recentSubmissions);
router.get("/lastAcceptedSubmission", protectRoute, requiresVerified, lastAcceptedSubmission);
router.get("/leaderboard/:assessmentId/:pageNumber", protectRoute, requiresVerified, hydrateLeaderboad, getLeaderboard);
module.exports = { router: router}