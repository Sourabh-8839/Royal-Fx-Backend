// const bcrypt = require('bcryptjs')

// exports.getHashPassword = async function (password){
//     return await bcrypt.hash(password,10)
// }
// exports.getComparePassword = async function (user,password){
//     return await bcrypt.compare(password,user.password)
// }
const bcrypt = require('bcryptjs');

// Hash the password
exports.getHashPassword = async function (password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
};

// Compare the password
exports.getComparePassword = async function (user, password) {
    try {
        // user.password is the hashed password stored in DB
        const isMatch = await bcrypt.compare(password, user.password);
        return isMatch;
    } catch (err) {
        return false;
    }
};
