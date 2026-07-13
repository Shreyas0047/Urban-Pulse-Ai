const mongoose = require("mongoose");
const env = require("./env");
const { syncCityRegistry } = require("../services/cityRegistryService");
const { syncRoutingRegistry } = require("../services/routingRegistryService");
const { assertEnabledCitiesReady } = require("../services/cityActivationService");
const { assertEnabledCityRolloutsReady } = require("../services/cityRolloutService");

async function cleanupLegacyUserIndexes() {
  try {
    const usersCollection = mongoose.connection.collection("users");
    const indexes = await usersCollection.indexes();

    const emailIndex = indexes.find((index) => index.name === "email_1");
    if (emailIndex && (emailIndex.sparse !== true || emailIndex.unique !== true)) {
      await usersCollection.dropIndex("email_1");
    }
    await usersCollection.createIndex(
      { email: 1 },
      { name: "email_1", unique: true, sparse: true }
    );
  } catch (error) {
    if (error.codeName !== "NamespaceNotFound") {
      throw error;
    }
  }
}

async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is not configured. Connect this app to MongoDB Atlas before starting.");
  }

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000
  });
  await cleanupLegacyUserIndexes();
  await assertEnabledCitiesReady();
  await assertEnabledCityRolloutsReady();
  await syncCityRegistry();
  await syncRoutingRegistry();
}

module.exports = {
  connectDatabase
};
