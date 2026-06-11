const {client} = require("../../lib/redis.js");

class redis_parent_class {
    static client = client;
    constructor() {
    }
}

module.exports = {redis_parent_class};