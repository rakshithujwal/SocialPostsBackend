const User = require("../models/user");
const bcrypt = require("bcryptjs");
const validator = require("validator");

module.exports = {
  createUser: async function (args, req) {
    const { email, name, password } = args.userInput;

    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({
        message: "E-mail is invalid",
      });
    }

    if (
      validator.isEmpty(password) ||
      !validator.isLength(password, { min: 5 })
    ) {
      errors.push({
        message: "Password Too Short",
      });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid Input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      const error = new Error("User exists Already!");
      throw error;
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email: email,
      name: name,
      password: hashedPassword,
    });
    const createdUser = await user.save();

    return {
      ...createdUser._doc,
      _id: createdUser._id.toString(),
    };
  },
};
