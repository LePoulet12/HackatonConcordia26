import mongoose from "mongoose";

const etablissementSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 150,
    },
    type: {
      type: String,
      required: true,
      enum: ["cegep", "universite"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Etablissement", etablissementSchema);