// cache the authentication result for 5 minutes to reduce the load on the authentication service
const { client } = require("../lib/redis.js");
// tweaking res object to add a method for setting auth cache when status code is between 200 and 299
const setAuthCache = async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const cacheKey = `auth:userInfo:${req.user._id}`;
            client.setex(cacheKey, 3600, JSON.stringify(req.user)).catch((err) => {
                console.error("Error caching auth result:", err);
            });
        }
        originalSend.call(this, body);
    }
    next();
}

const removeAuthCache = async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const cacheKey = `auth:userInfo:${req.user._id}`;
            console.log("Removing auth cache for userId:", req.user._id);
            client.del(cacheKey).catch((err) => {
                console.error("Error removing auth cache:", err);
            });
        }
        originalSend.call(this, body);
    }
    next();
}

module.exports = {
    setAuthCache,
    removeAuthCache
}
