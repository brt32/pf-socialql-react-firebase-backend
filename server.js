const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const http = require("http");
const path = require("path");
const {
  fileLoader,
  mergeTypes,
  mergeResolvers,
} = require("merge-graphql-schemas");
const mongoose = require("mongoose");
require("dotenv").config();
const { authCheck } = require("./helpers/auth");

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
    context: ({ req, res }) => ({ req, res }),
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({ app });
}
startServer();

// applyMiddleware method connects ApolloServer to express

// server
const httpServer = http.createServer(app);

// rest endpoint
app.get("/rest", authCheck, function (req, res) {
  res.json({
    data: "you hit rest endpoint",
  });
});

app.listen(process.env.PORT, function () {
  console.log(
    `Express server is ready at http://localhost:${process.env.PORT}`
  );
  console.log(
    `GraphQL server is ready at http://localhost:${process.env.PORT}${apolloServer.graphqlPath}`
  );
});
