import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAdmin() {
  const email = 'felipe.sdo17@gmail.com';
  
  try {
    console.log('\n🔧 Configurando permissões de admin...\n');

    console.log('👤 Definindo admin para:', email);
    const { data, error } = await supabase
      .from('user_roles')
      .upsert({ email: email.toLowerCase(), role: 'admin' }, { onConflict: 'email' });
    
    if (error) {
      console.error('\n❌ Erro ao definir admin:', error.message || error);
      if (error.code === 'PGRST205' || error.message?.includes('not found')) {
        console.log('\n💡 A tabela user_roles não foi encontrada.');
        console.log('   Execute este comando no Supabase SQL Editor para criar a tabela:\n');
        console.log(`
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'gestor', 'usuario')),
  created_at timestamp DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Insira seu email como admin
INSERT INTO user_roles (email, role) VALUES ('${email}', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';
        `);
      }
      process.exit(1);
    }
    
    console.log('\n✅ Admin definido com sucesso!');
    console.log('   E-mail: ' + email);
    console.log('   Papel: admin\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erro na execução:', err.message || err);
    process.exit(1);
  }
}

setupAdmin();
