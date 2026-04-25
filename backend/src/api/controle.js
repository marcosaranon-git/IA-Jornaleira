const supabase = require('../infra/supabase');
const { processarTextosPendentes } = require('../workers/processaTexto');

// Defina aqui a senha secreta para enviar notícias
const SENHA_MESTRE = "federacao"; // Você pode mudar para a senha que quiser!

async function receberTextoDiscord(req, res) {
    try {
        // Agora também esperamos receber uma 'senha'
        const { discord_id, nome_autor, texto_mensagem, id_mensagem, senha } = req.body;

        if (!discord_id || !texto_mensagem || !senha) {
            return res.status(400).json({ erro: "Faltam dados obrigatórios." });
        }

        // BARRICADA DE SEGURANÇA: Checa a senha
        if (senha !== SENHA_MESTRE) {
            console.log(`🚫 Tentativa de invasão bloqueada! Nação: ${nome_autor}`);
            return res.status(401).json({ erro: "Senha da Redação incorreta. Acesso negado." });
        }

        let { data: autor } = await supabase.from('authors').select('*').eq('discord_id', discord_id).single();

        if (!autor) {
            const novoAutor = await supabase.from('authors').insert([{ discord_id, name: nome_autor }]).select().single();
            autor = novoAutor.data;
        }

        const { error: erroInsert } = await supabase.from('raw_entries').insert([{
            author_id: autor.id,
            discord_message_id: id_mensagem,
            original_text: texto_mensagem,
            status: 'pending'
        }]);

        if (erroInsert) throw erroInsert;

        console.log(`📥 Nova mensagem de ${nome_autor} guardada na fila!`);
        res.status(200).json({ mensagem: "Notícia recebida com sucesso!" });

        processarTextosPendentes();

    } catch (erro) {
        console.error("Erro no webhook:", erro);
        res.status(500).json({ erro: "Erro ao processar a entrada." });
    }
}

async function obterUltimoJornal(req, res) {
    try {
        const { data, error } = await supabase.from('journals').select('*').order('created_at', { ascending: false }).limit(1).single();
        if (error) throw error;
        res.status(200).json(data);
    } catch (erro) {
        res.status(500).json({ erro: "Não foi possível carregar o jornal." });
    }
}

async function listarTodosJornais(req, res) {
    try {
        const { data, error } = await supabase.from('journals').select('id, created_at, content').order('created_at', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar acervo." });
    }
}

// NOVA ROTA: Puxa o Dossiê Geopolítico atualizado
async function obterDossieAtual(req, res) {
    try {
        const { data, error } = await supabase
            .from('world_memory')
            .select('state_json')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;
        res.status(200).json(data.state_json);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao carregar o Dossiê." });
    }
}

// Lembre-se de exportar a nova rota!
module.exports = { receberTextoDiscord, obterUltimoJornal, listarTodosJornais, obterDossieAtual };