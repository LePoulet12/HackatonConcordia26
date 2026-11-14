import { createHash } from "node:crypto";
import ICAL from "ical.js";
import { parseHeureMontreal } from "./heureMontreal.js";
import { erreurHttp } from "./forumUtils.js";

const maxEvenements = 2000;

function instant(time, tzid) {
  if (!time) return NaN;
  if (time.zone !== ICAL.Timezone.localTimezone) return time.toUnixTime() * 1000;
  if (tzid && !["America/Toronto", "America/Montreal", "Eastern Standard Time"].includes(tzid)) {
    throw erreurHttp(`Fuseau horaire sans définition dans le fichier : ${tzid}.`, 422);
  }
  const valeur = time.isDate ? `${time}T00:00` : time.toString().slice(0, 16);
  return parseHeureMontreal(valeur) + (time.isDate ? 0 : time.second * 1000);
}

function convertir({ item, startDate, endDate, recurrenceId }, entrees) {
  if (item.component.getFirstPropertyValue("status")?.toUpperCase() === "CANCELLED") return;
  const debutTz = item.component.getFirstProperty("dtstart")?.getParameter("tzid");
  const finTz = item.component.getFirstProperty("dtend")?.getParameter("tzid") ?? debutTz;
  const debut = instant(startDate, debutTz);
  const fin = instant(endDate, finTz);
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) return;

  const empreinte = createHash("sha256")
    .update(JSON.stringify([item.uid, recurrenceId?.toString() ?? null]))
    .digest("hex");
  const id = `${empreinte.slice(0, 8)}-${empreinte.slice(8, 12)}-${empreinte.slice(12, 16)}-${empreinte.slice(16, 20)}-${empreinte.slice(20, 32)}`;
  entrees.set(id, {
    id,
    type: "cours",
    titre: item.summary?.trim().slice(0, 250) || "Événement importé",
    salle: item.location?.trim().slice(0, 100),
    debut: new Date(debut),
    fin: new Date(fin),
    journeeEntiere: startDate.isDate,
  });
}

export function importerIcs(texte) {
  const entrees = new Map();
  let occurrences = 0;
  let limiteRecurrence = false;
  try {
    const calendrier = new ICAL.Component(ICAL.parse(texte.trim()));
    if (calendrier.name !== "vcalendar") throw new Error("VCALENDAR manquant.");

    const composants = calendrier.getAllSubcomponents("vevent");
    const exceptions = Map.groupBy(
      composants.filter((composant) => composant.hasProperty("recurrence-id")),
      (composant) => composant.getFirstPropertyValue("uid"),
    );

    for (const composant of composants) {
      if (composant.hasProperty("recurrence-id") ||
          composant.getFirstPropertyValue("status")?.toUpperCase() === "CANCELLED") continue;
      if (!composant.hasProperty("dtstart") || !composant.getFirstPropertyValue("uid")) continue;
      const item = new ICAL.Event(composant, {
        exceptions: exceptions.get(composant.getFirstPropertyValue("uid")) ?? [],
      });
      if (!item.isRecurring()) {
        if (++occurrences > maxEvenements) throw erreurHttp("Le fichier dépasse 2 000 événements.", 422);
        convertir({ item, startDate: item.startDate, endDate: item.endDate }, entrees);
        continue;
      }

      const sansFin = composant.getAllProperties("rrule")
        .some((propriete) => !propriete.getFirstValue().isFinite());
      const limite = item.startDate.clone();
      limite.year += 1;
      const iterator = item.iterator();
      for (let occurrence = iterator.next(); occurrence; occurrence = iterator.next()) {
        if (sansFin && occurrence.compare(limite) >= 0) {
          limiteRecurrence = true;
          break;
        }
        if (++occurrences > maxEvenements) throw erreurHttp("Le fichier dépasse 2 000 événements.", 422);
        convertir(item.getOccurrenceDetails(occurrence), entrees);
      }
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throw erreurHttp("Impossible de lire ce calendrier. Vérifie que le fichier .ics est valide.", 400);
  }

  if (!entrees.size) throw erreurHttp("Ce fichier ne contient aucun événement importable.", 422);
  return { entrees: [...entrees.values()], limiteRecurrence };
}
