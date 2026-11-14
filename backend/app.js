import "dotenv/config";

import cors from "cors";
import { pathToFileURL, fileURLToPath } from "node:url";

import { connecterDB } from "./util/database.js";
import { errorHandler } from "./util/errorHandler.js";
import { createCollaborationServer } from "./collaboration.js";

import authRoutes from "./routes/authRoutes.js";
import publicationRoutes from "./routes/publicationRoutes.js";
import commentaireRoutes from "./routes/commentaireRoutes.js";
import etablissementRoutes from "./routes/etablissementRoutes.js";
import horaireRoutes from "./routes/horaireRoutes.js";
import transitRoutes from "./routes/transitRoutes.js";

const dataFile = fileURLToPath(
  new URL("./.data/collaboration.json", import.meta.url)
);

const collaboration = createCollaborationServer({
  dataFile,

  secureCookie: process.env.NODE_ENV === "production",

  configureApp(application) {
    application.use(cors());

    application.use("/api/auth", authRoutes);
    application.use("/api/publications", publicationRoutes);
    application.use("/api/commentaires", commentaireRoutes);
    application.use("/api/etablissements", etablissementRoutes);
    application.use("/api/horaire", horaireRoutes);
    application.use("/api/transit", transitRoutes);
  },
});

export const app = collaboration.app;
export const server = collaboration.server;

app.use((req, res) => {
  res.status(404).json({
    message: "Route introuvable.",
  });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT || 3001);

async function demarrer() {
  try {
    await connecterDB();

    server.on("error", (erreur) => {
      console.error("Erreur du serveur :", erreur.message);
      process.exit(1);
    });

    server.listen(PORT, () => {
      console.log(
        `Serveur disponible sur http://localhost:${PORT}`
      );
      console.log("Routes Notes et WebSocket activés.");
    });
  } catch (erreur) {
    console.error(
      "Démarrage impossible :",
      erreur.message
    );

    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  demarrer();
}