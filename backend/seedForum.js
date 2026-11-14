import "dotenv/config";
import mongoose from "mongoose";
import { connecterDB } from "./util/database.js";
import Etablissement from "./models/Etablissement.js";

const etablissements = [
  { nom: "Collège Montmorency", type: "cegep" },
  { nom: "Collège Ahuntsic", type: "cegep" },
  { nom: "Collège de Bois-de-Boulogne", type: "cegep" },
  { nom: "Collège Dawson", type: "cegep" },
  { nom: "Université Concordia", type: "universite" },
  { nom: "Université du Québec à Montréal", type: "universite" },
  { nom: "Université de Montréal", type: "universite" },
  { nom: "École de technologie supérieure", type: "universite" },
];

try {
  await connecterDB();

  for (const etablissement of etablissements) {
    await Etablissement.updateOne(
      { nom: etablissement.nom },
      { $setOnInsert: etablissement },
      { upsert: true, runValidators: true }
    );
  }

  console.log("Les 8 établissements du forum sont prêts.");
} catch (erreur) {
  console.error(erreur.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}