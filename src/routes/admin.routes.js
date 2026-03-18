// src/routes/internal.routes.js
const express = require("express");
const { uploadMcq, uploadProblem, login, startOA, rejudge, logout, makeAdmin } = require("../controllers/admin.controller.js");
const { protectAdminRoute } = require("../middleware/admin.middleware.js");
const {removeAllCachedContestPages} = require("../middleware/dashboard.cache.middleware.js");
const {removeCachedProblemSet, removeCachedAssessmentInfo} = require("../middleware/problem.cache.middleware.js");
const {setAuthCache, removeAuthCache} = require("../middleware/admin.cache.middleware.js");

const router = express.Router();

// Use the middleware to protect these internal routes
router.post("/uploadMcq", protectAdminRoute, uploadMcq);
router.post("/uploadProblem", protectAdminRoute, removeCachedProblemSet, removeCachedAssessmentInfo, uploadProblem);
router.post("/startOA", protectAdminRoute, removeAllCachedContestPages, startOA);
router.post("/rejudge/:id", protectAdminRoute, rejudge);
router.post("/login", setAuthCache, login);
router.post("/logout",protectAdminRoute, removeAuthCache, logout);
router.post("/makeAdmin", protectAdminRoute, makeAdmin);

module.exports = { router: router };