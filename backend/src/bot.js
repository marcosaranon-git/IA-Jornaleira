const { Client, GatewayIntentBits } = require('discord.js');
const supabase = require('./infra/supabase');

// Prepara o bot com as permissões para ler o chat
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`🦅 Corvo do Discord online! Logado como ${client.user.tag}`);
});

// Fica escutando todas as mensagens
client.on('messageCreate', async (message) => {
    // Ignora mensagens de outros bots
    if (message.author.bot) return;

    // O Comando Mágico será: !noticia Nome da Nação | Texto do acontecimento
    if (message.content.startsWith('!noticia')) {
        const partes = message.content.replace('!noticia', '').split('|');

        if (partes.length < 2) {
            return message.reply("⚠️ **Formato incorreto!**\nUse: `!noticia Nome da Nação | Texto do que aconteceu`\nExemplo: `!noticia Japão | O império declarou embargo.`");
        }

        const nomeNacao = partes[0].trim();
        const textoFato = partes[1].trim();
        const discordId = message.author.id;

        try {
            // 1. Acha ou cria a ficha do autor no banco
            let { data: autor } = await supabase.from('authors').select('*').eq('discord_id', discordId).single();

            if (!autor) {
                const novoAutor = await supabase.from('authors').insert([{ discord_id: discordId, name: nomeNacao }]).select().single();
                autor = novoAutor.data;
            } else if (autor.name !== nomeNacao) {
                // Atualiza o nome da nação se o jogador tiver mudado
                await supabase.from('authors').update({ name: nomeNacao }).eq('id', autor.id);
            }

            // 2. Guarda o manuscrito na gaveta para a IA ler depois
            const { error: erroInsert } = await supabase.from('raw_entries').insert([{
                author_id: autor.id,
                discord_message_id: message.id,
                original_text: textoFato,
                status: 'pending'
            }]);

            if (erroInsert) throw erroInsert;

            // Reage e avisa que deu tudo certo!
            message.react('📜');
            message.reply(`✅ Manuscrito de **${nomeNacao}** entregue com sucesso à Redação de Carmesim!`);

        } catch (erro) {
            console.error("Erro ao salvar notícia do bot:", erro);
            message.reply("❌ O corvo se perdeu no caminho. Ocorreu um erro ao tentar arquivar o manuscrito. Avise o Mestre.");
        }
    }
});

// Função para dar a faísca inicial no bot
function ligarBot() {
    if (!process.env.DISCORD_TOKEN) {
        console.log("⚠️ Token do Discord não encontrado. O bot não vai acordar.");
        return;
    }
    client.login(process.env.DISCORD_TOKEN);
}

module.exports = { ligarBot };