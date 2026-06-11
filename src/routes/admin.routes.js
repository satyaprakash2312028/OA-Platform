// src/routes/internal.routes.js
const express = require("express");
const { uploadMcq, uploadProblem, login, startOA, logout, makeAdmin, activateAssessment } = require("../controllers/admin.controller.js");
const { protectAdminRoute, login_field_validation, upload_assessment_field_validation, make_admin_field_validation, upload_problem_field_validation, activate_assessment_field_validation } = require("../middleware/admin.middleware.js");
const {} = require("../middleware/dashboard.cache.middleware.js");
const {addProblemtoCache, addAssessmenttoCache, } = require("../middleware/problem.cache.middleware.js");
const {setAuthCache, removeAuthCache, activateAssessmentCache} = require("../middleware/admin.cache.middleware.js");

const router = express.Router();

// Use the middleware to protect these internal routes
// router.post("/uploadMcq", protectAdminRoute, uploadMcq);
router.post("/uploadProblem", protectAdminRoute, upload_problem_field_validation, addProblemtoCache, uploadProblem);
router.post("/startOA", protectAdminRoute, upload_assessment_field_validation, addAssessmenttoCache, startOA);
// router.post("/rejudge/:id", protectAdminRoute, rejudge);
router.post("/login", login_field_validation, login);
router.post("/logout",protectAdminRoute, logout);
router.post("/makeAdmin", protectAdminRoute, make_admin_field_validation, makeAdmin);
router.post("/activate", protectAdminRoute, activate_assessment_field_validation, activateAssessmentCache, activateAssessment);

module.exports = { router: router };