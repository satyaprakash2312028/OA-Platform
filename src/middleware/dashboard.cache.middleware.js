const {client} = require("../lib/redis.js");
// Middleware to cache dashboard data for 12 hours to reduce load on the database
const cacheContestPages = async (req, res, next) => {
    // use hget and hset with a hashset for caching contest pages to allow more granular cache invalidation based on page number and user id
    // add expiration time on the hashset to prevent stale data and memory bloat in redis
    const cacheKey = `dashboard:contest:pages:${req.user._id}:${req.params.pageNumber}`;
    const cachedData = await client.hget('contest',cacheKey).catch((err) => {
        console.error("Error fetching cached contest pages:", err);
        return next();
    });
    if (cachedData) {
        return res.status(200).send(JSON.parse(cachedData));
    }
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            client.hset('contest', cacheKey, body).catch((err) => {
                console.error("Error caching contest pages:", err);
            });
            client.expire('contest', 43200); // Set expiration time to 12 hours
        }
        originalSend.call(this, body);
    }
    next();
}

const removeAllCachedContestPages = async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            // delete all contest page caches for the user
            client.hdel('contest').catch((err) => {
                console.error("Error removing cached contest pages:", err);
            });

        }
        originalSend.call(this, body);
    }
}

const cacheProblemSolvedCount = async (req, res, next) => {
    const cacheKey = `dashboard:problemSolvedCount:${req.user._id}`;
    const cachedData = await client.get(cacheKey).catch((err) => {
        console.error("Error fetching cached problem solved count:", err);
        return next();
    });
    if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
    }
    const originalSend = res.send;  
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            
            client.setex(cacheKey, 1800, body).catch((err) => {
                console.error("Error caching problem solved count:", err);
            });
        }
        originalSend.call(this, body);
    };
    next();
};

const cacheContestCount = async (req, res, next) => {
    const cacheKey = `solved:${req.user._id}`;
    // use scard to get the size of the set, the set will surely be there as we added a middleware to populate the set before this middleware is called
    const cachedData = await client.scard(cacheKey).catch((err) => {
        console.error("Error fetching cached contest count:", err);
        return next();
    });
    
}

const cacheRecentSubmissions = async (req, res, next) => {
    const cacheKey = `dashboard:recentSubmissions`;
    const cachedData = await client.hget(`submission:${req.user._id}`,cacheKey).catch((err) => {
        console.error("Error fetching cached recent submissions:", err);
        return next();
    });
    if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
    }
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            client.hset(`submission:${req.user._id}`, cacheKey, body).catch((err) => {
                console.error("Error caching recent submissions:", err);
            });
            client.expire(`submission:${req.user._id}`, 1800);
        }
        originalSend.call(this, body);
    }
    next();
}

const cacheLastAcceptedSubmission = async (req, res, next) => {
    const cacheKey = `dashboard:lastAcceptedSubmission:${req.user._id}`;
    const cachedData = await client.get(cacheKey).catch((err) => {
        console.error("Error fetching cached last accepted submission:", err);
        return next();
    });
    if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
    }
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            client.setex(cacheKey, 1800, body).catch((err) => {
                console.error("Error caching last accepted submission:", err);
            }
            );
            client.expire(cacheKey, 1800);
        }   
        originalSend.call(this, body);
    }
    next();
}

const removeCachedProblemSolvedCount = async (req, res, next) => {
    if(req.body.verdict === "Accepted"){
        
        const cacheKey = `dashboard:problemSolvedCount:${req.user._id}`;
        await client.del(cacheKey).catch((err) => {
            console.error("Error removing cached problem solved count:", err);
        });
    }
    next();
};

const removeCachedRecentSubmissions = async (req, res, next) => {

    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            client.hdel(`submission:${req.user._id}`, `dashboard:recentSubmissions`).catch((err) => {
                console.error("Error removing cached recent submissions:", err);
            });
        }
        originalSend.call(this, body);
    }
    next();
}

const removeCachedLastAcceptedSubmission = async (req, res, next) => {
    if(req.body.verdict === "Accepted"){
        const cacheKey = `dashboard:lastAcceptedSubmission:${req.user._id}`;
        await client.del(cacheKey).catch((err) => {
            console.error("Error removing cached last accepted submission:", err);
        });
    }
    next();
}


module.exports = {
    cacheContestPages,
    removeAllCachedContestPages,
    cacheProblemSolvedCount,
    removeCachedProblemSolvedCount,
    cacheContestCount,
    cacheRecentSubmissions, 
    removeCachedRecentSubmissions,
    cacheLastAcceptedSubmission,
    removeCachedLastAcceptedSubmission,

}