require("dotenv").config();
const User = require("../models/user");
const Post = require("../models/post");

const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const { clearImage } = require("../util/file");

const JWT_SECRET = process.env.JWT_SECRET;

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
  login: async function ({ email, password }) {
    const user = await User.findOne({ email: email });

    if (!user) {
      const error = new Error("User not Found!");
      error.code = 401;
      throw error;
    }

    const isEqual = await bcrypt.compare(password, user.password);

    if (!isEqual) {
      const error = new Error(" Password is Incorrect.");
      error.code = 401;
      throw error;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return { token: token, userId: user._id.toString() };
  },

  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated");
      error.code = 401;
      throw error;
    }

    const { title, content, imageUrl } = postInput;

    const errors = [];
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({ message: "Title is Invalid" });
    }
    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({ message: "Content is Invalid" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid Input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid User");
      error.data = errors;
      error.code = 401;
      throw error;
    }

    const post = new Post({
      title: title,
      content: content,
      imageUrl: imageUrl,
      creator: user,
    });

    const createdPost = await post.save();

    user.posts.push(createdPost);
    await user.save();

    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },

  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated");
      error.code = 401;
      throw error;
    }
    if (!page) {
      page = 1;
    }
    const perPage = 2;
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate("creator");

    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalPosts,
    };
  },

  post: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated");
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },
  updatePost: async function ({ id, postInput }, req) {
    const { title, content, imageUrl, creator } = postInput;
    if (!req.isAuth) {
      const error = new Error("Not Authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not Authorized!");
      error.code = 403;
      throw error;
    }

    const errors = [];
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({ message: "Title is Invalid" });
    }
    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({ message: "Content is Invalid" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid Input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    post.title = title;
    post.content = content;
    if (imageUrl !== "undefined") {
      post.imageUrl = imageUrl;
    }

    const updatedPost = await post.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id);
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error("Not Authorized!");
      error.code = 403;
      throw error;
    }

    clearImage(post.imageUrl);
    await Post.findByIdAndDelete(id);
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();
    return true;
  },
  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("No user found!");
      error.code = 404;
      throw error;
    }

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("No user found!");
      error.code = 404;
      throw error;
    }
    user.status = status;
    await user.save();

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
};
