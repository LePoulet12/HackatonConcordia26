import Commentaire from "../models/Commentaire.js";
import Publication from "../models/Publication.js";

import {
  erreurHttp,
  verifierId,
  utilisateurConnecte,
  verifierAuteur,
  gererAsync,
} from "../util/forumUtils.js";

// GET /api/publications/:id/commentaires
export const listerCommentaires = gererAsync(async (req, res) => {
  verifierId(req.params.id, "Publication");

  const existe = await Publication.exists({
    _id: req.params.id,
  });

  if (!existe) {
    throw erreurHttp("Publication introuvable.", 404);
  }

  const commentaires = await Commentaire.find({
    publication: req.params.id,
  })
    .populate("auteur", "pseudo")
    .sort({ createdAt: 1 });

  res.status(200).json(commentaires);
});

// POST /api/publications/:id/commentaires
export const creerCommentaire = gererAsync(async (req, res) => {
  const auteur = utilisateurConnecte(req);
  verifierId(req.params.id, "Publication");

  const existe = await Publication.exists({
    _id: req.params.id,
  });

  if (!existe) {
    throw erreurHttp("Publication introuvable.", 404);
  }

  const commentaire = await Commentaire.create({
    contenu: req.body?.contenu,
    auteur,
    publication: req.params.id,
  });

  res.status(201).json(commentaire);
});

// PATCH /api/commentaires/:id
export const modifierCommentaire = gererAsync(async (req, res) => {
  const utilisateurId = utilisateurConnecte(req);
  verifierId(req.params.id, "Commentaire");

  const commentaire = await Commentaire.findById(req.params.id);

  if (!commentaire) {
    throw erreurHttp("Commentaire introuvable.", 404);
  }

  verifierAuteur(commentaire.auteur, utilisateurId);

  if (!Object.hasOwn(req.body ?? {}, "contenu")) {
    throw erreurHttp("Le contenu est requis.", 400);
  }

  commentaire.contenu = req.body.contenu;
  await commentaire.save();

  res.status(200).json(commentaire);
});

// DELETE /api/commentaires/:id
export const supprimerCommentaire = gererAsync(async (req, res) => {
  const utilisateurId = utilisateurConnecte(req);
  verifierId(req.params.id, "Commentaire");

  const commentaire = await Commentaire.findById(req.params.id);

  if (!commentaire) {
    throw erreurHttp("Commentaire introuvable.", 404);
  }

  verifierAuteur(commentaire.auteur, utilisateurId);

  await commentaire.deleteOne();

  res.status(200).json({
    message: "Commentaire supprimé.",
  });
});