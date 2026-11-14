import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Utilisateur from "../models/Utilisateur.js";
import Publication from "../models/Publication.js";
import Commentaire from "../models/Commentaire.js";

import {
  erreurHttp,
  gererAsync,
  utilisateurConnecte,
} from "../util/forumUtils.js";

function verifierSecret() {
  if (!process.env.JWT_SECRET) {
    throw erreurHttp("Configuration JWT manquante.", 500);
  }
}

function creerToken(utilisateur) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: utilisateur._id.toString(),
    algorithm: "HS256",
    expiresIn: "24h",
  });
}

function comptePublic(utilisateur) {
  return {
    _id: utilisateur._id,
    pseudo: utilisateur.pseudo,
    courriel: utilisateur.courriel,
  };
}

function nettoyerCourriel(courriel) {
  if (typeof courriel !== "string") {
    throw erreurHttp("Le courriel est requis.", 400);
  }

  const valeur = courriel.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur)) {
    throw erreurHttp("Le courriel est invalide.", 400);
  }

  return valeur;
}

function nettoyerPseudo(pseudo) {
  if (typeof pseudo !== "string") {
    throw erreurHttp("Le pseudo est requis.", 400);
  }

  const valeur = pseudo.trim();

  if (valeur.length < 2 || valeur.length > 40) {
    throw erreurHttp("Le pseudo doit contenir entre 2 et 40 caractères.", 400);
  }

  return valeur;
}

// POST /api/auth/inscription
export const inscrire = gererAsync(async (req, res) => {
  verifierSecret();

  const pseudo = nettoyerPseudo(req.body?.pseudo);
  const courriel = nettoyerCourriel(req.body?.courriel);
  const motDePasse = req.body?.motDePasse;

  if (
    typeof motDePasse !== "string" ||
    motDePasse.length < 8 ||
    Buffer.byteLength(motDePasse, "utf8") > 72
  ) {
    throw erreurHttp(
      "Le mot de passe doit contenir au moins 8 caractères et au maximum 72 octets.",
      400
    );
  }

  const existe = await Utilisateur.exists({ courriel });

  if (existe) {
    throw erreurHttp("Ce courriel est déjà utilisé.", 409);
  }

  const motDePasseHash = await bcrypt.hash(motDePasse, 12);

  const utilisateur = await Utilisateur.create({
    pseudo,
    courriel,
    motDePasseHash,
  });

  res.status(201).json({
    utilisateur: comptePublic(utilisateur),
    token: creerToken(utilisateur),
  });
});

// POST /api/auth/connexion
export const connecter = gererAsync(async (req, res) => {
  verifierSecret();

  const courriel = nettoyerCourriel(req.body?.courriel);
  const motDePasse = req.body?.motDePasse;

  if (
    typeof motDePasse !== "string" ||
    !motDePasse ||
    Buffer.byteLength(motDePasse, "utf8") > 72
  ) {
    throw erreurHttp("Courriel ou mot de passe incorrect.", 401);
  }

  const utilisateur = await Utilisateur.findOne({ courriel })
    .select("+motDePasseHash");

  const valide = utilisateur
    ? await bcrypt.compare(motDePasse, utilisateur.motDePasseHash)
    : false;

  if (!valide) {
    throw erreurHttp("Courriel ou mot de passe incorrect.", 401);
  }

  res.status(200).json({
    utilisateur: comptePublic(utilisateur),
    token: creerToken(utilisateur),
  });
});

// GET /api/auth/moi
export const obtenirMonCompte = gererAsync(async (req, res) => {
  const id = utilisateurConnecte(req);
  const utilisateur = await Utilisateur.findById(id);

  if (!utilisateur) {
    throw erreurHttp("Utilisateur introuvable.", 404);
  }

  res.status(200).json(comptePublic(utilisateur));
});

// PATCH /api/auth/moi
export const modifierMonCompte = gererAsync(async (req, res) => {
  const id = utilisateurConnecte(req);
  const donnees = req.body ?? {};

  const utilisateur = await Utilisateur.findById(id)
    .select("+motDePasseHash");

  if (!utilisateur) {
    throw erreurHttp("Utilisateur introuvable.", 404);
  }

  const changePseudo = Object.hasOwn(donnees, "pseudo");
  const changeCourriel = Object.hasOwn(donnees, "courriel");

  if (!changePseudo && !changeCourriel) {
    throw erreurHttp("Aucune modification fournie.", 400);
  }

  if (changePseudo) {
    utilisateur.pseudo = nettoyerPseudo(donnees.pseudo);
  }

  if (changeCourriel) {
    const courriel = nettoyerCourriel(donnees.courriel);

    // Une modification du courriel nécessite le mot de passe actuel.
    if (courriel !== utilisateur.courriel) {
      const valide =
        typeof donnees.motDePasseActuel === "string" &&
        Buffer.byteLength(donnees.motDePasseActuel, "utf8") <= 72 &&
        await bcrypt.compare(
          donnees.motDePasseActuel,
          utilisateur.motDePasseHash
        );

      if (!valide) {
        throw erreurHttp("Mot de passe actuel incorrect.", 401);
      }

      const existe = await Utilisateur.exists({
        courriel,
        _id: { $ne: utilisateur._id },
      });

      if (existe) {
        throw erreurHttp("Ce courriel est déjà utilisé.", 409);
      }

      utilisateur.courriel = courriel;
    }
  }

  await utilisateur.save();

  res.status(200).json(comptePublic(utilisateur));
});

// DELETE /api/auth/moi
export const supprimerMonCompte = gererAsync(async (req, res) => {
  const id = utilisateurConnecte(req);
  const motDePasseActuel = req.body?.motDePasseActuel;

  const utilisateur = await Utilisateur.findById(id)
    .select("+motDePasseHash");

  if (!utilisateur) {
    throw erreurHttp("Utilisateur introuvable.", 404);
  }

  const valide =
    typeof motDePasseActuel === "string" &&
    Buffer.byteLength(motDePasseActuel, "utf8") <= 72 &&
    await bcrypt.compare(
      motDePasseActuel,
      utilisateur.motDePasseHash
    );

  if (!valide) {
    throw erreurHttp("Mot de passe actuel incorrect.", 401);
  }

  const publications = await Publication.find({ auteur: id })
    .select("_id");

  const publicationIds = publications.map((publication) => publication._id);

  // Supprime ses commentaires et ceux sous ses publications.
  await Commentaire.deleteMany({
    $or: [
      { auteur: id },
      { publication: { $in: publicationIds } },
    ],
  });

  await Publication.deleteMany({ auteur: id });
  await utilisateur.deleteOne();

  res.status(200).json({
    message: "Compte, publications et commentaires supprimés.",
  });
});