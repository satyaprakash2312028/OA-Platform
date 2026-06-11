const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const submissionSchema = new Schema({
  // Link to the User who made the submission
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Assuming you have a 'User' model
    required: [true, 'Submission must belong to a user'],
    index: true,
  },

  // Link to the Problem being solved
  problem: {
    type: Number,
    ref: 'Problem', // Assuming you have a 'Problem' model
    required: [true, 'Submission must be for a specific problem'],
    index: true,
  },

  assessment: {
    type: Number,
    ref: 'Assessment',
    required: false
  },
  
  // The submitted code as a string
  // Consider storing large code in object storage and saving the path/key here instead
  code: {
    type: String,
    required: [true, 'Code submission cannot be empty'],
    trim: true,
  },

  // Language of the submitted code (e.g., 'cpp', 'javascript', 'python')
  language: {
    type: String,
    required: [true, 'Language must be specified'],
    enum: ['cpp', 'javascript', 'python', 'java'], // Example languages, adjust as needed
    trim: true,
  },

  // Current status of the submission
  status: {
    type: String,
    required: true,
    enum: [ // Define possible statuses
      'Pending', // Waiting in the queue
      'Judging', // Actively being processed by a worker
      'Accepted', // Passed all test cases
      'Wrong Answer',
      'Time Limit Exceeded',
      'Memory Limit Exceeded',
      'Compilation Error',
      'Runtime Error', // e.g., segfault, unhandled exception
      'Internal Error' // Error within the judge system itself
    ],
    default: 'Pending', // Default status when created
  },

  // Execution time in milliseconds (only relevant after judging)
  executionTime: {
    type: Number, // Could be float or integer
    min: 0,
    default: null, // Default to null before execution
  },

  // Memory usage in MB (only relevant after judging)
  memoryUsed: {
    type: Number, // Could be float or integer
    min: 0,
    default: null, // Default to null before execution
  },

}, { timestamps: true }); // Automatically adds createdAt and updatedAt

const Submission = model('Submission', submissionSchema);

module.exports = { Submission };