import { useCallback, useEffect, useState } from "react";
import {
  Bus,
  FileText,
  MessageCircle,
  Moon,
  Settings,
  Sun,
} from "lucide-react";

import Notes from "./components/Notes";
import Horaire from "./pages/Horaire";
import Forum from "./pages/Forum";
import { api } from "./pages/horaireApi";
import "./App.css";

const tokenKey = "campus-token";

const items = [
  ["horaire", "Horaire et bus", Bus],
  ["notes", "Notes de cours", FileText],
  ["forum", "Forum", MessageCircle],
];

function pageActuelle() {
  const page = window.location.hash.slice(1);

  return ["horaire", "notes", "forum", "parametres"].includes(page)
    ? page
    : "horaire";
}

function Parametres({ token, account, onSave }) {
  const [nom, setNom] = useState(account.pseudo || "");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [saving, setSaving] = useState(false);

  async function enregistrer(event) {
    event.preventDefault();
    setSaving(true);
    setErreur("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/moi", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pseudo: nom.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Modification impossible.");
      }

      onSave(data);
      setNom(data.pseudo);
      setMessage("Ton nom a été mis à jour.");
    } catch (error) {
      setErreur(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={enregistrer}
      style={{
        maxWidth: 480,
        display: "grid",
        gap: 18,
        padding: 24,
        border: "1px solid #94a3b855",
        borderRadius: 16,
      }}
    >
      <h2 style={{ margin: 0 }}>Mon profil</h2>

      <label htmlFor="nom-compte">Ton nom</label>

      <input
        id="nom-compte"
        value={nom}
        onChange={(event) => {
          setNom(event.target.value);
          setMessage("");
        }}
        required
        minLength={2}
        maxLength={40}
        autoComplete="nickname"
        style={{
          padding: 12,
          borderRadius: 9,
          border: "1px solid #94a3b8",
          background: "transparent",
          color: "inherit",
          font: "inherit",
        }}
      />

      {erreur && (
        <p role="alert" style={{ color: "#d75b68", margin: 0 }}>
          {erreur}
        </p>
      )}

      {message && (
        <p role="status" style={{ color: "#299d92", margin: 0 }}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || nom.trim().length < 2}
        style={{
          padding: "12px 18px",
          border: 0,
          borderRadius: 9,
          background: "#635bce",
          color: "white",
          cursor: saving ? "wait" : "pointer",
          font: "inherit",
        }}
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

export default function App() {
  const [active, setActive] = useState(pageActuelle);

  const [token, setToken] = useState(
    () => localStorage.getItem(tokenKey)
  );

  const [account, setAccount] = useState(null);

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("campus-theme");

      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // Le thème fonctionne sans stockage.
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const disconnect = useCallback(() => {
    localStorage.removeItem(tokenKey);
    setToken(null);
    setAccount(null);
    window.dispatchEvent(new Event("campus-auth-change"));
  }, []);

  function connect(nextToken) {
    localStorage.setItem(tokenKey, nextToken);
    setAccount(null);
    setToken(nextToken);
    window.dispatchEvent(new Event("campus-auth-change"));
  }

  useEffect(() => {
    document.title = "Campus Go";
  }, []);

  useEffect(() => {
    function synchroniserCompte() {
      const nextToken = localStorage.getItem(tokenKey);
      setToken(nextToken);

      if (!nextToken) setAccount(null);
    }

    window.addEventListener("campus-auth-change", synchroniserCompte);

    return () => {
      window.removeEventListener(
        "campus-auth-change",
        synchroniserCompte
      );
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("campus-theme", theme);
    } catch {
      // Le thème fonctionne sans stockage.
    }
  }, [theme]);

  useEffect(() => {
    function synchroniserNavigation() {
      setActive(pageActuelle());
    }

    window.addEventListener("hashchange", synchroniserNavigation);

    return () => {
      window.removeEventListener(
        "hashchange",
        synchroniserNavigation
      );
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    api("/api/auth/moi", {
      token,
      signal: controller.signal,
    })
      .then((user) => {
        if (!controller.signal.aborted) setAccount(user);
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.status === 401) {
          disconnect();
        }
      });

    return () => controller.abort();
  }, [token, disconnect]);

  return (
    <>
      <aside className="sidebar" aria-label="Menu Campus Go">
        <a
          className="brand"
          href="#horaire"
          onClick={() => setActive("horaire")}
          style={{ gap: 0 }}
        >
          Campus Go
        </a>

        <nav aria-label="Navigation principale">
          {items.map(([id, label, ItemIcon]) => (
            <a
              key={id}
              href={`#${id}`}
              className={`nav-item ${active === id ? "active" : ""}`}
              aria-current={active === id ? "page" : undefined}
              onClick={() => setActive(id)}
            >
              <ItemIcon
                size={24}
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="theme-toggle nav-item"
            type="button"
            onClick={() =>
              setTheme((current) =>
                current === "light" ? "dark" : "light"
              )
            }
            aria-label="Mode sombre"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? (
              <Moon size={24} strokeWidth={1.7} aria-hidden="true" />
            ) : (
              <Sun size={24} strokeWidth={1.7} aria-hidden="true" />
            )}

            <span>
              {theme === "dark" ? "Mode sombre" : "Mode clair"}
            </span>

            <span className="theme-switch" aria-hidden="true" />
          </button>

          <a
            href="#parametres"
            className={`nav-item ${
              active === "parametres" ? "active" : ""
            }`}
            aria-current={
              active === "parametres" ? "page" : undefined
            }
            onClick={() => setActive("parametres")}
          >
            <Settings
              size={24}
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <span>Paramètres</span>
          </a>

          {token ? (
            <button
              className="profile session-profile"
              type="button"
              onClick={disconnect}
              aria-label="Se déconnecter"
            >
              <span className="avatar">
                {account?.pseudo?.[0]?.toUpperCase() || "C"}
              </span>

              <span>
                <strong>{account?.pseudo || "Mon compte"}</strong>
                <small>Se déconnecter</small>
              </span>
            </button>
          ) : (
            <a
              className="profile"
              href="#horaire"
              onClick={() => setActive("horaire")}
              aria-label="Se connecter"
            >
              <span className="avatar" aria-hidden="true">↪</span>
              <strong>Se connecter</strong>
            </a>
          )}
        </div>
      </aside>

      {active === "horaire" && (
        <Horaire
          key={token || "guest"}
          token={token}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      )}

      {active === "forum" && (
        <Forum key={token || "guest"} token={token} />
      )}

      {active === "notes" && (
        <Notes key={token || "guest"} />
      )}

      {active === "parametres" && (
        <main className="forum-page">
          <header className="forum-heading">
            <div>
              <h1>Paramètres</h1>
              <p>Personnalise le nom affiché sur ton compte.</p>
            </div>
          </header>

          {!token ? (
            <p>
              <a href="#horaire">Connecte-toi</a> pour modifier ton nom.
            </p>
          ) : account ? (
            <Parametres
              key={account._id}
              token={token}
              account={account}
              onSave={setAccount}
            />
          ) : (
            <p>Chargement du compte…</p>
          )}
        </main>
      )}
    </>
  );
}