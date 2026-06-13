const { z } = require('zod');

// A handy regex to ensure a string is a valid MongoDB ObjectId
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// Define the schema for creating a new problem
const createProblemSchema = z.object({
  body: z.object({
    problemId: z
      .number({ required_error: 'Problem ID is required' })
      .int('Problem ID must be an integer')
      .positive('Problem ID must be a positive number'),
    
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(1, 'Name cannot be empty'),
    
    timeLimit: z
      .number({ required_error: 'Time limit is required' })
      .min(0.25, 'Time limit must be at least 0.25')
      .max(12, 'Time limit cannot exceed 12'),
    
    memoryLimit: z
      .number({ required_error: 'Memory limit is required' })
      .min(64, 'Memory limit must be at least 64')
      .max(1024, 'Memory limit cannot exceed 1024'),
    
    htmlDescription: z
      .string({ required_error: 'HTML description is required' })
      .min(1, 'HTML description cannot be empty'),
    
    // The following fields have defaults in Mongoose, 
    // so it's perfectly safe to make them optional in the incoming request
    isPrivate: z
      .boolean()
      .optional(),
    
    interactor: z
      .string()
      .nullable()
      .optional(),
    
    checker: z
      .string()
      .nullable()
      .optional(),
    
    assessment: z
      .string()
      .nullable()
      .optional(),
    
    points: z
    .number()
    .int()
    .min(500, "Difficulty can't be less than 500")
    .max(2500, "Difficulty can't be more than 2500")
    .optional()
    
  }).strict(), // Rejects any unknown fields sent in the request body
});

module.exports = {
  createProblemSchema
};