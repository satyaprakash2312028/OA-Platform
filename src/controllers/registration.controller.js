const { generateToken} = require("../lib/utils.js");
const {User} = require("../models/user.model.js");
const bcrypt = require("bcryptjs");
const {cloudinary} = require("../lib/cloudinary.js");
const {Assessment} = require("../models/assessment.model.js");
const {Registration} = require("../models/registration.model.js");
const {Team} = require("../models/team.model.js");
const { mongoose } = require("mongoose");
const crypto = require('crypto');
const dotenv = require("dotenv");
dotenv.config();
const {generate_cache_key} = require("../utilities/redis_cache.js");
const {REDIS_CONSTANTS} = require("../utilities/redis_controllers/redis_constants.js");

// object id is 24 character long string
// basically it is a number written in base 16
// it is a 12 byte number where first 4 bytes are timestamp, next 5 bytes are random value and last 3 bytes are incrementing counter

// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
// const P = 13127;
// const modpow = (a, b) => {
//     let x = a;
//     let y = b;
//     x %= P;
//     let res = 1;
//     while(y > 0) {
//         if(y&1) res = (res*x)%P;
//         x = (x*x)%P;
//         y>>=1;
//     }
//     return res;
// }

// const modInverse = (a) => {
//     return modpow(a, P-2);
// }

// const encrypt_object_id = (string) => {
//     let res = '';
//     for(let i = 0; i<6; i++){
//         res += string.charAt(i+6);
//         res += string.charAt(i);
//         res += string.charAt(i+18);
//         res += string.charAt(i+12);
//     }
//     let encrypted_string = '';
//     for(let i = 0; i<8; i++){
//         let num = parseInt(res.substring(i*3, i*3+3), 16);
//         num = modInverse(num);
//         let hexString = num.toString(16);
//         hexString = hexString.padStart(4, '0');
//         hexString = hexString.split('').reverse().join('');
//         encrypted_string += hexString;
//     }
//     let final_string = '';
//     for(let i = 0; i<8; i++){
//         final_string += encrypted_string.charAt(i+24);
//         final_string += encrypted_string.charAt(i+8);
//         final_string += encrypted_string.charAt(i+16);
//         final_string += encrypted_string.charAt(i);
//     }
//     return final_string;
// }

// const decrypt_object_id = (encrypted_string) => {
//     let rearranged_string = new Array(32).fill('0');
//     for(let i = 0; i<8; i++){
//         rearranged_string[i+24] = encrypted_string.charAt(4*i);
//         rearranged_string[i+8] = encrypted_string.charAt(4*i+1);
//         rearranged_string[i+16] = encrypted_string.charAt(4*i+2);
//         rearranged_string[i] = encrypted_string.charAt(4*i+3);
//     }
//     rearranged_string = rearranged_string.join('');
//     let decrypted_string = '';
//     for(let i = 0; i<8; i++){
//         let hexString = rearranged_string.substring(i*4, i*4+4);
//         hexString = hexString.split('').reverse().join('');
//         let num = parseInt(hexString, 16);
//         num = modInverse(num);
//         decrypted_string += num.toString(16).padStart(3, '0');
//     }
//     let final_string = new Array(24).fill('0');
//     for(let i = 0; i<6; i++){
//         final_string[i+6] = decrypted_string.charAt(i*4);
//         final_string[i] = decrypted_string.charAt(i*4+1);
//         final_string[i+18] = decrypted_string.charAt(i*4+2);
//         final_string[i+12] = decrypted_string.charAt(i*4+3);
//     }
//     final_string = final_string.join('');

//     return final_string;
// }



// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

const SECRET_KEY = Buffer.from(process.env.AES_256_ECB_SECRET, 'utf-8');
const encrypt_object_id = (hexString) => {
    const bufferId = Buffer.from(hexString, 'hex');
    const cipher = crypto.createCipheriv('aes-256-ecb', SECRET_KEY, null);
    let encrypted = cipher.update(bufferId);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('base64url');
}

const decrypt_object_id = (encryptedString) => {
    const encryptedBuffer = Buffer.from(encryptedString, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-ecb', SECRET_KEY, null);
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('hex');
}
// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->


const register = async(req, res) => {
    try{
        const {teamName, assessmentId, existingTeamID} = req.body;
        const user = req.user;
        const assessment = await Assessment.findById(assessmentId)
        .lean()
        .cache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                assessment: assessmentId,
                purpose: REDIS_CONSTANTS.PURPOSE.ASSESSMENT_DETAILS_CACHING
            })
        });
        if(!assessment) return res.status(400).json({ message: "Assessment ID is wrong." });
        if(assessment.startTime<(new Date())) return res.status(400).json({ message: "Can't register for this contest." });
        let teamID;
        const regFlag = await Registration.findOne({
            user: user._id,
            assessment: assessmentId
        })
        .lean()
        .cache({
            ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
            key: generate_cache_key({
                user: user._id,
                assessment: assessmentId,
                purpose: REDIS_CONSTANTS.PURPOSE.REGISTRATION_DETAILS_CACHING
            })
        });
        if(regFlag) return res.status(400).json({message: "User is already registered for the contest."});
        if(!existingTeamID){
            const team = await Team.findOne({name: teamName, assessment:assessmentId})
            .lean()
            .cache({
                ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
                key: generate_cache_key({
                    team:{name: teamName},
                    assessment: assessmentId,
                    purpose: REDIS_CONSTANTS.PURPOSE.TEAM_DETAILS_CACHING_BY_NAME
                })
            });
            if(!team){
                const newTeam = new Team({
                    name: teamName,
                    leader: user._id,
                    assessment: assessmentId
                });
                await newTeam.save();
                teamID = newTeam._id;
            }else{
                return res.status(400).json({ message: "Team name already exists. Please choose a different name or join existing team." });
            }
        }else{
            if(!mongoose.Types.ObjectId.isValid(decrypt_object_id(existingTeamID))) return res.status(400).json({ message: "Team ID or Team name is wrong." });
            existingTeamID = decrypt_object_id(existingTeamID);
            const team = await Team.findById(existingTeamID)
            .lean()
            .cache({
                ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
                key: generate_cache_key({
                    team: existingTeamID,
                    purpose: REDIS_CONSTANTS.PURPOSE.TEAM_DETAILS_CACHING_BY_ID
                })
            });
            if(!team) return res.status(400).json({ message: "Team ID is wrong." });
            if(teamName&&team.name !== teamName) return res.status(400).json({message: "Team ID or Team name is wrong."});
            const memeberCount = await Registration.find({team:existingTeamID})
            .lean()
            .cache({
                ttl: REDIS_CONSTANTS.DURATION.ONE_DAY,
                key: generate_cache_key({
                    team: existingTeamID,
                    purpose: REDIS_CONSTANTS.PURPOSE.TEAM_MEMBERS_CACHING
                })
            });
            if(memeberCount.length >= assessment.maxTeamSize) return res.status(400).json({message: "Max team size reached already"});
            teamID = existingTeamID;
        }
        const newRegistration = new Registration({
            assessment: assessmentId,
            team: teamID,
            user: user._id,
            isPending: false
        });
        await newRegistration.save();
        const payload = newRegistration.toJSON();
        
        payload.team = encrypt_object_id(payload.team.toString());

        res.status(201).json(payload);
    }catch(error){
        console.log("Error in register controller.", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};



// <---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->



module.exports = {register};


