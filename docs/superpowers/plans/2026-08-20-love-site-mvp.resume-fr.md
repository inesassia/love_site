# Résumé en français du plan d'implémentation MVP

> Ce document est une lecture en français du plan d'exécution officiel
> (`2026-08-20-love-site-mvp.md`). **Ce n'est pas** le document utilisé pour
> l'exécution automatisée (subagent-driven-development) — celui-ci reste en
> anglais car les scripts d'automatisation reconnaissent des mots-clés
> précis (`## Task N:`, `**Files:**`, `**Step N:`...). Ce résumé sert
> uniquement à comprendre ce qui va être construit, tâche par tâche.

**Objectif du projet :** MVP d'un site de rencontre chrétien — inscription/connexion, profils, découverte de profils (toujours hétérosexuelle, imposée côté serveur), matching par like mutuel, messagerie basique, signalement/blocage, et un panneau admin de gestion des signalements.

**Stack :** Next.js 14 (App Router, TypeScript), PostgreSQL via Prisma, NextAuth (connexion par email/mot de passe), bcryptjs pour les mots de passe, zod pour la validation, stockage photo S3-compatible (Cloudflare R2 en démo, MinIO sur le VPS plus tard), Vitest pour les tests.

**Contraintes globales (valables sur toutes les tâches) :**
- Le matching est **toujours hétérosexuel et imposé par le serveur** — aucun champ ni paramètre ne permet à un utilisateur de choisir autre chose.
- Le genre d'un profil ne peut être que `homme` ou `femme`.
- Aucune API propriétaire Vercel (Blob, KV...) — tout le stockage passe par le client S3-compatible, pour que le code tourne sans changement sur le VPS.
- Pas de modération manuelle des photos dans le MVP.
- Pas de temps réel exigé pour la messagerie (un rafraîchissement périodique suffit).
- Les mots de passe sont toujours stockés hashés (bcrypt), jamais en clair.
- Interface en français partout.

---

## Tâche 1 — Mise en place du projet

Crée le projet Next.js (TypeScript, App Router), installe les dépendances (Prisma, NextAuth, bcryptjs, zod, client S3, Vitest), configure une base Postgres locale via Docker, un fichier `.env` avec toutes les variables nécessaires, et un module `src/lib/env.ts` qui valide au démarrage que ces variables sont bien présentes. Testé par : validation qu'un environnement complet est accepté et qu'un environnement incomplet fait échouer le démarrage.

## Tâche 2 — Schéma de base de données

Écrit le schéma Prisma complet : `User`, `Profile`, `Like`, `Match`, `Message`, `Report`, `Block`, avec les enums (`Role`, `Gender`, `Denomination`, `ChurchAttendance`, `ReportCategory`, `ReportStatus`). Crée le client Prisma partagé et un utilitaire de test qui vide les tables entre deux tests. Testé par : création et relecture d'un utilisateur, vérification des valeurs par défaut (`role`, `suspended`).

## Tâche 3 — Hashage des mots de passe & inscription

Ajoute les fonctions de hashage/vérification de mot de passe (bcrypt) et la route d'inscription (`POST /api/register`) qui valide l'email/mot de passe, refuse les doublons d'email, et crée l'utilisateur avec un mot de passe hashé. Ajoute une page d'inscription simple. Testé par : hash/vérification correcte, création réussie, rejet d'un email invalide ou déjà utilisé.

## Tâche 4 — Connexion (NextAuth)

Configure NextAuth avec un fournisseur email/mot de passe. La fonction `authorizeCredentials` vérifie les identifiants et **refuse la connexion si le compte est suspendu**, même avec le bon mot de passe. Ajoute la page de connexion. Testé par : connexion réussie avec les bons identifiants, échec avec un mauvais mot de passe, échec pour un email inconnu, échec pour un compte suspendu.

## Tâche 5 — Création & édition du profil

Ajoute le schéma de validation du profil (prénom, date de naissance avec vérification 18 ans minimum, genre limité à homme/femme, ville, pays, bio, dénomination, fréquence de fréquentation d'église, vision du mariage, verset/valeur préférée) et la route `/api/profile` pour créer/mettre à jour son profil. Ajoute la page d'édition de profil. Testé par : validation acceptant un profil correct, rejet d'un profil de moins de 18 ans ou d'un genre invalide, création réussie en base.

## Tâche 6 — Upload de photos (stockage S3-compatible)

Ajoute un module de stockage qui envoie les photos vers un bucket S3-compatible (R2 en démo, MinIO en prod) et retourne l'URL publique. La route d'upload vérifie le type de fichier, la taille (max 5 Mo), et la limite de 6 photos par profil, puis ajoute l'URL à la liste des photos du profil. Testé par : upload simulé (le vrai appel réseau est mocké dans les tests), rejet d'un type de fichier non autorisé, ajout effectif de l'URL au profil.

## Tâche 7 — Fil de découverte

Ajoute la fonction `getDiscoverableProfiles` qui renvoie les profils du sexe opposé (règle imposée par le code, jamais par un choix utilisateur), en excluant les comptes suspendus et les profils bloqués mutuellement, avec des filtres optionnels (ville, pays, dénomination, âge). Ajoute la page de découverte. Testé par : seul le sexe opposé apparaît, les comptes suspendus et bloqués sont exclus, le filtre par ville fonctionne.

## Tâche 8 — Likes & matching

Ajoute la fonction `likeUser` : un like simple ne crée pas de match ; un like mutuel crée automatiquement un `Match`. Idempotent (aimer deux fois ne duplique rien), et refuse de s'aimer soi-même. Câble le bouton "J'aime" sur la page de découverte. Testé par : like à sens unique sans match, like mutuel créant un match, idempotence, auto-like refusé.

## Tâche 9 — Messagerie

Ajoute les fonctions d'envoi/liste de messages, restreintes aux deux participants d'un match, et la liste des matchs d'un utilisateur. Ajoute la page de liste des conversations et la page de conversation (rafraîchissement périodique, pas de temps réel). Testé par : un participant peut envoyer un message, un non-participant est rejeté, les messages sont bien triés chronologiquement, seuls les matchs de l'utilisateur sont listés.

## Tâche 10 — Signalement & blocage

Ajoute les fonctions de signalement (catégorie + raison, statut initial "en attente") et de blocage (réciproque et immédiat). Vérifie que le blocage retire bien l'utilisateur bloqué du fil de découverte. Câble les actions "Signaler"/"Bloquer" sur les pages de découverte et de conversation. Testé par : création d'un signalement, refus de s'auto-signaler/s'auto-bloquer, idempotence du blocage, disparition immédiate du profil bloqué en découverte.

## Tâche 11 — Administration des signalements

Ajoute un rôle `admin` sur les utilisateurs, une route protégée `/admin` (redirection vers `/login` si non-admin), la liste des signalements avec actions (marquer traité, ignorer, suspendre le compte signalé), et un script pour créer le premier compte admin (`npm run db:seed`, à partir des variables `ADMIN_EMAIL`/`ADMIN_PASSWORD`). Testé par : filtrage des signalements par statut, suspension effective d'un compte (qui ne peut alors plus se connecter, grâce à la règle de la Tâche 4).

---

**Ordre d'exécution :** les tâches s'enchaînent dans cet ordre car chacune s'appuie sur les fonctions produites par les précédentes (ex. la Tâche 9 a besoin des `Match` créés par la Tâche 8 ; la Tâche 11 réutilise la règle "compte suspendu" de la Tâche 4). C'est cet ordre qui sera suivi lors de l'exécution automatisée, un sous-agent par tâche avec revue de code après chacune.
