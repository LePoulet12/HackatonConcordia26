import mongoose from "mongoose";

import { entreeHoraireSchema } from "./EntreeHoraire.js";

const utilisateurSchema = new mongoose.Schema(
    {
        horaire: { type: [entreeHoraireSchema], default: [], select: false },
        pseudo: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        courriel: {
            type:String,
            required: true,
            unique: true,
            lowercase: true, 
            trim: true, 
        },

        motDePasseHash: {
            type: String,
            required: true,
            select: false,
        },
    },
    {timestamps : true} 
);

export default mongoose.model("Utilisateur", utilisateurSchema)