import { useState } from "react";
import { api } from "./horaireApi";

export default function CompteHoraire({ onConnect }) {
  const [inscription, setInscription] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError("");
    try {
      const session = await api(`/api/auth/${inscription ? "inscription" : "connexion"}`, { body });
      onConnect(session.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="horaire-card">
      <h2>{inscription ? "Créer un compte" : "Se connecter"}</h2>
      <form className="transport-form" onSubmit={submit}>
        {inscription && <label>Pseudo <input name="pseudo" autoComplete="nickname" minLength={2} maxLength={40} required /></label>}
        <label>Courriel <input name="courriel" type="email" autoComplete="email" required /></label>
        <label>Mot de passe <input name="motDePasse" type="password" autoComplete={inscription ? "new-password" : "current-password"} minLength={inscription ? 8 : undefined} required /></label>
        <button className="horaire-button primary" disabled={pending}>
          {inscription ? "Créer mon compte" : "Me connecter"}
        </button>
        <button className="horaire-button outline" type="button" disabled={pending} onClick={() => {
          setInscription(!inscription);
          setError("");
        }}>{inscription ? "J’ai déjà un compte" : "Créer un compte"}</button>
        {error && <p className="transport-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
