import { Router } from "express";
import { authentifier } from "../util/authMiddleware.js";

import {
  listerPublications,
  obtenirPublication,
  creerPublication,
  modifierPublication,
  supprimerPublication,
} from "../handler/publicationHandler.js";

import {
  listerCommentaires,
  creerCommentaire,
} from "../handler/commentaireHandler.js";

const router = Router();

router.get("/", listerPublications);
router.post("/", authentifier, creerPublication);

router.get("/:id", obtenirPublication);
router.patch("/:id", authentifier, modifierPublication);
router.delete("/:id", authentifier, supprimerPublication);

router.get("/:id/commentaires", listerCommentaires);
router.post("/:id/commentaires", authentifier, creerCommentaire);

export default router;