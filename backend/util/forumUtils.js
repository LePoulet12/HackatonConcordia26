import mongoose from "mongoose";

export function erreurHttp(message, statusCode) {
  const erreur = new Error(message);
  erreur.statusCode = statusCode;
  return erreur;
}

export function verifierId(id, nom = "Identifiant") {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw erreurHttp(`${nom} invalide.`, 400);
  }
}

export function utilisateurConnecte(req) {
  const id = req.user?._id;

  if (!id) {
    throw erreurHttp("Connexion requise.", 401);
  }

  verifierId(id, "Utilisateur");
  return id;
}

export function verifierAuteur(auteur, utilisateurId) {
  if (auteur.toString() !== utilisateurId.toString()) {
    throw erreurHttp("Tu ne peux pas modifier ce contenu.", 403);
  }
}

export function gererAsync(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (erreur) {
      next(erreur);
    }
  };
}