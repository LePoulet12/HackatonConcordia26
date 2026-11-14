import { Router } from "express";
import { authentifier } from "../util/authMiddleware.js";

import {
  inscrire,
  connecter,
  obtenirMonCompte,
  modifierMonCompte,
  supprimerMonCompte,
} from "../handler/authHandler.js";

const router = Router();

router.post("/inscription", inscrire);
router.post("/connexion", connecter);

router.get("/moi", authentifier, obtenirMonCompte);
router.patch("/moi", authentifier, modifierMonCompte);
router.delete("/moi", authentifier, supprimerMonCompte);

export default router;