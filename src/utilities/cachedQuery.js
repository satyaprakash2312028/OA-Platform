const mongoose = require('mongoose');
const {client} = require("../lib/redis.js");

// This utility extends Mongoose's Query prototype to add a .cache() method for easy Redis caching of query results.

const originalExec = mongoose.Query.prototype.exec;

// 1. Create the chainable .cache() method
mongoose.Query.prototype.cache = function (options = {}) {
    // Set a flag on the current query instance
    this._shouldCache = true;
    
    // Optionally allow passing a custom top-level hash key
    this._hashKey = options.key || this.model.modelName; 
    this._ttl = options.ttl || 3600; // default TTL of 1 hour for cache entries
    
    // Return 'this' to make it chainable: User.find().cache().exec()
    return this; 
};

mongoose.Query.prototype.exec = async function () {
    // 2. The Gatekeeper: If .cache() wasn't called, skip Redis entirely
    if (!this._shouldCache) {
        return await originalExec.apply(this, arguments);
    }

    // 3. Proceed with caching logic ONLY for opted-in queries
    const hashKey = this._hashKey;
    const queryField = JSON.stringify({
        query: this.getQuery(),
        collection: this.mongooseCollection.name,
        options: this.getOptions()
    });

    const cachedResult = await client.hget(hashKey, queryField);

    if (cachedResult) {
        console.log(`[Redis] Cache Hit for: ${hashKey}`);
        const parsedDoc = JSON.parse(cachedResult);
        return Array.isArray(parsedDoc)
            ? parsedDoc.map(doc => this.model.hydrate(doc))
            : this.model.hydrate(parsedDoc);
    }

    console.log(`[MongoDB] Cache Miss for: ${hashKey}`);
    const result = await originalExec.apply(this, arguments);

    if (result) {
        client.hset(hashKey, queryField, JSON.stringify(result));
        client.expire(hashKey, this._ttl); // Set expiration time for the cache entry
        // Optional: Add a default TTL for these hash keys if needed
    }

    return result;
};