const get_code_field_validation = (req, res, next) => {
    const {id:submissionId} = req.params;
    if(!submissionId) return res.status(400).json({message: "Submission ID is required"});
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const submit_problem_field_validation = (req, res, next) => {
    const user = req.user;
    const {code, language, assessmentID} = req.body;
    const {id: problemId} = req.params;
    if(!code ||code.trim().length<=0) return res.status(400).json({message: "Code cannot be empty"});
    if(!language || language.trim().length<=0) return res.status(400).json({message: "Language cannot be empty"});
    if(language!="python" && language!="javascript" && language!="cpp"&& language!="java"){
        return res.status(400).json({message: "Unsupported language"});
    }
    next();
}

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const get_problem_field_validation = (req, res, next) => {
    const {id:problemId} = req.params;
    if(!problemId) return res.status(400).json({message: "Problem Id isn't provided"});
    next();
}


// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->



module.exports = {
    get_code_field_validation,
    submit_problem_field_validation,
    get_problem_field_validation,
}