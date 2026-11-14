import Publication from "../models/Publication.js";
import Etablissement from "../models/Etablissement.js";
import Commentaire from "../models/Commentaire.js";

import {
  erreurHttp,
  verifierId,
  utilisateurConnecte,
  verifierAuteur,
  gererAsync,
} from "../util/forumUtils.js";

// GET /api/publications
export const listerPublications = gererAsync(async (req, res) => {
  const filtre = {};

  if (req.query.etablissement !== undefined) {
    verifierId(req.query.etablissement, "Établissement");
    filtre.etablissement = req.query.etablissement;
  }

  for (const champ of ["domaine", "etiquette"]) {
    if (req.query[champ] !== undefined) {
      if (typeof req.query[champ] !== "string") {
        throw erreurHttp(`Filtre ${champ} invalide.`, 400);
      }

      filtre[champ] = req.query[champ].trim();
    }
  }

  if (req.query.annee !== undefined) {
    if (!["1", "2", "3", "4"].includes(req.query.annee)) {
      throw erreurHttp("L’année doit être entre 1 et 4.", 400);
    }

    filtre.annee = Number(req.query.annee);
  }

  const publications = await Publication.find(filtre)
    .populate("auteur", "pseudo")
    .populate("etablissement", "nom type")
    .sort({ createdAt: -1 })
    .limit(50);

  res.status(200).json(publications);
});

// GET /api/publications/:id
export const obtenirPublication = gererAsync(async (req, res) => {
  verifierId(req.params.id, "Publication");

  const publication = await Publication.findById(req.params.id)
    .populate("auteur", "pseudo")
    .populate("etablissement", "nom type");

  if (!publication) {
    throw erreurHttp("Publication introuvable.", 404);
  }

  res.status(200).json(publication);
});

// POST /api/publications
export const creerPublication = gererAsync(async (req, res) => {
  const auteur = utilisateurConnecte(req);

  const {
    titre,
    contenu,
    etablissement,
    domaine,
    annee,
    etiquette,
  } = req.body ?? {};

  verifierId(etablissement, "Établissement");

  const existe = await Etablissement.exists({ _id: etablissement });

  if (!existe) {
    throw erreurHttp("Établissement introuvable.", 404);
  }

  const publication = await Publication.create({
    titre,
    contenu,
    auteur,
    etablissement,
    domaine,
    annee,
    etiquette,
  });

  res.status(201).json(publication);
});

// PATCH /api/publications/:id
export const modifierPublication = gererAsync(async (req, res) => {
  const utilisateurId = utilisateurConnecte(req);
  verifierId(req.params.id, "Publication");

  const publication = await Publication.findById(req.params.id);

  if (!publication) {
    throw erreurHttp("Publication introuvable.", 404);
  }

  verifierAuteur(publication.auteur, utilisateurId);

  // On autorise uniquement ces champs à être modifiés.
  // L’auteur et l’établissement restent inchangés.
  const champsAutorises = [
    "titre",
    "contenu",
    "domaine",
    "annee",
    "etiquette",
  ];

  const donnees = req.body ?? {};
  let modification = false;

  for (const champ of champsAutorises) {
    if (Object.hasOwn(donnees, champ)) {
      publication[champ] = donnees[champ];
      modification = true;
    }
  }

  if (!modification) {
    throw erreurHttp("Aucun champ modifiable fourni.", 400);
  }

  // save() applique les validations du modèle.
  await publication.save();

  res.status(200).json(publication);
});

// DELETE /api/publications/:id
export const supprimerPublication = gererAsync(async (req, res) => {
  const utilisateurId = utilisateurConnecte(req);
  verifierId(req.params.id, "Publication");

  const publication = await Publication.findById(req.params.id);

  if (!publication) {
    throw erreurHttp("Publication introuvable.", 404);
  }

  verifierAuteur(publication.auteur, utilisateurId);

  await Commentaire.deleteMany({
    publication: publication._id,
  });

  await publication.deleteOne();

  res.status(200).json({
    message: "Publication et commentaires supprimés.",
  });
});