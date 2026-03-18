const { z } = require('zod');

// 1. Define the base shape first. 
// We extract this so we can easily reuse it for the update schema later.
const assessmentBodyShape = z.object({
  title: z
    .string({ required_error: 'Assessment title is required' })
    .trim()
    .min(1, 'Title cannot be empty'),
  
  description: z
    .string()
    .trim()
    .optional(),
  
  // z.coerce.date() takes the incoming JSON string (e.g., "2026-03-12T10:00:00Z") 
  // and automatically turns it into a real JS Date object.
  startTime: z.coerce
    .date({
      required_error: 'Start time is required',
      invalid_type_error: 'Invalid start time format',
    }),
  
  endTime: z.coerce
    .date({
      required_error: 'End time is required',
      invalid_type_error: 'Invalid end time format',
    }),
  
  maxTeamSize: z
    .number()
    .int('Max team size must be an integer')
    .min(1, 'Max team size must be at least 1')
    .max(5, 'Max team size cannot exceed 5')
    .optional(), // Optional because Mongoose will default it to 1
}).strict(); // Reject unknown fields

// 2. Schema for CREATING an assessment
const createAssessmentSchema = z.object({
  body: assessmentBodyShape.refine(
    (data) => data.endTime > data.startTime, 
    {
      message: 'End time must be after start time',
      path: ['endTime'], // Attaches the error specifically to the endTime field
    }
  ),
});

module.exports = {
  createAssessmentSchema,
};