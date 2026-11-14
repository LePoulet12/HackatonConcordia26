import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connecterDB } from "./util/database.js";
import { parseHeureMontreal } from "./util/heureMontreal.js";
import Utilisateur from "./models/Utilisateur.js";
import Etablissement from "./models/Etablissement.js";
import Publication from "./models/Publication.js";
import Commentaire from "./models/Commentaire.js";

const motDePasseDemo = "CampusDemo2026!";
const compteDemo = {
  _id: "ca0000000000000000000001",
  pseudo: "etudiant-demo",
  courriel: "etudiant@campus.example",
};
const auteurDemo = {
  _id: "ca0000000000000000000002",
  pseudo: "entraide-demo",
  courriel: "entraide@campus.example",
};

const calendrier = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "short",
  timeZone: "America/Toronto",
});

function construireHoraire() {
  const lundi = new Date(`${calendrier.format(new Date())}T00:00:00Z`);
  lundi.setUTCDate(lundi.getUTCDate() - (lundi.getUTCDay() + 6) % 7);
  const mercredi = new Date(lundi);
  mercredi.setUTCDate(mercredi.getUTCDate() + 2);
  const heure = (jour, valeur) =>
    new Date(parseHeureMontreal(`${jour.toISOString().slice(0, 10)}T${valeur}`));

  return [
    {
      id: "ca000000-0000-4000-8000-000000000001",
      type: "cours",
      titre: "Développement web",
      salle: "B-204",
      debut: heure(lundi, "08:00"),
      fin: heure(lundi, "09:30"),
    },
    {
      id: "ca000000-0000-4000-8000-000000000002",
      type: "cours",
      titre: "Bases de données",
      salle: "A-101",
      debut: heure(mercredi, "13:00"),
      fin: heure(mercredi, "14:30"),
    },
    {
      id: "ca000000-0000-4000-8000-000000000003",
      type: "trajet",
      titre: "Collège Montmorency · Démo",
      origine: "Terminus Terrebonne",
      destination: "Collège Montmorency",
      debut: heure(lundi, "07:12"),
      fin: heure(lundi, "07:57"),
      arriveeVoulue: heure(lundi, "08:00"),
      segments: [
        { mode: "WALK", seconds: 180, meters: 164 },
        {
          mode: "TRANSIT",
          vehicle: "Bus",
          line: "19",
          agency: "exo Terrebonne–Mascouche",
          headsign: "Terminus Montmorency",
          boarding: "Terminus Terrebonne",
          alighting: "Terminus Montmorency",
          departure: heure(lundi, "07:15"),
          scheduledDeparture: heure(lundi, "07:15"),
          arrival: heure(lundi, "07:52"),
          realTime: false,
        },
        { mode: "WALK", seconds: 300 },
      ],
    },
  ];
}

async function insererSiAbsent(Modele, filtre, valeurs) {
  await Modele.updateOne(
    filtre,
    { $setOnInsert: valeurs },
    { upsert: true, runValidators: true, timestamps: false },
  );
}

async function seed() {
  await connecterDB();
  await Promise.all([Utilisateur, Etablissement, Publication, Commentaire].map((Modele) => Modele.init()));

  const date = new Date();
  const dates = { createdAt: date, updatedAt: date };
  const motDePasseHash = await bcrypt.hash(motDePasseDemo, 12);
  await insererSiAbsent(Utilisateur, { _id: compteDemo._id }, {
    ...compteDemo, ...dates, motDePasseHash, horaire: construireHoraire(),
  });
  await insererSiAbsent(Utilisateur, { _id: auteurDemo._id }, {
    ...auteurDemo, ...dates, motDePasseHash,
  });

  await insererSiAbsent(Etablissement, { nom: "Collège Montmorency" }, {
    ...dates, nom: "Collège Montmorency", type: "cegep",
  });
  await insererSiAbsent(Etablissement, { nom: "Université Concordia" }, {
    ...dates, nom: "Université Concordia", type: "universite",
  });

  const college = await Etablissement.findOne({ nom: "Collège Montmorency" }).select("_id").lean();
  const publicationId = "ca0000000000000000000010";
  await insererSiAbsent(Publication, { _id: publicationId }, {
    ...dates,
    titre: "Groupe d’étude en développement web",
    contenu: "Je propose une séance de révision à la bibliothèque mercredi. Qui veut se joindre à moi ?",
    auteur: auteurDemo._id,
    etablissement: college._id,
    domaine: "Informatique",
    annee: 1,
    etiquette: "Entraide",
  });
  await insererSiAbsent(Commentaire, { _id: "ca0000000000000000000020" }, {
    ...dates,
    auteur: compteDemo._id,
    publication: publicationId,
    contenu: "Je peux venir après mon cours de bases de données.",
  });

  console.log(`Données de démo disponibles dans la base « ${mongoose.connection.name} ».`);
  console.log(`Compte de démo : ${compteDemo.courriel} / ${motDePasseDemo}`);
}

try {
  await seed();
} catch (erreur) {
  console.error("Seeder interrompu :", erreur.code === 11000
    ? "Un pseudo ou un courriel de démo est déjà utilisé par un autre document."
    : erreur.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
