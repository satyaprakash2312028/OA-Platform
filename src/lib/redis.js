const Redis = require("ioredis");
const dotenv = require("dotenv");
dotenv.config();
const client = new Redis(process.env.REDIS_URL);
client.on("connect", () => {
    console.log("Connected to Redis");
});
client.on("error", (err) => {
    console.error("Redis connection error: ", err);
});
module.exports = {client};