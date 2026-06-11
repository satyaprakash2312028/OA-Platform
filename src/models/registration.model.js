const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const registrationSchema = new Schema({
  // Link to the Assessment being registered for
  assessment: {
    type: Number,
    ref: 'Assessment', // References your Assessment model
    required: [true, 'Assessment ID is required for registration'],
    index: true,
  },

  // Link to the Team that is registering
  team: {
    type: Schema.Types.ObjectId,
    ref: 'Team', // References your Team model
    required: [true, 'Team ID is required for registration'],
    index: true,
  },

  user: {
    type: Schema.Types.ObjectId,
    ref: 'User', // References your Team model
    required: [true, 'Team ID is required for registration'],
    index: true,
  },

  isPending: {
    type: Boolean,
    required: true,
    default: true
  }

}, { timestamps: true });
registrationSchema.index({ user: 1, assessment: 1 }, { unique: true });
const Registration = model('Registration', registrationSchema);

module.exports = {Registration};