const {push_submission} = require('../../lib/queue.js')
const { REDIS_CONSTANTS } = require('../redis_controllers/redis_constants.js')

const sendSubmissionToQueue = async(payload) => {
    const job = await push_submission.add('process_submission', payload, {attempts: 1});
    console.log(`[Producer] Added job ${job.id} to queue`);
}

module.exports = {sendSubmissionToQueue};