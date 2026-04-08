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

async function addAttachmentUrlColumn() {
  try {
    console.log('\n🔧 Adicionando coluna attachment_url à tabela failure_manuals...\n');

    // Verificar se a coluna já existe
    console.log('📋 Verificando estrutura da tabela...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'failure_manuals')
      .eq('column_name', 'attachment_url');

    if (columnsError) {
      console.log('❌ Erro ao verificar colunas. Tentando adicionar diretamente...');
    } else if (columns && columns.length > 0) {
      console.log('✅ Coluna attachment_url já existe!');
      process.exit(0);
    }

    // Adicionar a coluna
    console.log('➕ Adicionando coluna attachment_url...');
    const { error: alterError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE failure_manuals
        ADD COLUMN IF NOT EXISTS attachment_url text;
      `
    });

    if (alterError) {
      console.error('\n❌ Erro ao adicionar coluna via RPC:', alterError.message);
      console.log('\n💡 Execute este comando no Supabase SQL Editor:\n');
      console.log(`
ALTER TABLE failure_manuals
ADD COLUMN IF NOT EXISTS attachment_url text;
      `);
      process.exit(1);
    }

    console.log('\n✅ Coluna attachment_url adicionada com sucesso!');
    console.log('   Agora você pode fazer upload de PDFs com fotos de alarmes.\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Erro na execução:', err.message || err);
    process.exit(1);
  }
}

addAttachmentUrlColumn();