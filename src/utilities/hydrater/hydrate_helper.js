const {Registration} = require('../../models/registration.model.js');
const {Submission} = require('../../models/submission.model.js');
const {redis_controllers} = require('../redis_controllers/import.js')

const hydrate_problem = async(user_id) => {
    try{
        const result = await Submission.distinct('problem', {
            user: user_id,
            status: 'Accepted'
        }).lean();
        console.log('------------------------------------------------------------------filler------------------------------------------------------------------')
        console.log(result);
        await redis_controllers.redis_user.save_problem_to_solved_bitmap(user_id, result);
    }catch(error){
        console.log('Error while hydrating the problem bitmap'+error);
    }
}


const hydrate_assessment = async(user_id) => {
    try{
        const result = await Registration.distinct('assessment', {
            user: user_id,
            isPending: false
        }).lean();

        await redis_controllers.redis_user.save_to_user_given_contest_bitmap(user_id, result);
    }catch(error){
        console.log('Error while hydrating the problem bitmap'+error);
    }
}


module.exports = {hydrate_assessment, hydrate_problem}