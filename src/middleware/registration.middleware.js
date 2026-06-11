const registration_fields_validation = (req, res, next) => {
    const {teamName, assessmentId, existingTeamID} = req.body;
    const user = req.user;
    if(!teamName || teamName.trim().length<=0) return res.status(400).json({ message: "Team name isn't provided." });
    if(!assessmentId || assessmentId.trim().length<=0) return res.status(400).json({ message: "Assessment ID isn't provided." });
    next();
}

module.exports = {registration_fields_validation};