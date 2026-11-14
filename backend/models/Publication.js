import mongoose from "mongoose";

const publicationSchema = new mongoose.Schema(
  {
    titre: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    contenu: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Utilisateur",
      required: true,
    },
    etablissement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Etablissement",
      required: true,
    },
    domaine: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    annee: {
      type: Number,
      enum: [1, 2, 3, 4, null],
      default: null,
    },
    etiquette: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "Général",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Publication", publicationSchema);