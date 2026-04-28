require('dotenv').config(); 
const express = require('express');
const cors = require('cors'); // Puxando o CORS
const app = express();

app.use(cors()); // Liberando geral para o site conseguir ler os dado

app.get('/api/ping', (req, res) => {
    res.status(200).send("Estou acordado!");
});

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

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor do Jornal RPG escutando na porta ${PORT}`);
});

const cron = require('node-cron');
const { fecharEdicaoJornal } = require('./workers/fecharEdicao');

// Agendar para rodar a cada 3 dias (à meia-noite)
cron.schedule('0 0 */2 * *', () => {
  console.log("⏰ 2 dias se passaram. Iniciando fechamento automático da edição...");
  fecharEdicaoJornal();
});