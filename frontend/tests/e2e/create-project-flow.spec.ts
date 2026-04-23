import { test, expect } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

test('parcours creation projet et tache', async ({ page }) => {
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

  // Verifier si une erreur d'auth est remontee
  const authError = page.locator('[class*="red-400"]');
  if (await authError.isVisible({ timeout: 4000 })) {
    const msg = await authError.innerText();
    throw new Error('Erreur d\'authentification: ' + msg);
  }

  // Attendre d'etre connecte (navigation vers le dashboard)
  await expect(page.getByRole('heading', { name: /projets/i })).toBeVisible({ timeout: 20000 });

  // Ouvrir la modale de creation de projet
  await page.getByRole('button', { name: /nouveau projet/i }).click();
  await page.getByPlaceholder(/nom du projet/i).fill('Projet E2E');
  await page.getByRole('button', { name: /^creer$|^ok$/i }).click();

  // Verifier que le projet apparait dans la liste
  await expect(page.getByText('Projet E2E')).toBeVisible({ timeout: 10000 });

  // Naviguer dans le projet > taches
  await page.getByText('Projet E2E').click();
  await page.getByRole('link', { name: /taches/i }).click();

  // Ajouter une tache
  await page.getByRole('button', { name: /nouvelle tache/i }).click();
  await page.getByPlaceholder(/titre de la tache/i).fill('Tache E2E');
  await page.getByRole('button', { name: /^creer$/i }).click();

  // Verifier que la tache apparait
  await expect(page.getByText('Tache E2E')).toBeVisible({ timeout: 10000 });
});