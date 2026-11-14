import { Router, text } from "express";
import Utilisateur from "../models/Utilisateur.js";
import { authentifier } from "../util/authMiddleware.js";
import { erreurHttp, utilisateurConnecte } from "../util/forumUtils.js";
import { parseHeureMontreal } from "../util/heureMontreal.js";

import { importerIcs } from "../util/importerIcs.js";

const router = Router();
router.use(authentifier);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get("/", async (req, res) => {
  const compte = await Utilisateur.findById(utilisateurConnecte(req)).select("horaire").lean();
  if (!compte) throw erreurHttp("Utilisateur introuvable.", 404);
  res.json(compte.horaire ?? []);
});

router.post("/import", text({ type: "text/calendar", limit: "1mb" }), async (req, res) => {
  if (typeof req.body !== "string") {
    throw erreurHttp("Envoie un fichier au format .ics.", 415);
  }

  const { entrees, limiteRecurrence } = importerIcs(req.body);
  const horaire = { $ifNull: ["$horaire", []] };
  // Filtre et ajoute dans la même écriture MongoDB, même si deux imports arrivent ensemble.
  const avant = await Utilisateur.findOneAndUpdate(
    { _id: utilisateurConnecte(req) },
    [{
      $set: {
        horaire: {
          $concatArrays: [horaire, {
            $filter: {
              input: { $literal: entrees },
              as: "entree",
              cond: { $not: [{ $in: ["$$entree.id", { $ifNull: ["$horaire.id", []] }] }] },
            },
          }],
        },
      },
    }],
    { updatePipeline: true, projection: { horaire: 1 } },
  ).lean();

  if (!avant) throw erreurHttp("Utilisateur introuvable.", 404);
  const existantes = new Set(avant.horaire?.map(({ id }) => id));
  const ajoutees = entrees.filter(({ id }) => !existantes.has(id));
  res.json({ ajoutees, doublons: entrees.length - ajoutees.length, limiteRecurrence });
});

function construireEntree(donnees) {
  const { id, type } = donnees;
  if (typeof id !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) {
    throw erreurHttp("Identifiant d’entrée invalide.", 400);
  }

  if (type === "cours") {
    const { titre, salle } = donnees;
    const debut = parseHeureMontreal(donnees.debut);
    const fin = parseHeureMontreal(donnees.fin);
    if (typeof titre !== "string" || !titre.trim() || titre.length > 250 ||
        (salle != null && (typeof salle !== "string" || salle.length > 100)) ||
        !Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) {
      throw erreurHttp("Indique un nom de cours et une heure de fin après le début.", 400);
    }
    return { id, type, titre, salle, debut, fin };
  }

  if (type === "trajet") {
    const { trajet } = donnees;
    const debut = typeof trajet?.departure === "string" ? Date.parse(trajet.departure) : NaN;
    const fin = typeof trajet?.arrival === "string" ? Date.parse(trajet.arrival) : NaN;
    const arriveeVoulue = parseHeureMontreal(donnees.arriveeVoulue);
    const origine = trajet?.origin;
    const destination = trajet?.destination;

    if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut ||
        !Number.isFinite(arriveeVoulue) || fin > arriveeVoulue ||
        typeof origine !== "string" || !origine.trim() ||
        typeof destination !== "string" || !destination.trim() ||
        !Array.isArray(trajet.itinerary) || trajet.itinerary.length > 100 ||
        !trajet.itinerary.some((segment) => segment?.mode === "TRANSIT")) {
      throw erreurHttp("Calcule un trajet pour la date et l’heure voulues avant de l’ajouter.", 400);
    }

    return { id, type, titre: destination, origine, destination, debut, fin,
      arriveeVoulue, segments: trajet.itinerary };
  }

  throw erreurHttp("Type d’entrée invalide.", 400);
}

router.post("/", async (req, res) => {
  const compteId = utilisateurConnecte(req);
  const entree = construireEntree(req.body ?? {});
  const resultat = await Utilisateur.updateOne(
    { _id: compteId, "horaire.id": { $ne: entree.id } },
    { $push: { horaire: entree } },
    { runValidators: true },
  );
  const compte = await Utilisateur.findById(compteId)
    .select({ horaire: { $elemMatch: { id: entree.id } } }).lean();
  if (!compte?.horaire?.length) throw erreurHttp("Utilisateur introuvable.", 404);
  return res.status(resultat.modifiedCount ? 201 : 200).json(compte.horaire[0]);
});

export default router;
