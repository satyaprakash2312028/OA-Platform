// clear all cached data in Redis - for testing purposes
const {client} = require("./redis.js");
const clearCache = async () => {
    try {
        await client.flushdb();
        console.log("Cache cleared successfully");
    }
    catch (err) {
        console.error("Error clearing cache:", err);
    }
}
clearCache();
module.exports = {
    clearCache
}