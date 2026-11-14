import authRoutes from "./routes/authRoutes.js";
import express from "express";
import { connecterDB } from "./util/database.js";
import cors from "cors";
import "dotenv/config";

import publicationRoutes from "./routes/publicationRoutes.js";
import commentaireRoutes from "./routes/commentaireRoutes.js";
import etablissementRoutes from "./routes/etablissementRoutes.js";
import { errorHandler } from "./util/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());

// Ajouter ici l’authentification de votre équipe,
// avant les routes qui en ont besoin.

app.use("/api/publications", publicationRoutes);
app.use("/api/commentaires", commentaireRoutes);
app.use("/api/etablissements", etablissementRoutes);
app.use("/api/auth", authRoutes);
// Ajouter les autres routes de l’équipe AVANT la 404.

app.use((req, res) => {
  res.status(404).json({ message: "Route introuvable." });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function demarrer() {
  try {
    await connecterDB();

    app.listen(PORT, () => {
      console.log(`Serveur disponible sur http://localhost:${PORT}`);
    });
  } catch (erreur) {
    console.error("Démarrage impossible :", erreur.message);
    process.exit(1);
  }
}

demarrer();