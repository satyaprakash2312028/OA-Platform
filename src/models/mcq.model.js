const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const mcqSchema = new Schema({
  // The text of the question
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
  },

  // Array storing the four options as strings
  options: {
    type: [String], // Defines an array where each element must be a String
    required: true,
    validate: [
      {
        validator: function(opts) {
          // Ensure there are exactly 4 options
          return opts && opts.length === 4;
        },
        message: 'Exactly four options are required.'
      },
      {
        validator: function(opts) {
          // Ensure no option is an empty string (optional but good practice)
          return opts.every(opt => opt && opt.trim().length > 0);
        },
        message: 'Options cannot be empty strings.'
      }
    ]
  },

  // Store the 0-based index of the correct answer within the 'options' array
  correctAnswerIndex: {
    type: Number,
    required: [true, 'Correct answer index is required'],
    min: [0, 'Correct answer index cannot be less than 0'],
    max: [3, 'Correct answer index cannot be greater than 3'],
    validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value for the correct answer index.'
    }
  },

  // Optional: Explanation for why the answer is correct
  explanation: {
    type: String,
    trim: true,
  },

  assessment: {
    type: Number,
    ref: "Assessment",
    required: true
  }

}, { timestamps: true }); // Automatically add createdAt and updatedAt

const Mcq = model('Mcq', mcqSchema);

// Export using CommonJS
module.exports = {Mcq}; // Or module.exports = { Mcq }; if you prefer destructuring