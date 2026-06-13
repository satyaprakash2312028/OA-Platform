const withTimeout = async(main_promise, duration = 2500, error_message = 'Failed due to timeout') => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(error_message);
        }, duration);
    });

    return Promise.race(
        [timeoutPromise, main_promise], 
    ).finally(() => {
        clearTimeout(timeoutId);
    })
}

module.exports = {withTimeout}