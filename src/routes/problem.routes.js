// src/routes/problem.routes.js
const express = require("express");
const { protectRoute, requiresVerified } = require("../middleware/auth.middleware.js");
const { getCode, getProblem, submitProblem, getSubmissions, getOAssessments, submitMcq, allProblems } = require("../controllers/problem.controller.js");
const { removeCachedRecentSubmissions} = require("../middleware/dashboard.cache.middleware.js");
const {cachedAssessmentInfo, cachedCode, removeCachedSubmissionPages, cachedSubmissionPages, cachedProblemDetails, cachedProblemSet} = require("../middleware/problem.cache.middleware.js");
const router = express.Router();

router.post("/submitProblem/:id", protectRoute, requiresVerified , removeCachedSubmissionPages ,submitProblem);
router.post("/submitMcq", protectRoute, requiresVerified, submitMcq);
router.get("/submissions/page/:pageNumber", protectRoute, requiresVerified, cachedSubmissionPages, getSubmissions);
router.get("/assessment/:assessmentId", protectRoute, requiresVerified, cachedAssessmentInfo, getOAssessments);
router.get("/getProblem/:id", cachedProblemDetails, getProblem);
router.get("/allProblems/page/:pageNumber", protectRoute, requiresVerified, allProblems);
router.get("/code/:id", cachedCode, getCode);
// Add other routes here...

module.exports = { router: router };