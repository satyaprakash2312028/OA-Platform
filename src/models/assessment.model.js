const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const assessmentSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Assessment title is required'],
    trim: true,
    unique: true, // Assuming assessment titles should be unique
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
        // Ensure end time is after start time
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
const Assessment = model('Assessment', assessmentSchema);

module.exports = {Assessment}; // Or { Assessment }