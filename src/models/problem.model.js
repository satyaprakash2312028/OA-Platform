const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// 1. Create a shared Counter Schema safely
const counterSchema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 999999 } // Starts at 999999 so the first increment yields 1000000
});
const Counter = mongoose.models.Counter || model('Counter', counterSchema);

const problemSchema = new Schema(
    {
        _id: { 
            type: Number 
        },
        problemId: {
            type: Number,
            required: [true, 'Problem ID is required'],
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
        },
        timeLimit: {
            type: Number,
            required: true,
            min: [0.25],
            max: [12]
        },
        memoryLimit: {
            type: Number,
            required: true,
            min: [64],
            max: [1024],
        },
        htmlDescription: {
            type: String,
            required: true
        },
        isPrivate: {
            type: Boolean,
            required: true,
            default: true
        },
        interactor: {
            type: String,
            required: false,
            default: null
        },
        checker: {
            type: String,
            required: false,
            default: null
        },
        assessment: {
            type: Number,
            ref: "Assessment",
            required: false
        },
        points: {
            type: Number,
            required: true,
            default: 1500
        }
    },
    { timestamps: true }
);

// 2. Pre-save hook to handle the auto-increment atomically
problemSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            const counter = await Counter.findByIdAndUpdate(
                'problem_seq', // Unique identifier for the Problem counter
                { $inc: { seq: 1 } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            this._id = counter.seq;
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

const Problem = model("Problem", problemSchema);
module.exports = { Problem, Counter };