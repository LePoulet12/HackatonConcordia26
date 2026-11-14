# Horaire et transport

Utiliser Node.js 24. Copier `.env.example` dans `.env` sous `backend` et renseigner `MONGO_URI` (connexion MongoDB) et `JWT_SECRET` (secret du backend pour signer les jetons des comptes). Le fichier `.env` est ignoré par Git.

Lancer `npm install` puis `npm run dev` dans chacun des dossiers `backend` et `frontend`, dans deux terminaux. Vite transmet les requêtes `/api` à `127.0.0.1:5000` par défaut. Si le serveur utilise un autre port, définir `CAMPUS_API_URL` avant de lancer Vite.

Sur **Horaire et bus**, se connecter avec son compte ou en créer un. Le bouton **Ajouter un cours** enregistre une entrée datée sur le compte. Les cours et trajets sont rechargés avec le même compte via `GET /api/horaire`.

Pour planifier un déplacement, entrer « Terminus Terrebonne », garder « Collège Montmorency, Laval » et choisir une date et une heure d’arrivée, par exemple lundi à 8 h. Après le calcul, **Ajouter chaque semaine** enregistre un trajet récurrent à partir de la date choisie. Ses heures et ses étapes sont celles du trajet calculé. Le calendrier affiche la plage prévue, marche incluse. Cliquer sur l’entrée ouvre les étapes enregistrées.

Le calcul utilise [Transitous](https://transitous.org/api/) sans clé API ni compte de facturation. L’API publique accepte les essais légers de prototypes. Pour un usage régulier, suivre ses conditions pour les projets open source non commerciaux. L’heure saisie correspond au fuseau de Montréal. Le calcul tient compte des [réseaux couverts](https://transitous.org/sources/) et des mises à jour en temps réel disponibles à la recherche.


## Données de démo dans Compass

Pour un MongoDB local, renseigner par exemple `MONGO_URI=mongodb://127.0.0.1:27017/campus` dans `backend/.env`. Dans le terminal, depuis la racine du projet, exécuter :

```powershell
cd backend
npm install
npm run seed
```

Dans Compass, se connecter au même serveur et actualiser la liste des bases. La base indiquée par le script contient les collections `utilisateurs`, `etablissements`, `publications` et `commentaires`. Dans le document de `etudiant@campus.example`, ouvrir le champ `horaire` pour voir ses cours et son trajet d’exemple.

Pour tester dans l’application, utiliser `etudiant@campus.example` avec le mot de passe de démo affiché dans le terminal. L’horaire d’exemple est daté de la semaine où le compte a été créé. Le script peut être relancé sans écraser les documents existants. Utiliser le compte de démo dans une base de développement.

Dans **Horaire et bus**, le bouton **Importer un horaire** accepte les fichiers `.ics` de 1 Mo ou moins, jusqu’à 2 000 événements ou occurrences par fichier. Les événements sont ajoutés au compte connecté. Réimporter le même fichier conserve les entrées déjà présentes. Les séries sans date de fin sont importées sur un an à partir de leur première occurrence.
