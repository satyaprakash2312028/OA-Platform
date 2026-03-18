const {client} = require("../lib/redis.js");

// use redis hashset instead of string for caching submission pages and assessment info to allow more granular cache invalidation
// major top level keys are: assessment, problem, registration, submission, team, teamScore, test, user
// add expiration time of 30 minutes for all caches to prevent stale data and memory bloat in redis
const cachedSubmissionPages = async (req, res, next) => {
    // rectify and use hashset for caching submission pages to allow more granular cache invalidation based on page number and user id
    // cache key format: problem:submissions:pages:{userId}:{pageNumber}

    const cacheKey = `problem:submissions:page:${req.params.pageNumber}`;
    const cachedData = await client.hget(`submission:${req.user._id}`, cacheKey).catch((err) => { // use get instead of hget since we are using string for caching submission pages to simplify implementation and avoid issues with JSON stringification of hashset values
        console.error("Error fetching cached submission pages:", err);
        return next();
    });
    if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
    }   
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {    
            // cache the submission pages for the user with an expiration time of 30 minutes
            client.hset(`submission:${req.user._id}`, cacheKey, body).catch((err) => {
                console.error("Error caching submission pages:", err);
            });
            client.expire(`submission:${req.user._id}`, 1800); // Set expiration time to 30 minutes
        }
        originalSend.call(this, body);
    }
    next();
}

const removeCachedSubmissionPages = async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            // delete all submission page caches for the user
            console.log("Removing cached submission pages for userId:", req.user._id);
            client.del(`submission:${req.user._id}`).catch((err) => {
                console.error("Error removing cached submission pages:", err);
            });
        }
        originalSend.call(this, body);
    }
    next();
}

const cachedAssessmentInfo = async (req, res, next) => {
    const cacheKey = `problem:assessmentInfo:${req.user._id}`;
    const cachedData = await client.hget(`assessment:${req.params.assessmentId}`, cacheKey).catch((err) => {
        console.error("Error fetching cached assessment info:", err);
        return next();
    });
    if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
    }
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            // cache the assessment info for the user with an expiration time of 30 minutes
            
            client.hset(`assessment:${req.params.assessmentId}`, cacheKey, body).catch((err) => {
                console.error("Error caching assessment info:", err);
            });
            client.expire(`assessment:${req.params.assessmentId}`, 1800);
        }
        originalSend.call(this, body);
    }
    next();
}

const removeCachedAssessmentInfo = async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300 && req.body.assessment) {
            // delete all assessment info caches for the assessment
            // remove only when req.body.assessment is not null or undefined to prevent accidental cache deletion due to client errors
            console.log("Removing cached assessment info for assessmentId:", req.body.assessment);
            if(req.body.assessment) {
                client.del(`assessment:${req.body.assessment}`).catch((err) => {
                    console.error("Error removing cached assessment info:", err);
                });
            }
        }
        originalSend.call(this, body);
    }
    next();
}

const cachedProblemDetails = async (req, res, next) => {
    const cacheKey = `problem:details:${req.params.id}`;
    const cachedData = await client.get(cacheKey).catch((err) => {
        console.error("Error fetching cached problem details:", err);
        return next();
    });
    if (cachedData) {
        console.log("Fetching cached problem details:", cacheKey);
        return res.status(200).json(JSON.parse(cachedData));
    }
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            client.setex(cacheKey, 3600, body).catch((err) => {
                console.error("Error caching problem details:", err);
            });
        }
        originalSend.call(this, body);
    }
    next();
}

const cachedProblemSet = async (req, res, next) => {
    let cacheKey = `problemSet:page:${req.user._id}:${req.params.pageNumber}`;
    const cachedData = await client.hget(`problem`, cacheKey).catch((err) => {
        console.error("Error fetching cached problem set:", err);
        return next();
    });
    if (cachedData) {
        console.log("Fetching cached problem set:", cacheKey);
        return res.status(200).json(JSON.parse(cachedData));
    }
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            // cache the problem set for the user with an expiration time of 30 minutes
            client.hset(`problem`, cacheKey, body).catch((err) => {
                console.error("Error caching problem set:", err);
            });
            client.expire(`problem`, 1800);
        }
        originalSend.call(this, body);
    }
    next();
}

const removeCachedProblemSet = async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            // delete all problem set caches for the user
            client.hdel('problem').catch((err) => {
                console.error("Error removing cached problem set:", err);
            }); 

        }
        originalSend.call(this, body);
    }
    next();
}

const cachedCode = async (req, res, next) => {
    const cacheKey = `problem:code:${req.params.submissionId}`;
    const cachedData = await client.get(cacheKey).catch((err) => {
        console.error("Error fetching cached code:", err);
        return next();
    }
    );
    if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
    }   
    const originalSend = res.send;  
    res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            client.setex(cacheKey, 1800, body).catch((err) => {
                console.error("Error caching code:", err);
            });
        }
        originalSend.call(this, body);
    }
    next();
}

const populateSolvedSet = async(req, res, next) => {
    // populate the solved set in redis for the user if it doesn't exist or is empty
    const cacheKey = `solved:${req.user._id}`;
    if(await client.exists(cacheKey) === 0 ) {
        // cache isnt populated yet, populate it with all problemIds that the user has solved
        const solvedSubmissions = await Submission.find({
            user: req.user._id,
            status: "Accepted"
        }).select("problem");

        if(solvedSubmissions.length > 0) {
            const temp = solvedSubmissions.map(s => s.problem.toString());
            await client.sadd(cacheKey, temp);
        }
    }
    next();
}

module.exports = {
    cachedSubmissionPages,
    removeCachedSubmissionPages,
    cachedAssessmentInfo,
    cachedProblemDetails,
    cachedProblemSet,
    removeCachedProblemSet,
    removeCachedAssessmentInfo,
    cachedCode,
    populateSolvedSet
}


