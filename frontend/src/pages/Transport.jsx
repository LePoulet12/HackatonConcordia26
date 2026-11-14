import { useState } from "react";

import { api, dateMontreal, heureMontreal } from "./horaireApi";

function formatTime(value) {
  if (!value) return "—";
  return heureMontreal.format(new Date(value));
}

function minutes(seconds) {
  return `${Math.ceil(seconds / 60)} min`;
}

function timingLabel(step, saved) {
  if (!step.realTime) return "Horaire planifié";
  if (saved) return "Estimation lors du calcul";
  const delay = Date.parse(step.departure) - Date.parse(step.scheduledDeparture);
  if (delay >= 60000) return `Retard estimé au départ de ${Math.floor(delay / 60000)} min`;
  return "Horaire mis à jour en temps réel";
}

export function TripDetails({ itinerary, saved = false }) {
  return (
    <ol className="horaire-stops transport-steps">
      {itinerary.map((step, index) => (
        <li key={index}>
          {step.mode === "WALK" ? (
            <strong>Marcher {minutes(step.seconds)}{step.meters > 0 && ` · ${step.meters} m`}</strong>
          ) : (
            <>
              <strong>{[step.vehicle, step.line].filter(Boolean).join(" ") || "Transport en commun"}</strong>
              {step.agency && <div>{step.agency}</div>}
              <div>{timingLabel(step, saved)}</div>
              {step.headsign && <div>Direction {step.headsign}</div>}
              <div>{formatTime(step.departure)} · Monter à {step.boarding || "l’arrêt de départ"}</div>
              <div>{formatTime(step.arrival)} · Descendre à {step.alighting || "l’arrêt d’arrivée"}</div>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

export function TripPlanner({ canSave, onSave }) {
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tomorrow] = useState(() => dateMontreal(Date.now() + 86400000));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveTrip() {
    setSaving(true);
    setError("");
    try {
      await onSave({ id: route.id, type: "trajet", arriveeVoulue: route.requestedArrival, trajet: route });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setSaved(false);
    setLoading(true);
    setRoute(null);
    setError("");
    try {
      const result = await api("/api/transit/route", { body });
      setRoute({ ...result, requestedArrival: body.arrival, id: crypto.randomUUID() });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="horaire-card">
      <h2>Planifier un trajet</h2>
      <form className="transport-form" onSubmit={submit} onChange={() => { setRoute(null); setError(""); }}>
        <label>
          Lieu de départ
          <input name="origin" placeholder="Ex. Terminus Terrebonne" disabled={loading || saving} required maxLength={250} />
        </label>
        <label>
          Destination
          <input name="destination" defaultValue="Collège Montmorency, Laval" disabled={loading || saving} required maxLength={250} />
        </label>
        <label>
          Arriver avant (heure de Montréal)
          <input name="arrival" type="datetime-local" defaultValue={`${tomorrow}T08:00`} disabled={loading || saving} required />
        </label>
        <button type="submit" className="horaire-button primary" disabled={loading || saving}>
          {loading ? "Recherche en cours…" : "Trouver un trajet"}
        </button>
      </form>
      {error && <p role="alert" className="transport-error">{error}</p>}
      {route && (
        <div className="transport-result" aria-live="polite">
          <div className="transport-summary">
            <span>{route.origin} → {route.destination}</span>
            {route.departure && <strong>Départ estimé à {formatTime(route.departure)}</strong>}
            {route.arrival && <strong>Arrivée estimée à {formatTime(route.arrival)}</strong>}
            <span>{minutes(route.seconds)} au total</span>
            {route.firstWalk !== null && <span>{minutes(route.firstWalk)} de marche jusqu’au premier arrêt</span>}
          </div>
          <TripDetails itinerary={route.itinerary} />
          <button type="button" className="horaire-button primary transport-save"
            disabled={!canSave || saving || saved} onClick={saveTrip}>
            {saved ? "Trajet ajouté" : saving ? "Enregistrement…" : "Ajouter chaque semaine"}
          </button>
          {!canSave && <small>Connecte-toi pour enregistrer ce trajet.</small>}
          <small className="transport-attribution"><a href="https://transitous.org/sources/" target="_blank" rel="noreferrer">Données Transitous</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></small>
        </div>
      )}
    </section>
  );
}
