require("dotenv").config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
  try {
    const authHeader = req.get("Authorization");
    if (!authHeader)
      throw createError(401, "Authentication failed: No token provided");

    const token = authHeader.split(" ")[1];
    if (!token)
      throw createError(401, "Authentication failed: Invalid token format");

    const decodedToken = jwt.verify(token, JWT_SECRET);
    req.userId = decodedToken.userId;
    next();
  } catch (err) {
    next(handleError(err));
  }
};

// Utility function for creating errors
const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Utility function to handle errors
const handleError = (err) => {
  if (!err.statusCode) err.statusCode = 500;
  return err;
};
