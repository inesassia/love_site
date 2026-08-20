# Love Site — Site de rencontre chrétien (MVP)

## Contexte & objectif

Site de rencontre destiné à un public chrétien francophone international (pas de
limite géographique précise, ouvert à la diaspora et à la communauté chrétienne
francophone). L'objectif combine deux dimensions :

1. **Mise en relation sérieuse** orientée mariage / relation durable, ancrée
   dans des valeurs chrétiennes.
2. **Dimension communautaire** — explicitement hors scope pour le MVP (voir
   "Hors scope"), mais fait partie de la vision produit à plus long terme.

Le MVP se concentre sur le cœur du produit : profils, découverte, matching par
like mutuel, messagerie basique, et une modération minimale mais fonctionnelle.

## Stack technique

- **Framework** : Next.js (App Router), projet full-stack unique (UI + API via
  server actions / route handlers)
- **Base de données** : PostgreSQL, accédée via Prisma (migrations + typage)
- **Authentification** : email + mot de passe, sessions via NextAuth
  (Credentials provider)
- **Stockage des photos** : Vercel Blob
- **Déploiement** : Vercel (app) + Neon ou équivalent (Postgres managé)
- **Langue** : interface en français

## Modèle de données

### User
- `id`
- `email` (unique)
- `passwordHash` (bcrypt)
- `role` : `user` | `admin`
- `suspended` : bool (défaut `false`)
- `createdAt`

### Profile
- `userId` (1:1 avec User)
- `firstName`
- `birthDate`
- `gender` : `homme` | `femme` — **seule valeur possible**, pas de champ
  "genre recherché" distinct : le matching est automatiquement hétérosexuel
  (un homme ne voit que des profils femme, et inversement). Cette règle est
  imposée par le système, pas laissée au choix de l'utilisateur.
- `city`
- `country`
- `bio` (texte libre)
- `denomination` : enum (`évangélique`, `catholique`, `protestant`,
  `orthodoxe`, `autre`)
- `churchAttendance` : fréquence de fréquentation d'église (enum simple :
  `régulièrement`, `occasionnellement`, `rarement`)
- `marriageVision` : texte libre — vision du mariage / de la famille
- `favoriteVerseOrValue` : texte libre — verset ou valeur préférée
- `photos` : liste d'URLs (1 à 6), stockées via Vercel Blob

### Like
- `fromUserId`
- `toUserId`
- `createdAt`
- Une ligne par like envoyé. Un match est déduit dynamiquement : il existe un
  match entre A et B si un `Like(A→B)` et un `Like(B→A)` existent tous les deux.

### Match (vue calculée ou table matérialisée)
- Représente une paire mutuellement likée ; sert de point d'ancrage pour les
  conversations. Peut être implémenté comme table dédiée créée au moment où
  le second like complète la paire (plus simple pour la messagerie que de
  recalculer à chaque fois).

### Message
- `matchId`
- `senderId`
- `content`
- `sentAt`
- `read` : bool

### Report
- `reporterId`
- `reportedUserId`
- `category` : enum (`faux profil`, `comportement inapproprié`,
  `contenu offensant`, `autre`)
- `reason` : texte libre
- `status` : `en attente` | `traité` | `ignoré`
- `createdAt`

### Block
- `blockerId`
- `blockedUserId`
- Un blocage masque réciproquement les deux profils partout dans l'app
  (découverte, recherche, messagerie).

## Fonctionnalités & flux principaux

### Inscription & profil
1. Création de compte par email/mot de passe.
2. Création obligatoire du profil (infos personnelles, dénomination, valeurs,
   au moins 1 photo) avant tout accès à la découverte de profils.

### Découverte
- Liste/grille de profils, filtrable par âge, ville, pays, dénomination.
- Toujours restreinte au sexe opposé (règle système, non contournable côté
  utilisateur).
- Exclut les profils bloqués (dans les deux sens) et les comptes suspendus.

### Like & matching
- Bouton "j'aime" sur un profil consulté.
- Si l'autre utilisateur a déjà liké en retour, un match est créé
  automatiquement et la conversation s'ouvre.

### Messagerie
- Liste des matchs actifs.
- Conversation texte simple par match.
- Pas de temps réel exigé pour le MVP : rafraîchissement / polling suffisant.

### Signalement & blocage
- Accessible depuis un profil ou une conversation.
- Signalement : catégorie + raison libre, stocké avec statut `en attente`.
- Blocage : effet immédiat et réciproque.

### Administration
- Champ `role` sur `User` (`user` / `admin`) ; pas d'interface pour créer un
  admin — le premier admin est créé directement en base ou via un script de
  seed.
- Route protégée `/admin`, accessible uniquement aux comptes `role = admin`.
- Fonctionnalités admin :
  - Liste des signalements, triable par statut et date.
  - Détail d'un signalement : profil signalé, raison, catégorie, historique.
  - Actions : marquer `traité`, marquer `ignoré`, suspendre le compte signalé
    (`User.suspended = true`, bloque la connexion).

## Sécurité

- Mots de passe hashés avec bcrypt.
- Sessions via cookies httpOnly (gérées par NextAuth).
- Pas de validation manuelle des photos avant publication en v1.
- Aucune fonctionnalité (découverte, like, messagerie) n'expose de profils de
  même sexe entre eux — contrainte produit explicite du site, appliquée au
  niveau des requêtes serveur, jamais laissée à un paramètre utilisateur.

## Hors scope (MVP)

- Groupes, forums, événements communautaires.
- Chat en temps réel (WebSocket).
- Vérification d'identité / KYC.
- Paiement / abonnement premium.
- Validation manuelle des photos avant publication.

## Étapes suivantes

Ce document sert de base à un plan d'implémentation détaillé (via la skill
`writing-plans`), découpé en étapes testables (auth, profils, découverte,
like/match, messagerie, signalement/blocage, admin).
