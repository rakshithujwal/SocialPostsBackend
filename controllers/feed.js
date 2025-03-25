const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = async (req, res, next) => {
  try {
    const currentPage = parseInt(req.query.page, 10) || 1;
    const perPage = 2;

    const [totalItems, posts] = await Promise.all([
      Post.countDocuments(),
      Post.find()
        .populate("creator")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * perPage)
        .limit(perPage),
    ]);

    res.status(200).json({
      message: "Posts fetched successfully.",
      posts,
      totalItems,
      currentPage,
      totalPages: Math.ceil(totalItems / perPage),
    });
  } catch (err) {
    next(handleError(err));
  }
};

exports.createPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError(422, "Validation failed, entered data is incorrect.");
    }
    if (!req.file) {
      throw createError(422, "No image provided.");
    }

    const { title, content } = req.body;
    const imageUrl = req.file.path;

    const post = new Post({
      title,
      content,
      imageUrl,
      creator: req.userId,
    });

    await post.save();

    const user = await User.findById(req.userId);
    if (!user) throw createError(404, "User not found.");

    user.posts.push(post);
    await user.save();

    io.getIO().emit("posts", {
      action: "create",
      post: {
        ...post._doc,
        creator: {
          _id: req.userId,
          name: user.name,
        },
      },
    });

    res.status(201).json({
      message: "Post created successfully!",
      post,
      creator: { _id: user._id, name: user.name },
    });
  } catch (err) {
    next(handleError(err));
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) throw createError(404, "Could not find post.");

    res.status(200).json({ message: "Post fetched successfully.", post });
  } catch (err) {
    next(handleError(err));
  }
};

exports.updatePost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError(422, "Validation failed, entered data is incorrect.");
    }

    const { title, content, image } = req.body;
    let imageUrl = image;

    if (req.file) {
      imageUrl = req.file.path;
    }

    if (!imageUrl) {
      throw createError(422, "No file picked!");
    }

    const post = await Post.findById(req.params.postId).populate("creator");
    if (!post) throw createError(404, "Could not find post.");

    if (post.creator._id.toString() !== req.userId) {
      throw createError(403, "Not authorized.");
    }

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;
    const updatedPost = await post.save();

    io.getIO().emit("posts", {
      action: "update",
      post: updatedPost,
    });

    res
      .status(200)
      .json({ message: "Post updated successfully!", post: updatedPost });
  } catch (err) {
    next(handleError(err));
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const postId = req.params.postId;

    const post = await Post.findById(postId);
    if (!post) throw createError(404, "Could not find post.");

    if (post.creator.toString() !== req.userId) {
      throw createError(403, "Not authorized.");
    }

    clearImage(post.imageUrl);
    await Post.findByIdAndDelete(postId);

    const user = await User.findById(req.userId);
    if (user) {
      user.posts.pull(postId);
      await user.save();
      io.getIO().emit("posts", {
        action: "delete",
        post: postId,
      });
    }

    res.status(200).json({ message: "Post deleted successfully." });
  } catch (err) {
    next(handleError(err));
  }
};

// Utility function to delete images
const clearImage = (filePath) => {
  const fullPath = path.join(__dirname, "..", filePath);
  fs.unlink(fullPath, (err) => {
    if (err) console.log("Error while deleting image:", err);
  });
};

// Utility function for error handling
const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const handleError = (err) => {
  if (!err.statusCode) err.statusCode = 500;
  return err;
};
