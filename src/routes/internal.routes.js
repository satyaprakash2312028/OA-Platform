// src/routes/internal.routes.js
console.log("--- INTERNAL.ROUTES.JS [v2] IS LOADING ---");
const express = require("express");
const { internalRouteChecks } = require("../middleware/internal.middleware.js");
const { addProblemToSolvedSet } = require("../middleware/internal.cache.middleware.js");
const { getJudgeVedict, getStatus } = require("../controllers/worker.controller.js");
const { cacheLastAcceptedSubmission } = require("../middleware/dashboard.cache.middleware.js");
const router = express.Router();

// Use the middleware to protect these internal routes
router.post("/verdict", internalRouteChecks, addProblemToSolvedSet, getJudgeVedict);
router.post("/status", internalRouteChecks, getStatus);

module.exports = { router: router };