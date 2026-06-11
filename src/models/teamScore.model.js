const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const teamScoreSchema = new Schema({
  team: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: [true, 'Team ID is required for team score'],
    index: true,
  },
  assessment: {
    type: Number,
    ref: 'Assessment',
    required: [true, 'Assessment ID is required for team score'],
    index: true,
  },
  score: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: true }); // Adds createdAt, updatedAt


const TeamScore = model('TeamScore', teamScoreSchema);

module.exports = {TeamScore}; // Or { Team }