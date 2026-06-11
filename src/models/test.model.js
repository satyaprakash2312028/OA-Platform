const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const testSchema = new Schema({
  // Link to the Problem document
  problem: {
    type: Number,
    ref: 'Problem', // References the 'Problem' model you defined
    required: [true, 'Test case must belong to a problem'],
    index: true // Helps find test cases for a specific problem faster
  },

  // Location of the input file in object storage (e.g., R2 bucket key)
  path: {
    type: String,
    required: [true, 'file path is required'],
    trim: true
  },

}, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

const Test = model('Test', testSchema);

module.exports = {Test}; // Export the model