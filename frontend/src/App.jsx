import { useEffect, useState } from "react";
import {
  BookOpen,
  Bus,
  ChevronDown,
  FileText,
  House,
  MessageCircle,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import Notes from "./components/Notes";
import "./App.css";

const items = [
  ["campus", "Mon campus", House],
  ["horaire", "Horaire et bus", Bus],
  ["forum", "Forum", MessageCircle],
  ["notes", "Notes partagées", FileText],
  ["cours", "Mes cours", BookOpen],
];

export default function App() {
  const [active, setActive] = useState("notes");
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("campus-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* Stockage facultatif. */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("campus-theme", theme);
    } catch {
      /* Stockage facultatif. */
    }
  }, [theme]);
  return (
    <>
    <aside className="sidebar" aria-label="Menu Campus">
      <a className="brand" href="#campus" onClick={() => setActive("campus")}>
        <span className="brand-mark">C</span>Campus
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
            <ItemIcon size={24} strokeWidth={1.7} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className="theme-toggle nav-item"
          type="button"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label="Mode sombre"
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? (
            <Moon size={24} strokeWidth={1.7} aria-hidden="true" />
          ) : (
            <Sun size={24} strokeWidth={1.7} aria-hidden="true" />
          )}
          <span>{theme === "dark" ? "Mode sombre" : "Mode clair"}</span>
          <span className="theme-switch" aria-hidden="true" />
        </button>
        <a
          href="#parametres"
          className={`nav-item ${active === "parametres" ? "active" : ""}`}
          onClick={() => setActive("parametres")}
        >
          <Settings size={24} strokeWidth={1.7} aria-hidden="true" />
          <span>Paramètres</span>
        </a>
        <a
          className="profile"
          href="#profil"
          onClick={() => setActive("profil")}
        >
          <span className="avatar">E</span>
          <strong>Edson</strong>
          <ChevronDown size={24} strokeWidth={1.7} aria-hidden="true" />
        </a>
      </div>
    </aside>
    {active === "notes" && <Notes />}
    </>
  );
}
