import { Router } from "express";
import { authentifier } from "../util/authMiddleware.js";

import {
  modifierCommentaire,
  supprimerCommentaire,
} from "../handler/commentaireHandler.js";

const router = Router();

router.patch("/:id", authentifier, modifierCommentaire);
router.delete("/:id", authentifier, supprimerCommentaire);

export default router;