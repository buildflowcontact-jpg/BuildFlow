import { test, expect } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

test('parcours creation projet et tache', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const projectName = `Projet E2E ${suffix}`;
  const taskName = `Tache E2E ${suffix}`;

  // Ce test necessite des credentials Supabase valides.
  // Definir E2E_USER_EMAIL et E2E_USER_PASSWORD dans l'environnement.
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    test.skip(true, 'E2E_USER_EMAIL / E2E_USER_PASSWORD non definis - test ignore.');
  }

  // Aller a la page de connexion
  await page.goto('/');

  // Remplir le formulaire de connexion
  await page.getByLabel('Adresse email').fill(E2E_EMAIL!);
  await page.getByLabel('Mot de passe').fill(E2E_PASSWORD!);

  // Soumettre le formulaire
  await page.getByRole('button', { name: /se connecter/i }).click();

  // Attendre soit la redirection vers le dashboard, soit une erreur visible.
  await page.waitForFunction(
    () => window.location.pathname === '/' || Boolean(document.querySelector('.text-red-400')),
    { timeout: 20000 }
  );

  // Si on est toujours sur /login, remonter le message exact.
  if (page.url().endsWith('/login')) {
    const authError = page.locator('.text-red-400').first();
    const authErrorText = (await authError.isVisible({ timeout: 1000 }))
      ? (await authError.innerText()).trim()
      : 'Aucun message d\'erreur visible';
    const isLoading = await page.getByRole('button', { name: /patiente/i }).isVisible().catch(() => false);
    throw new Error(`Login bloque sur /login - erreur: ${authErrorText} - loading: ${isLoading}`);
  }

  // Attendre d'etre connecte (navigation vers le dashboard)
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
  await expect(page.getByRole('heading', { name: /vue d’ensemble de l’activité|vue d'ensemble de l'activite/i })).toBeVisible({ timeout: 20000 });

  // Aller a la liste des projets depuis le dashboard
  await page.getByRole('link', { name: /voir tous les projets/i }).click();
  await expect(page.getByRole('heading', { name: /tous vos projets/i })).toBeVisible({ timeout: 10000 });

  // Ouvrir la modale de creation de projet
  await page.getByRole('button', { name: 'Nouveau projet', exact: true }).click();
  await page.getByRole('button', { name: /projet vierge/i }).click();
  await page.getByPlaceholder(/application mobile buildflow/i).fill(projectName);
  await page.getByRole('button', { name: /créer le projet|creer le projet/i }).click();

  // Verifier que le projet apparait dans la liste
  await expect(page.getByRole('link', { name: new RegExp(projectName) })).toBeVisible({ timeout: 10000 });

  // Naviguer dans le projet > taches
  await page.getByRole('link', { name: new RegExp(projectName) }).click();
  await expect(page.getByRole('heading', { name: new RegExp(projectName) })).toBeVisible({ timeout: 10000 });
  await page.getByRole('link', { name: /tâches|taches/i }).click();

  // Ajouter une tache
  await page.getByRole('button', { name: /nouvelle tâche|nouvelle tache/i }).click();
  await page.getByPlaceholder(/titre de la tâche|titre de la tache/i).fill(taskName);
  await page.getByRole('button', { name: /^créer$|^creer$/i }).click();

  // Verifier que la tache apparait
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });
});