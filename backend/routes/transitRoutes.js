import { Router } from "express";
import { parseHeureMontreal } from "../util/heureMontreal.js";

const router = Router();

const transitousBase = "https://api.transitous.org/api";
const transitousAgent = "Campus-Hackathon/1.0 (https://github.com/LePoulet12/HackatonConcordia26)";

async function fetchTransitous(path, params) {
  const url = new URL(`${transitousBase}/${path}`);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, {
    headers: { "User-Agent": transitousAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Transitous HTTP ${response.status}`);
  return response.json();
}

async function findPlace(address) {
  const results = await fetchTransitous("v1/geocode", { text: address });
  const houseNumber = address.match(/^(\d+[a-z]?)\s/i)?.[1];
  const place = results.find((result) => result.country === "CA" &&
    result.areas?.some((area) => area.adminLevel === 4 && area.name === "Québec") &&
    Number.isFinite(result.lat) && Number.isFinite(result.lon) &&
    (!houseNumber || (result.type === "ADDRESS" &&
      result.houseNumber?.toLowerCase() === houseNumber.toLowerCase())));

  if (!place) return null;
  const city = place.areas.find((area) => area.adminLevel === 8)?.name;
  return {
    coordinates: `${place.lat},${place.lon}`,
    label: [place.name, city].filter(Boolean).join(", "),
  };
}

const vehiclesByMode = {
  BUS: "Bus",
  COACH: "Autocar",
  SUBWAY: "Métro",
  SUBURBAN: "Train de banlieue",
  RAIL: "Train",
  TRAM: "Tramway",
  FERRY: "Traversier",
};

function summarizeRoute(trip, from, to) {
  const itinerary = trip.legs.map((leg) => leg.mode === "WALK"
    ? { mode: "WALK", seconds: leg.duration, meters: Math.round(leg.distance ?? 0) }
    : {
        mode: "TRANSIT",
        line: leg.routeShortName || leg.displayName,
        agency: leg.agencyName,
        vehicle: vehiclesByMode[leg.mode],
        headsign: leg.headsign,
        boarding: leg.from?.name,
        alighting: leg.to?.name,
        departure: leg.startTime,
        arrival: leg.endTime,
        realTime: leg.realTime,
        scheduledDeparture: leg.scheduledStartTime,
      });

  const firstTransit = itinerary.findIndex((step) => step.mode === "TRANSIT");
  return {
    origin: from.label,
    destination: to.label,
    itinerary,
    firstWalk: firstTransit === -1 ? null :
      itinerary.slice(0, firstTransit).reduce((seconds, step) => seconds + step.seconds, 0),
    departure: trip.startTime,
    arrival: trip.endTime,
    seconds: trip.duration,
  };
}

router.post("/route", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const { origin, destination, arrival } = req.body ?? {};
  const validAddress = (address) => typeof address === "string" && address.trim() && address.length <= 250;
  const timestamp = parseHeureMontreal(arrival);
  const now = Date.now();

  if (!validAddress(origin) || !validAddress(destination) ||
      !Number.isFinite(timestamp) || timestamp <= now) {
    return res.status(400).json({ error: "Indique un lieu de départ, une destination et une heure d’arrivée future." });
  }

  try {
    const [from, to] = await Promise.all([findPlace(origin.trim()), findPlace(destination.trim())]);
    if (!from || !to) {
      const missing = !from ? "le lieu de départ" : "la destination";
      return res.status(422).json({ error: `Transitous ne trouve pas ${missing}. Essaie le nom d’un arrêt ou d’un lieu public près de l’adresse.` });
    }

    const { itineraries } = await fetchTransitous("v6/plan", {
      fromPlace: from.coordinates,
      toPlace: to.coordinates,
      arriveBy: "true",
      time: new Date(timestamp).toISOString(),
      detailedLegs: "false",
    });
    const earliestDeparture = Date.now();
    let bestTrip;
    for (const trip of itineraries ?? []) {
      const departure = Date.parse(trip.startTime);
      const end = Date.parse(trip.endTime);
      if (!trip.legs?.length || !Number.isFinite(departure) || !Number.isFinite(end) ||
          departure < earliestDeparture || end > timestamp) continue;
      if (!bestTrip || departure > Date.parse(bestTrip.startTime)) bestTrip = trip;
    }
    if (!bestTrip) {
      return res.status(404).json({ error: "Aucun trajet en transport en commun trouvé avant cette heure. Essaie une autre heure ou une autre date." });
    }
    return res.json(summarizeRoute(bestTrip, from, to));
  } catch (error) {
    console.error("Transitous", error.message);
    return res.status(502).json({ error: "Le planificateur Transitous est temporairement indisponible. Réessaie dans quelques instants." });
  }
});

export default router;
