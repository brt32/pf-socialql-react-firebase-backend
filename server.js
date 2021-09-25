const express = require("express");
const { ApolloServer, PubSub } = require("apollo-server-express");
const http = require("http");
const path = require("path");
const {
  fileLoader,
  mergeTypes,
  mergeResolvers,
} = require("merge-graphql-schemas");
const mongoose = require("mongoose");
require("dotenv").config();
const { authCheck, authCheckMiddleware } = require("./helpers/auth");
const cors = require("cors");
const cloudinary = require("cloudinary");

const pubsub = new PubSub();

const app = express();
const db = async () => {
  try {
    const success = await mongoose.connect(process.env.DATABASE_CLOUD, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      //   useCreateIndex: true,
      //   useFindAndModify: false,
    });
    console.log("DB Connected");
  } catch (error) {
    console.log("DB Connection Error", error);
  }
};

db();

// middlewares
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// types query / mutatuion / susbscriptio
const typeDefs = mergeTypes(fileLoader(path.join(__dirname, "./typeDefs")));

// resolvers
const resolvers = mergeResolvers(
  fileLoader(path.join(__dirname, "./resolvers"))
);

// graphql server
let apolloServer = null;
async function startServer() {
  apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ req, pubsub }),
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({ app });
}
startServer();

// applyMiddleware method connects ApolloServer to express

// server
const httpServer = http.createServer(app);

apolloServer.installSubscriptionHandlers(httpServer);

// rest endpoint
app.get("/rest", authCheck, function (req, res) {
  res.json({
    data: "you hit rest endpoint",
  });
});

// cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// upload images
app.post("/uploadimages", authCheckMiddleware, (req, res) => {
  cloudinary.uploader.upload(
    req.body.image,
    (result) => {
      res.status(200).send({
        url: result.url,
        public_id: result.public_id,
      });
    },
    {
      public_id: `${Date.now()}`,
      resource_type: "auto",
    }
  );
});

//remove images
app.post("/removeimage", authCheckMiddleware, (req, res) => {
  let image_id = req.body.public_id;
  cloudinary.uploader.destroy(image_id, (error, result) => {
    if (error) return res.json({ success: false, error });
    res.send("ok");
  });
});

httpServer.listen(process.env.PORT, function () {
  console.log(
    `Express server is ready at http://localhost:${process.env.PORT}`
  );
  console.log(
    `GraphQL server is ready at http://localhost:${process.env.PORT}${apolloServer.graphqlPath}`
  );
  console.log(
    `Subscription is ready at http://localhost:${process.env.PORT}${apolloServer.subscriptionsPath}`
  );
});
