import { Router } from "express";
import {
  listerEtablissements,
} from "../handler/etablissementHandler.js";

const router = Router();

router.get("/", listerEtablissements);

export default router;