console.log("--- SERVER.JS [v2] IS LOADING ---");
const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const {app, server} = require('./src/lib/socket.js');
require("./src/lib/redis.js");
const { connectDB } = require('./src/lib/db.js');

const { router: authRoutes } = require('./src/routes/auth.routes.js');
const { router: problemRoutes } = require('./src/routes/problem.routes.js');
const { router: internalRoutes } = require('./src/routes/internal.routes.js');
const { router: adminRoutes } = require('./src/routes/admin.routes.js');
const { router: dashboardRoutes } = require('./src/routes/dashboard.routes.js');
const { router: registrationRoutes } = require('./src/routes/registration.routes.js');
require('./src/utilities/cachedQuery.js');
// ... create and import other routes (registration, etc.)
dotenv.config();
const PORT = process.env.PORT;
app.use(express.json({limit: "50mb"}))
app.use(express.urlencoded({extended: true, limit: "1kb"}));
app.use(cookieParser());
app.use(cors({
    origin: ["https://oa-platform-frontend.vercel.app", "http://localhost:5174", "http://localhost:5173"],
    credentials: true
}));
// --- ADD THESE LINES ---
app.use("/api/auth", authRoutes);
app.use("/api/problem", problemRoutes);
app.use("/internal", internalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/registration", registrationRoutes)
server.listen(PORT, () => {
  console.log(`Backend server listening on ${PORT} port...`);
  connectDB();
});