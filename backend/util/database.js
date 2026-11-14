import mongoose from "mongoose";

export async function connecterDB() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI manque dans le fichier .env.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connecté");
}