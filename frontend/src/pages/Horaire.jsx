import { useEffect, useState } from "react";
import "./Horaire.css";
import { TripPlanner, TripDetails } from "./Transport";
import { api, dateMontreal, heureMontreal } from "./horaireApi";
import CompteHoraire from "./CompteHoraire";

const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const dayStamp = new Intl.DateTimeFormat("fr-CA", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function shiftDate(date, days) {
  const utc = new Date(`${date}T00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function mondayOf(date) {
  const day = new Date(`${date}T00:00Z`).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}

function minuteOfDay(value) {
  const [hour, minute] = clock.format(new Date(value)).split(":").map(Number);
  return hour * 60 + minute;
}

function eventsForDate(entries, date) {
  const events = entries.flatMap((entry) => {
    const start = dateMontreal(entry.debut);
    const end = dateMontreal(entry.fin);
    if (date < start || date > end) return [];
    const from = date === start ? minuteOfDay(entry.debut) : 0;
    const to = date === end ? minuteOfDay(entry.fin) : 1440;
    return to > from ? [{ entry, from, to }] : [];
  }).sort((a, b) => a.from - b.from || a.to - b.to);
  const columns = [];
  for (const event of events) {
    let column = columns.findIndex((end) => end <= event.from);
    if (column === -1) column = columns.length;
    columns[column] = event.to;
    event.column = column;
  }
  return { events, columns: columns.length };
}

function CourseForm({ date, onSave, onClose }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [id] = useState(() => crypto.randomUUID());

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await onSave({ ...data, id, type: "cours" });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="horaire-card horaire-course-form">
      <h2>Ajouter un cours</h2>
      <form className="transport-form" onSubmit={submit}>
        <label>Nom du cours <input name="titre" required maxLength={250} /></label>
        <label>Salle <input name="salle" maxLength={100} /></label>
        <label>Début (heure de Montréal) <input name="debut" type="datetime-local" defaultValue={`${date}T08:00`} required /></label>
        <label>Fin <input name="fin" type="datetime-local" defaultValue={`${date}T09:30`} required /></label>
        <div className="horaire-actions">
          <button className="horaire-button primary" disabled={pending}>Enregistrer</button>
          <button className="horaire-button outline" type="button" onClick={onClose} disabled={pending}>Annuler</button>
        </div>
        {error && <p className="transport-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}

export default function Horaire({ token, onConnect, onDisconnect }) {
  const [today] = useState(() => dateMontreal(Date.now()));
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayView, setDayView] = useState(false);
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api("/api/horaire", { token, signal: controller.signal }).then((loaded) => {
      setEntries((current) => [
        ...loaded.filter((entry) => !current.some((saved) => saved.id === entry.id)),
        ...current,
      ]);
    }).catch((err) => {
      if (controller.signal.aborted) return;
      if (err.status === 401) onDisconnect();
      else setError(err.message);
    });
    return () => controller.abort();
  }, [token, onDisconnect]);

  async function saveEntry(body) {
    try {
      const entry = await api("/api/horaire", { token, body });
      setEntries((current) => [...current.filter((item) => item.id !== entry.id), entry]);
      const date = body.type === "trajet"
        ? body.arriveeVoulue.slice(0, 10)
        : dateMontreal(entry.debut);
      setMonday(mondayOf(date));
      setSelectedDate(date);
      setSelectedEntry(entry);
      setError("");
      setNotice(body.type === "trajet" ? "Trajet ajouté à ton horaire." : "Cours ajouté à ton horaire.");
    } catch (err) {
      if (err.status === 401) onDisconnect();
      throw err;
    }
  }

  async function importSchedule(event) {
    const input = event.currentTarget;
    const fichier = input.files[0];
    input.value = "";
    if (!fichier) return;
    setError("");
    setNotice("");
    if (!/\.ics$/i.test(fichier.name) || fichier.size > 1024 * 1024) {
      setError("Choisis un fichier .ics de 1 Mo ou moins.");
      return;
    }

    setImporting(true);
    try {
      const { ajoutees, doublons, limiteRecurrence } = await api("/api/horaire/import", {
        token, body: await fichier.text(), contentType: "text/calendar",
      });
      const ids = new Set(ajoutees.map(({ id }) => id));
      setEntries((current) => [...current.filter(({ id }) => !ids.has(id)), ...ajoutees]);
      const dates = ajoutees.map((entry) => dateMontreal(entry.debut)).sort();
      const date = dates.find((value) => value >= today) ?? dates[0];
      if (date) {
        setMonday(mondayOf(date));
        setSelectedDate(date);
      }
      const resultat = ajoutees.length === 1 ? "1 événement importé." : `${ajoutees.length} événements importés.`;
      const repetitions = doublons ? ` ${doublons} déjà dans ton horaire.` : "";
      const limite = limiteRecurrence ? " Les séries sans fin ont été importées sur un an." : "";
      setNotice(resultat + repetitions + limite);
    } catch (err) {
      if (err.status === 401) onDisconnect();
      else setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function moveWeek(direction) {
    setMonday(shiftDate(monday, direction * 7));
    setSelectedDate(shiftDate(selectedDate, direction * 7));
  }

  const week = weekdays.map((_day, index) => shiftDate(monday, index));
  const displayed = dayView ? [selectedDate] : week;
  const columns = displayed.map((date) => eventsForDate(entries, date));
  const slots = columns.flatMap(({ events }) => events);
  const firstHour = Math.min(8, ...slots.map(({ from }) => Math.floor(from / 60)));
  const lastHour = Math.max(18, ...slots.map(({ to }) => Math.ceil(to / 60)));
  const total = (lastHour - firstHour) * 60;

  return (
    <div className="horaire-workspace">
      <main className="horaire-page">
        <div className="horaire-heading">
          <div><h1>Mon horaire</h1><p>Tes cours et tes déplacements</p></div>
          {token && <div className="horaire-actions">
            <label className="horaire-button outline horaire-import">
              {importing ? "Importation…" : "Importer un horaire"}
              <input type="file" accept=".ics,text/calendar" disabled={importing} onChange={importSchedule} />
            </label>
            <button className="horaire-button primary" onClick={() => setShowForm(true)}>Ajouter un cours</button>
          </div>}
        </div>
        {notice && <div className="horaire-notice" role="status">{notice}<button aria-label="Fermer le message" onClick={() => setNotice("")}>×</button></div>}
        {error && <p role="alert" className="transport-error">{error}</p>}
        <div className="horaire-layout">
          <section aria-label="Calendrier">
            {token ? (
              <>
                {showForm && <CourseForm date={selectedDate} onSave={saveEntry} onClose={() => setShowForm(false)} />}
                <div className="horaire-controls">
                  <div className="week-navigation">
                    <button className="horaire-icon bordered" aria-label="Semaine précédente" onClick={() => moveWeek(-1)}>‹</button>
                    <span className="week-label">{dayStamp.format(new Date(`${monday}T00:00Z`))} – {dayStamp.format(new Date(`${week[6]}T00:00Z`))}</span>
                    <button className="horaire-icon bordered" aria-label="Semaine suivante" onClick={() => moveWeek(1)}>›</button>
                  </div>
                  <div className="horaire-view">
                    <button aria-pressed={!dayView} className={!dayView ? "selected" : ""} onClick={() => setDayView(false)}>Semaine</button>
                    <button aria-pressed={dayView} className={dayView ? "selected" : ""} onClick={() => setDayView(true)}>Jour</button>
                  </div>
                </div>
                {dayView && <select className="horaire-day-select" aria-label="Jour affiché" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
                  {week.map((date, index) => <option key={date} value={date}>{weekdays[index]} {Number(date.slice(-2))}</option>)}
                </select>}
                <div className="horaire-calendar-scroll">
                  <div className={`horaire-calendar ${dayView ? "single-day" : ""}`} style={{
                    "--days": displayed.length, "--hours": lastHour - firstHour,
                  }}>
                    <div />
                    {displayed.map((date) => <div className="horaire-day" key={date}>
                      {weekdays[week.indexOf(date)]} {Number(date.slice(-2))}
                    </div>)}
                    <div className="horaire-times">
                      {Array.from({ length: lastHour - firstHour }, (_, index) => (
                        <span key={index} style={{ top: `${index * 60 / total * 100}%` }}>{firstHour + index} h</span>
                      ))}
                    </div>
                    {displayed.map((date, index) => (
                      <div className="horaire-day-column" key={date}>
                        {columns[index].events.map(({ entry, from, to, column }) => {
                          const width = 100 / columns[index].columns;
                          return <button type="button" key={entry.id} className={`horaire-event ${entry.type === "trajet" ? "trajet" : ""}`}
                            onClick={() => setSelectedEntry(entry)} aria-label={`${entry.type === "trajet" ? "Trajet " : ""}${entry.titre}, ${heureMontreal.format(new Date(entry.debut))}`}
                            style={{ top: `${(from - firstHour * 60) / total * 100}%`, height: `${(to - from) / total * 100}%`,
                              left: `calc(${column * width}% + 3px)`, width: `calc(${width}% - 6px)` }}>
                            <strong>{entry.type === "trajet" ? "Trajet · " : ""}{entry.titre}</strong>
                            <span>{entry.journeeEntiere ? "Toute la journée" : `${heureMontreal.format(new Date(entry.debut))} – ${heureMontreal.format(new Date(entry.fin))}`}</span>
                          </button>;
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : <CompteHoraire onConnect={onConnect} />}
          </section>
          <aside className="horaire-details">
            {selectedEntry && <section className="horaire-card">
              <h2>{selectedEntry.type === "trajet" ? "Trajet enregistré" : selectedEntry.titre}</h2>
              {selectedEntry.type === "trajet" && <p>{selectedEntry.origine} → {selectedEntry.destination}</p>}
              <p>{dateMontreal(selectedEntry.debut)} · {heureMontreal.format(new Date(selectedEntry.debut))} – {heureMontreal.format(new Date(selectedEntry.fin))}</p>
              {selectedEntry.type === "trajet"
                ? <TripDetails itinerary={selectedEntry.segments} saved />
                : selectedEntry.salle && <p>Salle {selectedEntry.salle}</p>}
              <button type="button" className="horaire-button outline" onClick={() => setSelectedEntry(null)}>Fermer</button>
            </section>}
            <TripPlanner canSave={Boolean(token)} onSave={saveEntry} />
          </aside>
        </div>
      </main>
    </div>
  );
}
