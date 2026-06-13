const mongoose = require('mongoose');
const { Schema, model } = mongoose;

// 1. Create a shared Counter Schema safely
const counterSchema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 999999 } // Starts at 999999 so the first increment yields 1000000
});
const Counter = mongoose.models.Counter || model('Counter', counterSchema);

const assessmentSchema = new Schema({
  _id: { 
    type: Number 
  },
  title: {
    type: String,
    required: [true, 'Assessment title is required'],
    trim: true,
    unique: true, 
  },
  description: {
    type: String,
    trim: true,
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required'],
    index: true,
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required'],
    validate: {
      validator: function(value) {
        return this.startTime < value;
      },
      message: 'End time must be after start time.'
    },
    index: true,
  },
  maxTeamSize: {
    type: Number,
    min: 1,
    max: 5,
    default: 1,
  }
}, { timestamps: true });

// 2. Pre-save hook to handle the auto-increment atomically
assessmentSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            const counter = await Counter.findByIdAndUpdate(
                'assessment_seq', // Unique identifier for the Assessment counter
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

const Assessment = model('Assessment', assessmentSchema);
module.exports = { Assessment };