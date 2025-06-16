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
  return await bcrypt.hash(password, saltRounds);
};

// ✅ Clean and reusable
exports.getComparePassword = async function (plainPassword, hashedPassword) {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (err) {
    console.error("Password compare error:", err);
    return false;
  }
};

