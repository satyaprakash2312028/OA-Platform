const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const teamSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
  },
  leader: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assessment:{
    type: Number,
    ref: 'Assessment',
    required: true
  }
}, { timestamps: true }); // Adds createdAt, updatedAt

teamSchema.index({ name: 1, assessment: 1 }, { unique: true });
const Team = model('Team', teamSchema);

module.exports = {Team}; // Or { Team }