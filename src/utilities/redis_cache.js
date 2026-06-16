const stringify = require("fast-json-stable-stringify");

const numerical_keys = ["problem", "assessment"];

const generate_cache_key = (obj) => {
    for(let i of numerical_keys){
        if(obj.hasOwnProperty(i)) obj[i] = (Number(obj[i])?Number(obj[i]):obj[i]);
    }
    return stringify(obj);
}


module.exports = {generate_cache_key};