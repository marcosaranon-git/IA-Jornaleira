// Puxa a biblioteca que consegue ler o nosso arquivo .env
require('dotenv').config(); 

// Puxa a ferramenta oficial do Supabase
const { createClient } = require('@supabase/supabase-js');

// Aqui o código vai no .env e pega as senhas que você colocou lá
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Faz a verificação de segurança (se esquecer o .env, ele avisa)
if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Faltam as chaves do Supabase no arquivo .env!");
    process.exit(1);
}

// Cria a conexão oficial com o banco
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("✅ Conexão com o banco de dados preparada!");

// Exporta essa conexão para que o resto do nosso sistema possa usar
module.exports = supabase;