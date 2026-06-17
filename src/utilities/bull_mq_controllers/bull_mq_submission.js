const {push_submission} = require('../../lib/queue.js')
const { REDIS_CONSTANTS } = require('../redis_controllers/redis_constants.js')
const {withTimeout} = require('../timeout_handler/timeout_wrapper.js')
const sendSubmissionToQueue = async(payload) => {
    try{
        const job = await withTimeout(push_submission.add('process_submission', payload, {
            attempts: 1,
            removeOnComplete: 20
        }));
        console.log(`[Producer] Added job ${job.id} to queue`);
    }catch(error){
        console.log('Delayed submission to the queue: ' + error);
    }
}

module.exports = {sendSubmissionToQueue};