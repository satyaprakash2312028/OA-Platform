// src/lib/queue.js
// const amqp = require('amqplib');
const dotenv = require('dotenv');
const Redis = require("ioredis");
const { Queue } = require('bullmq');
const {REDIS_CONSTANTS} = require('../utilities/redis_controllers/redis_constants.js')
dotenv.config();
const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, 
    enableOfflineQueue: true,   
    retryStrategy: (times) => {
        if (times === 1 || times % 12 === 0) {
            console.warn(`[Queue Redis] Connection offline. Retrying... (Attempt ${times})`);
        }
        return 60000; 
    }
});

let isFirstError = true;

client.on('error', (error) => {
    console.error(error);
});

client.on('ready', () => {
    isFirstError = true;
    console.log("Redis reconnected");
})
// const CLOUDAMQP_URL = process.env.CLOUDAMQP_URL;
// const QUEUE_NAME = 'submissions'; // Must match your worker's queue name

// let channel = null;

// async function connectQueue() {
//   try {
//     const connection = await amqp.connect(CLOUDAMQP_URL);
//     channel = await connection.createChannel();
//     await channel.assertQueue(QUEUE_NAME, { durable: true });
//     console.log('[API] RabbitMQ connected and queue asserted.');
//   } catch (error) {
//     console.error('[API] Failed to connect to RabbitMQ:', error);
//     // Keep retrying
//     setTimeout(connectQueue, 5000);
//   }
// }

// async function sendSubmissionToQueue(submission) {
//   if (!channel) {
//     console.error('[API] RabbitMQ channel not available. Dropping submission.');
//     return;
//   }
//   try {
//     const submissionPayload = {
//       teamId: submission.teamId||null,
//       assessmentId: submission.assessmentId||null,
//       userId: submission.userId,
//       submissionId: submission.submissionId,
//       code: submission.code,
//       language: submission.language,
//       problemId: submission.problem,
//       timeLimit: submission.timeLimit,
//       memoryLimit: submission.memoryLimit
//     };
//     console.log("Payload to be sent to queue:", submissionPayload);
//     channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(submissionPayload)), {
//       persistent: true,
//     });
//     console.log(`[API] Sent submission ${submissionPayload.submissionId} to queue.`);
//   } catch (error) {
//     console.error(`[API] Failed to send submission ${submissionPayload.submissionId} to queue:`, error);
//   }
// }


// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const push_submission = new Queue(REDIS_CONSTANTS.PURPOSE.MAIN_SUBMISSION_QUEUE, {connection: client});




module.exports = {push_submission};