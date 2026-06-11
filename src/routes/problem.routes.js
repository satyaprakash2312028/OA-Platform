// src/routes/problem.routes.js
const express = require("express");
const { protectRoute, requiresVerified } = require("../middleware/auth.middleware.js");
const { getCode, getProblem, submitProblem, getSubmissions, getOAssessments, allProblems } = require("../controllers/problem.controller.js");
const {cachedSubmissionPages, cacheNewSubmission, cachedProblemSet, hydrateWithSolvedStatus} = require("../middleware/problem.cache.middleware.js");
const {submit_problem_field_validation} = require('../middleware/problem.middleware.js')
const router = express.Router();

router.post("/submitProblem/:id", protectRoute, requiresVerified, submit_problem_field_validation, cacheNewSubmission, submitProblem);
// router.post("/submitMcq", protectRoute, requiresVerified, submitMcq);
router.get("/submissions/page/:pageNumber", protectRoute, requiresVerified, cachedSubmissionPages, getSubmissions); 
router.get("/assessment/:assessmentId", protectRoute, requiresVerified, getOAssessments);
router.get("/getProblem/:id", protectRoute, requiresVerified, getProblem);
router.get("/allProblems/page/:pageNumber", protectRoute, requiresVerified, cachedProblemSet, hydrateWithSolvedStatus, allProblems);
router.get("/code/:id", protectRoute, requiresVerified, getCode);
// Add other routes here...

module.exports = { router: router };