import mongoose from "mongoose";

const utilisateurSchema = new mongoose.Schema(
    {
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