import Etablissement from "../models/Etablissement.js";
import { gererAsync } from "../util/forumUtils.js";

export const listerEtablissements = gererAsync(async (req, res) => {
  const etablissements = await Etablissement.find()
    .sort({ nom: 1 });

  res.status(200).json(etablissements);
});