import jwt from "jsonwebtoken";
import Utilisateur from "../models/Utilisateur.js";

import {
  erreurHttp,
  gererAsync,
} from "./forumUtils.js";

export const authentifier = gererAsync(async (req, res, next) => {
  const authorization = req.get("Authorization");

  const correspondance = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!correspondance) {
    throw erreurHttp("Connexion requise : token manquant.", 401);
  }

  if (!process.env.JWT_SECRET) {
    throw erreurHttp("Configuration JWT manquante.", 500);
  }

  const token = correspondance[1];
  let donnees;

  try {
    donnees = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw erreurHttp("Token invalide ou expiré.", 401);
  }

  // Le token doit contenir l’identifiant utilisateur dans « sub ».
  const utilisateurId = donnees?.sub;

  if (
    typeof utilisateurId !== "string" ||
    !/^[a-f\d]{24}$/i.test(utilisateurId)
  ) {
    throw erreurHttp("Token invalide.", 401);
  }

  const utilisateur = await Utilisateur.findById(utilisateurId)
    .select("_id pseudo");

  if (!utilisateur) {
    throw erreurHttp("Utilisateur introuvable.", 401);
  }

  req.user = utilisateur;
  next();
});