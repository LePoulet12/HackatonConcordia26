export async function api(path, { token, body, signal, contentType = "application/json" } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const envoyer = body !== undefined;
  if (envoyer) headers["Content-Type"] = contentType;
  const response = await fetch(path, {
    method: envoyer ? "POST" : "GET",
    headers,
    body: contentType === "application/json" ? JSON.stringify(body) : body,
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    throw Object.assign(new Error(data?.message || data?.error || "Le serveur est indisponible."), {
      status: response.status,
    });
  }
  return data;
}

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "short",
  timeZone: "America/Toronto",
});
export const dateMontreal = (value) => dateFormat.format(new Date(value));
export const heureMontreal = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
