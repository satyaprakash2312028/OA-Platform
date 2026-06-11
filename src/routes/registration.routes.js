const express = require("express");
const { protectRoute, requiresVerified } = require("../middleware/auth.middleware.js");
const { register } = require("../controllers/registration.controller.js");
const {removeCachedRegistrationDBCalls} = require('../middleware/registration.cache.middleware.js');

const router = express.Router();
// todo
router.post("/register", protectRoute, requiresVerified, removeCachedRegistrationDBCalls, register);
// Add other routes here...

module.exports = { router: router };