# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: create-project-flow.spec.ts >> parcours creation projet et tache
- Location: tests\e2e\create-project-flow.spec.ts:6:1

# Error details

```
Error: Login bloque sur /login - erreur: Load failed - loading: false
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - paragraph [ref=e8]: BuildFlow
      - heading "Gestion de projet moderne et collaborative." [level=1] [ref=e9]
      - paragraph [ref=e10]: Commencez gratuitement, centralisez vos tâches, documents, budget et communication d'équipe dans une interface agréable.
    - generic [ref=e11]:
      - generic [ref=e12]:
        - paragraph [ref=e13]: Temps réel
        - paragraph [ref=e14]: Synchronisation instantanée des modifications et commentaires.
      - generic [ref=e15]:
        - paragraph [ref=e16]: Multi-utilisateur
        - paragraph [ref=e17]: "Admin, chef de projet, membre : chaque rôle a son espace."
  - generic [ref=e18]:
    - generic [ref=e20]:
      - heading "Connexion" [level=2] [ref=e21]
      - paragraph [ref=e22]: Accédez à votre application de gestion en quelques secondes.
    - generic [ref=e23]:
      - generic [ref=e24]:
        - text: Adresse email
        - textbox "Adresse email" [ref=e25]:
          - /placeholder: vous@email.com
          - text: e2e-ci2@buildflow.test
      - generic [ref=e26]:
        - text: Mot de passe
        - textbox "Mot de passe" [ref=e27]:
          - /placeholder: ••••••••
          - text: BuildFlow@2026
      - generic [ref=e28]: Load failed
      - button "Se connecter" [ref=e29] [cursor=pointer]
    - button "Pas encore de compte ? Inscrivez-vous" [ref=e31] [cursor=pointer]
```

# Test source

```ts
  1  | ﻿import { test, expect } from '@playwright/test';
  2  | 
  3  | const E2E_EMAIL = process.env.E2E_USER_EMAIL;
  4  | const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;
  5  | 
  6  | test('parcours creation projet et tache', async ({ page }, testInfo) => {
  7  |   test.setTimeout(60_000);
  8  | 
  9  |   const suffix = `${testInfo.project.name}-${Date.now()}`;
  10 |   const projectName = `Projet E2E ${suffix}`;
  11 |   const taskName = `Tache E2E ${suffix}`;
  12 | 
  13 |   // Ce test necessite des credentials Supabase valides.
  14 |   // Definir E2E_USER_EMAIL et E2E_USER_PASSWORD dans l'environnement.
  15 |   if (!E2E_EMAIL || !E2E_PASSWORD) {
  16 |     test.skip(true, 'E2E_USER_EMAIL / E2E_USER_PASSWORD non definis - test ignore.');
  17 |   }
  18 | 
  19 |   // Aller a la page de connexion
  20 |   await page.goto('/');
  21 | 
  22 |   // Remplir le formulaire de connexion
  23 |   await page.getByLabel('Adresse email').fill(E2E_EMAIL!);
  24 |   await page.getByLabel('Mot de passe').fill(E2E_PASSWORD!);
  25 | 
  26 |   // Soumettre le formulaire
  27 |   await page.getByRole('button', { name: /se connecter/i }).click();
  28 | 
  29 |   // Attendre soit la redirection vers le dashboard, soit une erreur visible.
  30 |   await page.waitForFunction(
  31 |     () => window.location.pathname === '/' || Boolean(document.querySelector('.text-red-400')),
  32 |     { timeout: 20000 }
  33 |   );
  34 | 
  35 |   // Si on est toujours sur /login, remonter le message exact.
  36 |   if (page.url().endsWith('/login')) {
  37 |     const authError = page.locator('.text-red-400').first();
  38 |     const authErrorText = (await authError.isVisible({ timeout: 1000 }))
  39 |       ? (await authError.innerText()).trim()
  40 |       : 'Aucun message d\'erreur visible';
  41 |     const isLoading = await page.getByRole('button', { name: /patiente/i }).isVisible().catch(() => false);
> 42 |     throw new Error(`Login bloque sur /login - erreur: ${authErrorText} - loading: ${isLoading}`);
     |           ^ Error: Login bloque sur /login - erreur: Load failed - loading: false
  43 |   }
  44 | 
  45 |   // Attendre d'etre connecte (navigation vers le dashboard)
  46 |   await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
  47 |   await expect(page.getByRole('heading', { name: /vue d’ensemble de l’activité|vue d'ensemble de l'activite/i })).toBeVisible({ timeout: 20000 });
  48 | 
  49 |   // Aller a la liste des projets depuis le dashboard
  50 |   await page.getByRole('link', { name: /voir tous les projets/i }).click();
  51 |   await expect(page.getByRole('heading', { name: /tous vos projets/i })).toBeVisible({ timeout: 10000 });
  52 | 
  53 |   // Ouvrir la modale de creation de projet
  54 |   await page.getByRole('button', { name: 'Nouveau projet', exact: true }).click();
  55 |   await page.getByRole('button', { name: /projet vierge/i }).click();
  56 |   await page.getByPlaceholder(/application mobile buildflow/i).fill(projectName);
  57 |   await page.getByRole('button', { name: /créer le projet|creer le projet/i }).click();
  58 | 
  59 |   // Verifier que le projet apparait dans la liste
  60 |   await expect(page.getByRole('link', { name: new RegExp(projectName) })).toBeVisible({ timeout: 10000 });
  61 | 
  62 |   // Naviguer dans le projet > taches
  63 |   await page.getByRole('link', { name: new RegExp(projectName) }).click();
  64 |   await expect(page.getByRole('heading', { name: new RegExp(projectName) })).toBeVisible({ timeout: 10000 });
  65 |   await page.getByRole('link', { name: /gérer les tâches|gerer les taches/i }).click();
  66 |   await expect(page).toHaveURL(/\/projects\/[^/]+\/tasks$/, { timeout: 20000 });
  67 |   await expect(page.getByRole('heading', { name: /tâches du projet|taches du projet/i })).toBeVisible({ timeout: 20000 });
  68 | 
  69 |   // Ajouter une tache
  70 |   const openTaskModalCandidates = [
  71 |     page.getByRole('button', { name: 'Nouvelle tâche', exact: true }),
  72 |     page.getByRole('button', { name: /ajouter une tâche|ajouter une tache/i }).first(),
  73 |   ];
  74 | 
  75 |   let modalOpened = false;
  76 |   for (const candidate of openTaskModalCandidates) {
  77 |     const visible = await candidate.isVisible().catch(() => false);
  78 |     if (visible) {
  79 |       await candidate.click();
  80 |       modalOpened = true;
  81 |       break;
  82 |     }
  83 |   }
  84 | 
  85 |   if (!modalOpened) {
  86 |     throw new Error('Impossible de trouver un bouton pour ouvrir la modale de creation de tache.');
  87 |   }
  88 | 
  89 |   const taskModal = page.locator('.bf-modal-panel').last();
  90 |   await expect(taskModal.getByRole('heading', { name: /nouvelle tâche|nouvelle tache|nouvelle sous-tâche|nouvelle sous-tache/i })).toBeVisible({ timeout: 10000 });
  91 |   await taskModal.getByPlaceholder(/titre de la tâche|titre de la tache/i).fill(taskName);
  92 |   await taskModal.getByRole('button', { name: /^créer$|^creer$/i }).click();
  93 | 
  94 |   // Verifier que la tache apparait
  95 |   await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });
  96 | });
```