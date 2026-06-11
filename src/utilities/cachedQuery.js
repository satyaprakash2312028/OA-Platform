const mongoose = require('mongoose');
const {client} = require("../lib/redis.js");
const { generate_cache_key } = require('../utilities/redis_cache.js');
const { REDIS_CONSTANTS } = require('./redis_controllers/redis_constants.js');

const originalExec = mongoose.Query.prototype.exec;
mongoose.Query.prototype.cache = function (options = {}) {
    this._shouldCache = true;
    this._key = options.key || generate_cache_key({
        query: this.getQuery(),
        collection: this.mongooseCollection.name,
        options: this.getOptions(),
        operation: this.op
    }); 
    this._ttl = options.ttl || 3600;
    return this; 
};

mongoose.Query.prototype.hashCache = function (options = {}) {
    this._shouldHashCache = true;
    this._hashKey = options.key || generate_cache_key({
        entity: this.model.modelName,
        purpose: REDIS_CONSTANTS.PURPOSE.DB_CALLS_CACHING
    }); 
    this._ttl = options.ttl || 3600;
    return this; 
};

mongoose.Query.prototype.exec = async function () {
    if (!this._shouldCache&&!this._shouldHashCache) {
        return await originalExec.apply(this, arguments);
    }else if(this._shouldCache&&this._shouldHashCache){
        throw new Error("Cannot use both cache and hashCache on the same query");
    }
    const isLean = this._mongooseOptions && this._mongooseOptions.lean;
    if(this._shouldCache){  
        const key = this._key;
        const cachedResult = await client.get(key);

        if (cachedResult) {
            console.log(`[Redis] Cache Hit for: ${key}`);
            const parsedDoc = JSON.parse(cachedResult);
            if(isLean) return parsedDoc;
            return Array.isArray(parsedDoc)
                ? parsedDoc.map(doc => this.model.hydrate(doc))
                : this.model.hydrate(parsedDoc);
        }
        console.log(`[MongoDB] Cache Miss for: ${key}`);
        const result = await originalExec.apply(this, arguments);
        if(this._ttl > 0) client.set(key, JSON.stringify(result), 'EX', this._ttl).catch((error) => {
            console.log("Error in cached query on: "+ key +", "+ error);
        });
        else client.set(key, JSON.stringify(result)).catch((error) => {
            console.log("Error in cached query on: "+ key +", "+ error);
        });
        return result;
    }else{
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
            if(isLean) return parsedDoc;
            return Array.isArray(parsedDoc)
                ? parsedDoc.map(doc => this.model.hydrate(doc))
                : this.model.hydrate(parsedDoc);
        }
        console.log(`[MongoDB] Cache Miss for: ${hashKey}`);
        const result = await originalExec.apply(this, arguments);
        const client_pipeline = client.pipeline();

        client_pipeline.hset(hashKey, queryField, JSON.stringify(result));
        if(this._ttl > 0) client_pipeline.expire(hashKey, this._ttl)

        client_pipeline.exec().catch((error) => {
            console.log("Error in cached query on: "+ hashKey+", "+ error);
        });
        return result;
    }
};