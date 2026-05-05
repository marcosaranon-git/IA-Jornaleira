require('dotenv').config(); 
const { ligarBot } = require('./bot');
const express = require('express');
const cors = require('cors'); // Puxando o CORS
const app = express();

app.use(cors()); // Liberando geral para o site conseguir ler os dados

app.get('/api/ping', (req, res) => {
    res.status(200).send("Estou acordado!");
});

// ==========================================
// IMPORTAÇÕES DOS TRABALHADORES DA IA
// ==========================================
const { fecharEdicaoJornal } = require('./workers/fecharEdicao');

// ⚠️ ATENÇÃO AQUI: Troque "NOME_DO_SEU_ARQUIVO" pelo nome real do seu arquivo!
const { processarTextosPendentes } = require('./workers/NOME_DO_SEU_ARQUIVO');

// ==========================================
// ROTAS DE CHOQUE (BOTÕES DE PÂNICO)
// ==========================================

// Rota para forçar a PORTEIRA a processar os manuscritos pendentes
app.get('/api/forcar-porteira', async (req, res) => {
    console.log("🚪 Dando um choque na Porteira para processar a fila!");
    try {
        processarTextosPendentes(); // Nome corrigido e ativado!
        
        res.status(200).send("A Porteira foi acordada e está processando! Olhe os logs do Render.");
    } catch (erro) {
        console.error("Erro ao forçar a porteira:", erro);
        res.status(500).send("A Porteira tropeçou. Olhe o erro no Render.");
    }
});

// Rota para forçar a EDITORA CHEFE a criar o jornal
app.get('/api/forcar-edicao', (req, res) => {
    console.log("🚨 Acordando a Editora Chefe na marra!");
    fecharEdicaoJornal(); 
    res.status(200).send("A IA começou a escrever! Olhe os logs do Render.");
});

// ==========================================
// CONFIGURAÇÕES GERAIS E ROTAS DO SITE
// ==========================================
app.use(express.json());

require('./infra/supabase');
require('./infra/gemini');

// controlador
const { receberTextoDiscord, obterUltimoJornal, listarTodosJornais, obterDossieAtual } = require('./api/controle');

app.get('/', (req, res) => {
    res.send('O Motor do Jornal RPG está online! 🚀');
});

app.post('/api/webhooks/discord-entries', receberTextoDiscord);
app.get('/api/journals/latest', obterUltimoJornal);
app.get('/api/journals', listarTodosJornais);
app.get('/api/world-state', obterDossieAtual);

// ==========================================
// INICIALIZAÇÃO
// ==========================================
const PORT = process.env.PORT || 3333;

ligarBot();

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor do Jornal RPG escutando na porta ${PORT}`);
});

// ==========================================
// CRONÔMETROS (OS DESPERTADORES)
// ==========================================
const cron = require('node-cron');

// Despertador da Editora Chefe: Roda a cada 2 dias à meia-noite
cron.schedule('0 0 */2 * *', () => {
  console.log("⏰ 2 dias se passaram. Iniciando fechamento automático da edição...");
  fecharEdicaoJornal();
});

// Despertador da Porteira: Vai rodar a cada 5 minutos
cron.schedule('*/5 * * * *', () => {
    console.log("🚪 Checando gaveta de manuscritos...");
    processarTextosPendentes(); // Nome corrigido!
});