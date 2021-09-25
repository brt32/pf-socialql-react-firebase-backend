const { gql } = require("apollo-server-express");
const { posts } = require("../temp");
const { authCheck } = require("../helpers/auth");
const { DateTimeResolver } = require("graphql-scalars");
const Post = require("../models/post");
const User = require("../models/user");

// subscriptions
const POST_ADDED = "POST_ADDED";
const POST_UPDATED = "POST_UPDATED";
const POST_DELETED = "POST_DELETED";

// mutation
const postCreate = async (parent, args, { req, pubsub }) => {
  const currentUser = await authCheck(req);
  // validation
  if (args.input.content.trim() === "") throw new Error("Content is required");

  const currentUserFromDb = await User.findOne({
    email: currentUser.email,
  });
  let newPost = await new Post({
    ...args.input,
    postedBy: currentUserFromDb._id,
  })
    .save()
    .then((post) => post.populate("postedBy", "_id username"));

  pubsub.publish(POST_ADDED, { postAdded: newPost });

  return newPost;
};

const allPosts = async (parent, args) => {
  const currentPage = args.page || 1;
  const perPage = 6;

  return await Post.find({})
    .skip((currentPage - 1) * perPage)
    .populate("postedBy", "username _id")
    .limit(perPage)
    .sort({ createdAt: -1 })
    .exec();
};

const postsByUser = async (parent, args, { req }) => {
  const currentUser = await authCheck(req);
  const currentUserFromDb = await User.findOne({
    email: currentUser.email,
  }).exec();

  return await Post.find({ postedBy: currentUserFromDb })
    .populate("postedBy", "_id username")
    .sort({ createdAt: -1 });
};

const singlePost = async (parent, args) => {
  return await Post.findById({ _id: args.postId })
    .populate("postedBy", "_id username")
    .exec();
};

const postUpdate = async (parent, args, { req, pubsub }) => {
  const currentUser = await authCheck(req);
  if (args.input.content.trim() === "") throw new Error("Content is required");
  const currentUserFromDb = await User.findOne({
    email: currentUser.email,
  }).exec();
  const postToUpdate = await Post.findById({ _id: args.input._id }).exec();
  if (currentUserFromDb._id.toString() !== postToUpdate.postedBy._id.toString())
    throw new Error("Unauthorized");
  let updatedPost = await Post.findByIdAndUpdate(
    args.input._id,
    {
      ...args.input,
    },
    { new: true }
  )
    .exec()
    .then((post) => post.populate("postedBy", "_id username"));

  pubsub.publish(POST_UPDATED, {
    postUpdated: updatedPost,
  });

  return updatedPost;
};

const postDelete = async (parent, args, { req, pubsub }) => {
  const currentUser = await authCheck(req);
  const currentUserFromDb = await User.findOne({
    email: currentUser.email,
  }).exec();
  const postToDelete = await Post.findById({ _id: args.postId }).exec();
  if (currentUserFromDb._id.toString() !== postToDelete.postedBy._id.toString())
    throw new Error("Unauthorized action");
  let deletedPost = await Post.findByIdAndDelete({ _id: args.postId })
    .exec()
    .then((post) => post.populate("postedBy", "_id username"));

  pubsub.publish(POST_DELETED, {
    postDeleted: deletedPost,
  });

  return deletedPost;
};

const totalPosts = async (parent, args, { req }) => {
  return await Post.find({}).estimatedDocumentCount().exec();
};

const search = async (parent, { query }, { req }) => {
  return await Post.find({ $text: { $search: query } })
    .populate("postedBy", "username")
    .exec();
};

module.exports = {
  Query: {
    allPosts,
    postsByUser,
    singlePost,
    totalPosts,
    search,
  },
  Mutation: {
    postCreate,
    postUpdate,
    postDelete,
  },
  Subscription: {
    postAdded: {
      subscribe: (parent, args, { pubsub }) =>
        pubsub.asyncIterator([POST_ADDED]),
    },
    postUpdated: {
      subscribe: (parent, args, { pubsub }) =>
        pubsub.asyncIterator([POST_UPDATED]),
    },
    postDeleted: {
      subscribe: (parent, args, { pubsub }) =>
        pubsub.asyncIterator([POST_DELETED]),
    },
  },
};
