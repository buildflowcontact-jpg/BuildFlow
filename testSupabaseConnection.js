require('dotenv').config({ path: __dirname + '/.env' });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? '[OK]' : '[NON DÉFINIE]');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  const { data, error } = await supabase.from('projects').select('*').limit(1);
  if (error) {
    console.error('Erreur de connexion à Supabase :', error.message);
    process.exit(1);
  } else {
    console.log('Connexion réussie à Supabase ! Exemple de données :', data);
    process.exit(0);
  }
}

testConnection();
