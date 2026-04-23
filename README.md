# BuildFlow - Application de Gestion de Projet

![Coverage](https://img.shields.io/badge/Coverage-20.43%25-red)

Une application complète de gestion de projet avec authentification multi-utilisateur, temps réel, et stockage cloud.

## Fonctionnalités

- ✅ Authentification email/mot de passe avec rôles (Admin, Chef de projet, Membre)
- ✅ Gestion des projets
- ✅ Gestion des tâches avec assignation
- ✅ Calendrier et planning
- ✅ Gestion budgétaire
- ✅ Bibliothèque de documents
- ✅ Gestion d'équipe
- ✅ Notifications et rapports KPI
- ✅ Intégration email/calendrier
- ✅ Mode offline avec synchronisation
- ✅ Temps réel (mises à jour tâches, chat, dashboard partagé)

## Stack Technique

### Frontend
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Apollo Client (GraphQL)
- Socket.IO (temps réel)

### Backend
- Node.js + Fastify
- GraphQL avec Apollo Server
- Socket.IO pour temps réel

### Base de données & Auth
- PostgreSQL sur Supabase
- Authentification JWT
- Stockage fichiers Supabase Storage

### Hébergement
- Frontend : Vercel
- Backend : Render
- Base : Supabase

## Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Remplir les variables d'environnement
npm run dev
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Remplir les variables d'environnement
npm run dev
```

## Configuration Supabase

1. Créer un projet sur [Supabase](https://supabase.com)
2. Créer les tables suivantes :

```sql
-- Users (géré par Supabase Auth)
-- Projects
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  budget DECIMAL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Team members
CREATE TABLE project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW()
);
```

3. Configurer les RLS (Row Level Security) pour la sécurité

## Déploiement

### Frontend (Vercel)
```bash
npm run build
# Deployer sur Vercel avec les variables d'env
```

### Backend (Render)
```bash
npm run build
# Deployer sur Render avec les variables d'env
```

## Protection et restauration des donnees

- Les donnees utilisateurs sont hebergees dans Supabase (PostgreSQL + Storage), separees du code applicatif.
- Une mise a jour frontend/backend ne doit jamais supprimer de donnees.
- Toute evolution de schema doit passer par des migrations versionnees.

Procedure recommandee:

1. Sauvegarder la base:

```powershell
./scripts/sql/backup-database.ps1 -ConnectionString "<DB_URL>" -Environment prod
```

2. Lancer les migrations avec preuve de sauvegarde:

```powershell
./scripts/sql/run-migration-sequence.ps1 -ConnectionString "<DB_URL>" -Environment prod -BackupPath "infra/backups/prod-pre-migration-YYYYMMDD-HHMMSS.dump"
```

Voir aussi :
- docs/DATA_PROTECTION_UPDATE_POLICY.md
- infra/restore-guide.md

## Roadmap

## Tests automatisés & Intégration Continue

### Lancer les tests en local

#### Frontend (unitaires, intégration, E2E)

Dans le dossier `frontend` :

```bash
# Tests unitaires et d'intégration
npm run test

# Rapport de couverture
npm run test -- --coverage

# Tests end-to-end (E2E) avec Playwright
npx playwright test

# Audit accessibilite navigateur
npx pa11y http://localhost:5173 --standard WCAG2AA --reporter cli

# Rapport HTML Playwright
npx playwright show-report
```

#### Scripts PowerShell (backup/restore)

Dans le dossier `scripts/sql` :

```powershell
# Test d'intégrité backup/restore
./test-backup-restore.ps1 -ConnectionString "<DB_URL>" -Environment dev

# Validation statique des scripts SQL de migration
./validate-migration-scripts.ps1 -SqlRoot ../../docs
```

### Intégration Continue (CI)

À chaque push, GitHub Actions exécute automatiquement :
- Les tests unitaires et d'intégration (Jest)
- Les tests E2E (Playwright)
- Le test d'intégrité backup/restore (PowerShell)
- Génère et archive les rapports de couverture (artefacts CI)

Consultez le workflow `.github/workflows/ci-full-app.yml` pour le détail.

- [ ] Implémentation complète des interfaces
- [ ] Mode offline avec IndexedDB
- [ ] Chat temps réel
- [ ] Notifications push
- [ ] Intégrations calendrier (Google Calendar)
- [ ] Exports PDF/Excel
- [ ] Essai 14 jours + paiement Stripe
- [ ] Mobile PWA

## Licence

Propriétaire - BuildFlow