const path = require("path");
const fs = require("fs");

// Utility function to delete images
const clearImage = (filePath) => {
  const fullPath = path.join(__dirname, "..", filePath);
  fs.unlink(fullPath, (err) => {
    if (err) console.log("Error while deleting image:", err);
  });
};

exports.clearImage = clearImage;
