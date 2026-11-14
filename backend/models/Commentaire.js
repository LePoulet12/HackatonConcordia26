import mongoose from "mongoose";

const commentaireSchema = new mongoose.Schema(
  {
    contenu: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Utilisateur",
      required: true,
    },
    publication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publication",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Commentaire", commentaireSchema);