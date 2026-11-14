import { useEffect, useState } from "react";
import {
  ArrowLeft,
  GraduationCap,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import "./Forum.css";

const coursParAnnee = {
  1: ["Introduction à la programmation", "Mathématiques", "Web"],
  2: ["Programmation orientée objet", "Bases de données", "Réseaux"],
  3: ["Développement web", "Cybersécurité", "Projet informatique"],
  4: ["Architecture logicielle", "Systèmes distribués", "Projet de fin d’études"],
};

async function requete(path, { token, method = "GET", body, signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "La demande a échoué.");
  }

  return data;
}

export default function Forum({ token }) {
  const [etablissements, setEtablissements] = useState([]);
  const [etablissement, setEtablissement] = useState(null);
  const [type, setType] = useState("cegep");
  const [annee, setAnnee] = useState("1");
  const [cours, setCours] = useState("");
  const [compte, setCompte] = useState(null);
  const [publications, setPublications] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [version, setVersion] = useState(0);
  const [formulaire, setFormulaire] = useState(null);
  const [suppression, setSuppression] = useState(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    requete("/etablissements", { signal: controller.signal })
      .then(setEtablissements)
      .catch((error) => {
        if (!controller.signal.aborted) setErreur(error.message);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    setCompte(null);
    if (!token) return;

    const controller = new AbortController();

    requete("/auth/moi", { token, signal: controller.signal })
      .then(setCompte)
      .catch((error) => {
        if (!controller.signal.aborted) setErreur(error.message);
      });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!etablissement) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      etablissement: etablissement._id,
      domaine: "Informatique",
      annee,
    });

    if (cours) params.set("etiquette", cours);

    setChargement(true);
    setErreur("");
    setPublications([]);

    requete(`/publications?${params}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setPublications(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setErreur(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setChargement(false);
      });

    return () => controller.abort();
  }, [etablissement, annee, cours, version]);

  function ouvrirCreation() {
    setErreur("");
    setFormulaire({
      id: null,
      titre: "",
      contenu: "",
      etiquette: cours || "Général",
    });
  }

  function ouvrirModification(publication) {
    setErreur("");
    setFormulaire({
      id: publication._id,
      titre: publication.titre,
      contenu: publication.contenu,
      etiquette: publication.etiquette,
    });
  }

  async function enregistrer(event) {
    event.preventDefault();
    if (occupe || !formulaire || !compte) return;

    setOccupe(true);
    setErreur("");

    try {
      const modification = Boolean(formulaire.id);

      await requete(
        modification
          ? `/publications/${formulaire.id}`
          : "/publications",
        {
          token,
          method: modification ? "PATCH" : "POST",
          body: {
            titre: formulaire.titre.trim(),
            contenu: formulaire.contenu.trim(),
            ...(modification
              ? {}
              : {
                  etablissement: etablissement._id,
                  domaine: "Informatique",
                  annee: Number(annee),
                  etiquette: formulaire.etiquette,
                }),
          },
        }
      );

      setFormulaire(null);
      setVersion((value) => value + 1);
    } catch (error) {
      setErreur(error.message);
    } finally {
      setOccupe(false);
    }
  }

  async function supprimer() {
    if (!suppression || occupe) return;

    setOccupe(true);
    setErreur("");

    try {
      await requete(`/publications/${suppression._id}`, {
        token,
        method: "DELETE",
      });

      setSuppression(null);
      setVersion((value) => value + 1);
    } catch (error) {
      setErreur(error.message);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <main className="forum-page">
      <header className="forum-heading">
        <div>
          <span className="forum-eyebrow">LE CAMPUS S’ENTRAIDE</span>
          <h1>Le forum étudiant</h1>
          <p>Des questions, des découvertes et des étudiants pour en parler.</p>
        </div>

        {etablissement && (
          <button
            className="forum-primary"
            onClick={ouvrirCreation}
            disabled={!compte}
          >
            <Plus size={18} />
            Publier
          </button>
        )}
      </header>

      {erreur && <p className="forum-error" role="alert">{erreur}</p>}

      {!etablissement ? (
        <>
          <div className="forum-tabs">
            <button
              className={type === "cegep" ? "selected" : ""}
              onClick={() => setType("cegep")}
            >
              Cégeps et collèges
            </button>
            <button
              className={type === "universite" ? "selected" : ""}
              onClick={() => setType("universite")}
            >
              Universités
            </button>
          </div>

          <div className="forum-schools">
            {etablissements
              .filter((ecole) => ecole.type === type)
              .map((ecole) => (
                <button
                  className="forum-school"
                  key={ecole._id}
                  onClick={() => {
                    setEtablissement(ecole);
                    setAnnee("1");
                    setCours("");
                    setErreur("");
                  }}
                >
                  <span className="forum-school-icon">
                    <GraduationCap size={28} />
                  </span>
                  <strong>{ecole.nom}</strong>
                  <span>Informatique · Découvrir les discussions →</span>
                </button>
              ))}
          </div>
        </>
      ) : (
        <>
          <button
            className="forum-back"
            onClick={() => {
              setEtablissement(null);
              setErreur("");
            }}
          >
            <ArrowLeft size={17} /> Tous les établissements
          </button>

          <section className="forum-context">
            <GraduationCap size={30} />
            <div>
              <h2>{etablissement.nom}</h2>
              <p>Informatique</p>
            </div>
          </section>

          <div className="forum-filters">
            <label>
              Année
              <select
                value={annee}
                onChange={(event) => {
                  setAnnee(event.target.value);
                  setCours("");
                }}
              >
                {Array.from(
                  { length: etablissement.type === "cegep" ? 3 : 4 },
                  (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index === 0 ? "1re" : `${index + 1}e`} année
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Cours
              <select value={cours} onChange={(e) => setCours(e.target.value)}>
                <option value="">Tous les cours</option>
                <option value="Général">Général</option>
                {coursParAnnee[annee].map((nom) => (
                  <option key={nom} value={nom}>{nom}</option>
                ))}
              </select>
            </label>

            <span className="forum-demo-label">
              Sélection de cours illustrative
            </span>
          </div>

          {!compte && (
            <p className="forum-login">
              Tu peux lire les discussions.
              {" "}
              <a href="#horaire">Connecte-toi</a> pour publier avec ton nom.
            </p>
          )}

          {chargement ? (
            <p className="forum-empty">Chargement des discussions…</p>
          ) : publications.length === 0 ? (
            <div className="forum-empty">
              <MessageCircle size={36} />
              <h3>La discussion commence avec toi.</h3>
              <p>Aucune publication dans cette section pour le moment.</p>
            </div>
          ) : (
            <div className="forum-posts">
              {publications.map((publication) => {
                const auteurId =
                  publication.auteur?._id || publication.auteur;

                const proprietaire =
                  Boolean(compte) && auteurId === compte._id;

                return (
                  <article className="forum-post" key={publication._id}>
                    <div className="forum-post-top">
                      <span className="forum-tag">
                        {publication.etiquette || "Général"}
                      </span>

                      {proprietaire && (
                        <div className="forum-post-actions">
                          <button
                            onClick={() => ouvrirModification(publication)}
                            aria-label="Modifier ma publication"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            onClick={() => {
                              setErreur("");
                              setSuppression(publication);
                            }}
                            aria-label="Supprimer ma publication"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3>{publication.titre}</h3>
                    <p className="forum-post-content">{publication.contenu}</p>

                    <footer>
                      <span className="forum-avatar">
                        {publication.auteur?.pseudo?.[0]?.toUpperCase() || "?"}
                      </span>
                      <strong>
                        {publication.auteur?.pseudo || "Ancien membre"}
                      </strong>
                      <time dateTime={publication.createdAt}>
                        {new Date(publication.createdAt).toLocaleString(
                          "fr-CA",
                          { dateStyle: "medium", timeStyle: "short" }
                        )}
                      </time>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {formulaire && (
        <div className="forum-overlay">
          <section
            className="forum-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forum-form-title"
          >
            <h2 id="forum-form-title">
              {formulaire.id ? "Modifier ma publication" : "Nouvelle publication"}
            </h2>

            <p>
              {etablissement.nom} · Informatique · Année {annee}
            </p>

            <form onSubmit={enregistrer}>
              <label>
                Ton nom — celui de ton compte
                <input value={compte?.pseudo || ""} readOnly />
              </label>

              {!formulaire.id && (
                <label>
                  Cours
                  <select
                    value={formulaire.etiquette}
                    onChange={(event) =>
                      setFormulaire({
                        ...formulaire,
                        etiquette: event.target.value,
                      })
                    }
                  >
                    <option value="Général">Général</option>
                    {coursParAnnee[annee].map((nom) => (
                      <option key={nom} value={nom}>{nom}</option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Titre
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={formulaire.titre}
                  onChange={(event) =>
                    setFormulaire({
                      ...formulaire,
                      titre: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Ta publication
                <textarea
                  required
                  rows={6}
                  maxLength={20000}
                  value={formulaire.contenu}
                  onChange={(event) =>
                    setFormulaire({
                      ...formulaire,
                      contenu: event.target.value,
                    })
                  }
                />
              </label>

              {erreur && <p className="forum-error" role="alert">{erreur}</p>}

              <div className="forum-modal-actions">
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => setFormulaire(null)}
                >
                  Annuler
                </button>

                <button
                  className="forum-primary"
                  type="submit"
                  disabled={
                    occupe ||
                    !compte ||
                    formulaire.titre.trim().length < 3 ||
                    !formulaire.contenu.trim()
                  }
                >
                  {occupe ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {suppression && (
        <div className="forum-overlay">
          <section
            className="forum-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forum-delete-title"
          >
            <h2 id="forum-delete-title">Supprimer cette publication ?</h2>
            <p>« {suppression.titre} » et ses commentaires seront supprimés.</p>

            {erreur && <p className="forum-error" role="alert">{erreur}</p>}

            <div className="forum-modal-actions">
              <button
                disabled={occupe}
                onClick={() => setSuppression(null)}
              >
                Annuler
              </button>
              <button
                className="forum-danger"
                disabled={occupe}
                onClick={supprimer}
              >
                {occupe ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}