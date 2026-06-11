const stringify = require("fast-json-stable-stringify");

const generate_cache_key = (obj) => {
    return stringify(obj);
}


module.exports = {generate_cache_key};