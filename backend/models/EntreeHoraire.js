import mongoose from "mongoose";

const texte = (maxlength) => ({ type: String, trim: true, maxlength });

const segmentSchema = new mongoose.Schema({
  mode: { type: String, enum: ["WALK", "TRANSIT"], required: true },
  seconds: { type: Number, min: 0 },
  meters: { type: Number, min: 0 },
  line: texte(100),
  agency: texte(250),
  vehicle: texte(100),
  headsign: texte(250),
  boarding: texte(250),
  alighting: texte(250),
  departure: Date,
  arrival: Date,
  scheduledDeparture: Date,
  realTime: Boolean,
}, { _id: false });

export const entreeHoraireSchema = new mongoose.Schema({
  id: { ...texte(36), required: true },
  type: { type: String, enum: ["cours", "trajet"], required: true },
  titre: { ...texte(250), required: true },
  debut: { type: Date, required: true },
  fin: { type: Date, required: true },
  salle: texte(100),
  journeeEntiere: Boolean,
  origine: texte(250),
  destination: texte(250),
  arriveeVoulue: Date,
  segments: { type: [segmentSchema], default: undefined },
}, { _id: false });

