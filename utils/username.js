const randomUser = () => {
  let digits = "1234567890";
  let code = "RFX"; 

  for (let i = 0; i < 5; i++) {
    let index = Math.floor(Math.random() * digits.length);
    code += digits.charAt(index);
  }

  return code;
};

module.exports = randomUser;
