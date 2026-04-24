# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: task-status-flow.spec.ts >> changement de statut d'une tache via l'UI
- Location: tests\e2e\task-status-flow.spec.ts:6:1

# Error details

```
Error: Login bloque - NetworkError when attempting to fetch resource.
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
      - generic [ref=e28]: NetworkError when attempting to fetch resource.
      - button "Se connecter" [ref=e29] [cursor=pointer]
    - button "Pas encore de compte ? Inscrivez-vous" [ref=e31] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const E2E_EMAIL = process.env.E2E_USER_EMAIL;
  4   | const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;
  5   | 
  6   | test('changement de statut d\'une tache via l\'UI', async ({ page }, testInfo) => {
  7   |   test.setTimeout(90_000);
  8   | 
  9   |   const suffix = `${testInfo.project.name}-${Date.now()}`;
  10  |   const projectName = `Projet Status E2E ${suffix}`;
  11  |   const taskName = `Tache Status E2E ${suffix}`;
  12  | 
  13  |   if (!E2E_EMAIL || !E2E_PASSWORD) {
  14  |     test.skip(true, 'E2E_USER_EMAIL / E2E_USER_PASSWORD non definis - test ignore.');
  15  |   }
  16  | 
  17  |   // ── Connexion ──
  18  |   await page.goto('/');
  19  |   await page.getByLabel('Adresse email').fill(E2E_EMAIL!);
  20  |   await page.getByLabel('Mot de passe').fill(E2E_PASSWORD!);
  21  |   await page.getByRole('button', { name: /se connecter/i }).click();
  22  | 
  23  |   await page.waitForFunction(
  24  |     () => window.location.pathname === '/' || Boolean(document.querySelector('.text-red-400')),
  25  |     { timeout: 20_000 }
  26  |   );
  27  | 
  28  |   if (page.url().includes('/login')) {
  29  |     const authError = page.locator('.text-red-400').first();
  30  |     const msg = (await authError.isVisible({ timeout: 1000 }))
  31  |       ? (await authError.innerText()).trim()
  32  |       : 'Aucun message visible';
> 33  |     throw new Error(`Login bloque - ${msg}`);
      |           ^ Error: Login bloque - NetworkError when attempting to fetch resource.
  34  |   }
  35  | 
  36  |   await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  37  | 
  38  |   // ── Creer un projet ──
  39  |   await page.getByRole('link', { name: /voir tous les projets/i }).click();
  40  |   await expect(page.getByRole('heading', { name: /tous vos projets/i })).toBeVisible({ timeout: 10_000 });
  41  | 
  42  |   await page.getByRole('button', { name: 'Nouveau projet', exact: true }).click();
  43  |   await page.getByRole('button', { name: /projet vierge/i }).click();
  44  |   await page.getByPlaceholder(/application mobile buildflow/i).fill(projectName);
  45  |   await page.getByRole('button', { name: /créer le projet|creer le projet/i }).click();
  46  |   await expect(page.getByRole('link', { name: new RegExp(projectName) })).toBeVisible({ timeout: 10_000 });
  47  | 
  48  |   // ── Naviguer vers les taches du projet ──
  49  |   await page.getByRole('link', { name: new RegExp(projectName) }).click();
  50  |   await page.getByRole('link', { name: /gérer les tâches|gerer les taches/i }).click();
  51  |   await expect(page).toHaveURL(/\/projects\/[^/]+\/tasks$/, { timeout: 20_000 });
  52  | 
  53  |   let effectiveTaskName = taskName;
  54  | 
  55  |   // ── Creer une tache avec statut "A faire" (todo) ──
  56  |   const openButtonCandidates = [
  57  |     page.getByRole('button', { name: 'Nouvelle tâche', exact: true }),
  58  |     page.getByRole('button', { name: /nouvelle tache/i }).first(),
  59  |     page.getByRole('button', { name: /ajouter une tâche|ajouter une tache/i }).first(),
  60  |   ];
  61  | 
  62  |   let opened = false;
  63  |   for (const btn of openButtonCandidates) {
  64  |     if (await btn.isVisible().catch(() => false)) {
  65  |       await btn.click();
  66  |       opened = true;
  67  |       break;
  68  |     }
  69  |   }
  70  | 
  71  |   if (opened) {
  72  |     // Remplir le nom de la tache dans la modale
  73  |     const titleInput = page
  74  |       .getByRole('dialog')
  75  |       .getByRole('textbox', { name: /titre|nom/i })
  76  |       .first();
  77  |     await titleInput.fill(taskName);
  78  |     await page.getByRole('button', { name: /créer|ajouter|enregistrer|valider/i }).last().click();
  79  | 
  80  |     // Verifier que la tache apparait dans la colonne "A faire"
  81  |     await expect(page.locator(`text=${taskName}`).first()).toBeVisible({ timeout: 15_000 });
  82  |   } else {
  83  |     // Fallback: l'utilisateur E2E peut ne pas avoir le rôle manager (pas de bouton "Nouvelle tâche").
  84  |     // Dans ce cas, on réutilise une tâche existante pour valider le changement de statut.
  85  |     const existingTaskTrigger = page.locator('[aria-label^="Ouvrir la tâche "]').first();
  86  |     if (!(await existingTaskTrigger.isVisible().catch(() => false))) {
  87  |       test.skip(true, 'Aucune tâche visible et création non autorisée pour cet utilisateur E2E.');
  88  |     }
  89  | 
  90  |     const ariaLabel = await existingTaskTrigger.getAttribute('aria-label');
  91  |     const extracted = ariaLabel?.replace(/^Ouvrir la tâche\s+/, '').trim();
  92  |     if (extracted) {
  93  |       effectiveTaskName = extracted;
  94  |     }
  95  |   }
  96  | 
  97  |   const taskCard = page.locator(`text=${effectiveTaskName}`).first();
  98  |   await expect(taskCard).toBeVisible({ timeout: 15_000 });
  99  | 
  100 |   // ── Changer le statut vers "En cours" ──
  101 |   // Chercher un selecteur de statut ou un bouton de transition a proximite de la tache
  102 |   const taskRow = page.locator('[data-testid="task-card"], .task-card, [class*="task"]').filter({ hasText: effectiveTaskName }).first();
  103 | 
  104 |   // Tenter via le menu contextuel ou le select de statut sur la carte
  105 |   const statusTrigger = taskRow
  106 |     .locator('button, select, [role="combobox"], [role="button"]')
  107 |     .filter({ hasText: /todo|a faire|à faire/i })
  108 |     .first();
  109 | 
  110 |   const triggerVisible = await statusTrigger.isVisible({ timeout: 3_000 }).catch(() => false);
  111 | 
  112 |   if (triggerVisible) {
  113 |     await statusTrigger.click();
  114 |     // Selectionner "En cours"
  115 |     const inProgressOption = page.locator('[role="option"], option, li, button').filter({ hasText: /en cours|in.progress/i }).first();
  116 |     if (await inProgressOption.isVisible({ timeout: 3_000 })) {
  117 |       await inProgressOption.click();
  118 |     }
  119 |   } else {
  120 |     // Fallback: cliquer sur la carte et chercher le champ statut dans le detail
  121 |     await taskCard.click();
  122 |     const detailStatusBtn = page.locator('[role="dialog"], aside, .task-detail')
  123 |       .locator('button, select, [role="combobox"]')
  124 |       .filter({ hasText: /todo|a faire|à faire/i })
  125 |       .first();
  126 |     if (await detailStatusBtn.isVisible({ timeout: 5_000 })) {
  127 |       await detailStatusBtn.click();
  128 |       const option = page.locator('[role="option"], option, li').filter({ hasText: /en cours|in.progress/i }).first();
  129 |       if (await option.isVisible({ timeout: 3_000 })) {
  130 |         await option.click();
  131 |       }
  132 |     }
  133 |   }
```