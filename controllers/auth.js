require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Post = require("../models/post");
const User = require("../models/user");

const JWT_SECRET = process.env.JWT_SECRET;

// User Signup
exports.signup = async (req, res, next) => {
  try {
    console.log(req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError(422, "Validation failed", errors.array());
    }

    const { email, name, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({ name, email, password: hashedPassword });
    const result = await user.save();

    res
      .status(201)
      .json({ message: "User created successfully", userId: result._id });
  } catch (err) {
    next(handleError(err));
  }
};

// User Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) throw createError(401, "User not found");

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw createError(401, "Incorrect password");

    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.status(200).json({ token, userId: user._id.toString() });
  } catch (err) {
    next(handleError(err));
  }
};

// Get User Status
exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw createError(404, "User not found");

    res.status(200).json({ status: user.status });
  } catch (err) {
    next(handleError(err));
  }
};

// Update User Status
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const user = await User.findById(req.userId);
    if (!user) throw createError(404, "User not found");

    user.status = status;
    await user.save();

    res.status(200).json({ message: "User status updated successfully" });
  } catch (err) {
    next(handleError(err));
  }
};

// Utility function for creating errors
const createError = (statusCode, message, data = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (data) error.data = data;
  return error;
};

// Utility function to handle errors
const handleError = (err) => {
  if (!err.statusCode) err.statusCode = 500;
  return err;
};
