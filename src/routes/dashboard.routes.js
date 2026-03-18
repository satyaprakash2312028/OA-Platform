const express = require("express")
const { getContests, problemSolved, allOATakenPartInCount, recentSubmissions, lastAcceptedSubmission} = require("../controllers/dashboard.controller.js");
const { protectRoute, requiresVerified } = require("../middleware/auth.middleware.js");
const { cacheContestPages, cacheProblemSolvedCount, cacheContestCount, cacheLastAcceptedSubmission, cacheRecentSubmissions } = require("../middleware/dashboard.cache.middleware.js");
const { populateSolvedSet } = require("../middleware/problem.cache.middleware.js");
const router = express.Router();


router.get("/getContests/page/:pageNumber", protectRoute, requiresVerified, cacheContestPages, getContests);
router.get("/problemSolved", protectRoute, requiresVerified, cacheProblemSolvedCount, problemSolved);
router.get("/totalContestCount", protectRoute, requiresVerified, populateSolvedSet, cacheContestCount, allOATakenPartInCount);
router.get("/recentSubmissions", protectRoute, requiresVerified, cacheRecentSubmissions, recentSubmissions);
router.get("/lastAcceptedSubmission", protectRoute, requiresVerified, cacheLastAcceptedSubmission, lastAcceptedSubmission);
module.exports = { router: router}