#!/usr/bin/env node
/**
 * setup-e2e-user.js
 *
 * Crée (ou réinitialise) l'utilisateur de test E2E dans Supabase Auth.
 * Utilise l'API Admin Supabase (service_role key) — NE PAS exposer en frontend.
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL            URL de ton projet Supabase
 *   SUPABASE_SERVICE_ROLE_KEY  Clé service_role (Settings > API)
 *   E2E_USER_EMAIL          Email du compte de test à créer
 *   E2E_USER_PASSWORD       Mot de passe du compte de test
 *
 * Usage :
 *   node scripts/setup-e2e-user.js
 */

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'E2E_USER_EMAIL', 'E2E_USER_PASSWORD'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('[setup-e2e-user] Variables manquantes :', missing.join(', '));
  process.exit(1);
}

const SUPABASE_URL          = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const E2E_EMAIL             = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD          = process.env.E2E_USER_PASSWORD;

const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
};

async function listUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: ADMIN_HEADERS,
  });
  if (!res.ok) throw new Error(`listUsers HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.users ?? [];
}

async function createUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true, // compte confirmé directement, pas besoin d'e-mail
    }),
  });
  if (!res.ok) throw new Error(`createUser HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

async function updatePassword(userId, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`updatePassword HTTP ${res.status}: ${await res.text()}`);
}

async function cleanupE2EData(userId) {
  // Supprime les projets créés par cet utilisateur lors des runs E2E précédents
  // (nommés "Projet E2E") pour éviter l'accumulation de données en base.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/projects?name=eq.Projet+E2E&created_by=eq.${userId}`,
    {
      method: 'DELETE',
      headers: { ...ADMIN_HEADERS, Prefer: 'return=minimal' },
    }
  );
  if (!res.ok) {
    // Pas bloquant — on log et on continue
    console.warn('[setup-e2e-user] Cleanup projets E2E non critique :', res.status);
  }
}

async function main() {
  console.log('[setup-e2e-user] Recherche du compte E2E :', E2E_EMAIL);

  const users = await listUsers();
  const existing = users.find((u) => u.email === E2E_EMAIL);

  let userId;
  if (existing) {
    console.log('[setup-e2e-user] Compte existant trouvé — réinitialisation du mot de passe.');
    await updatePassword(existing.id, E2E_PASSWORD);
    userId = existing.id;
  } else {
    console.log('[setup-e2e-user] Compte introuvable — création.');
    userId = await createUser(E2E_EMAIL, E2E_PASSWORD);
  }

  console.log('[setup-e2e-user] Nettoyage des données E2E précédentes...');
  await cleanupE2EData(userId);

  console.log('[setup-e2e-user] Compte E2E prêt. ID :', userId);
}

main().catch((err) => {
  console.error('[setup-e2e-user] Erreur :', err.message);
  process.exit(1);
});
