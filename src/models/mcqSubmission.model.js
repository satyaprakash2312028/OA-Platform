const { Schema, model } = require("mongoose");
const mcqSubmissionSchema = new Schema({
    mcq: {
        type: Schema.Types.ObjectId,
        ref: "Mcq", 
        required: true
    },
    user: { 
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    assessment: {
        type: Number,
        ref: 'Assessment',
        required: false
    },
    optionsSelected: {
        type: Number,
        required: true
    },
    isCorrect: {
        type: Boolean,
        required: true,
        default: false
    }
},
    {timestamps: true}
);

const McqSubmission = model("McqSubmission", mcqSubmissionSchema);
module.exports = {McqSubmission};