const supabase = require('../infra/supabase');
const genAI = require('../infra/gemini');

async function gerarComRetry(prompt, tentativas = 3) {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    });

    for (let i = 1; i <= tentativas; i++) {
        try {
            const result = await model.generateContent(prompt);
            let textoCru = result.response.text();

            textoCru = textoCru.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            textoCru = textoCru.replace(/\n/g, ' ').trim(); 

            return JSON.parse(textoCru);
        } catch (erro) {
            console.log(`Falha na IA (Tentativa ${i}/${tentativas}). Corrigindo...`);
            if (i === tentativas) throw new Error("Falha critica apos 3 tentativas.");
        }
    }
}

async function fecharEdicaoJornal() {
    console.log("Iniciando fechamento da edicao e atualizacao de memoria...");

    try {
        const { data: segmentosBrutos, error: erroSegmentos } = await supabase
            .from('entry_segments')
            .select(`segment_text, categories ( name ), processed_entries!inner (is_used, raw_entries (authors ( name )))`)
            .eq('processed_entries.is_used', false);

        if (erroSegmentos || !segmentosBrutos || segmentosBrutos.length === 0) {
            console.log("Nada de novo para publicar hoje.");
            return;
        }

        const novosFatos = segmentosBrutos.map(seg => ({
            nacao: seg.processed_entries.raw_entries.authors.name,
            categoria: seg.categories.name,
            texto: seg.segment_text
        }));

        const { data: memoriaAntiga } = await supabase
            .from('world_memory')
            .select('state_json')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const contextoPassado = memoriaAntiga ? JSON.stringify(memoriaAntiga.state_json) : "O mundo comecou agora.";

        const prompt = `Você é a Editora Chefe do jornal geopolitico "Cronicas de Carmesim".

        ESTADO ANTERIOR DO MUNDO:
        ${contextoPassado}

        NOVOS FATOS:
        ${JSON.stringify(novosFatos)}

        DIRETRIZES DE REDACAO:
        1. TOM IMPARCIAL E SOBRIO: Escreva como uma analista veterana.
        2. FIDELIDADE ABSOLUTA: Respeite as noticias. Nunca invente atritos.
        3. CRUZAMENTO DE DADOS: Conecte os fatos de forma analitica.
        4. PROIBIDO USAR HTML: Escreva APENAS texto puro. Nenhuma tag html.
        5. SEJA CONCISA NO DOSSIE: Resuma a situacao interna e postura externa de cada nacao em NO MAXIMO 3 FRASES.

        Retorne EXATAMENTE este JSON puro:
        {
          "jornal_textos": {
            "destaques": "Resumo em texto puro dos destaques...",
            "politica": "Resumo em texto puro sobre politica...",
            "economia": "Resumo em texto puro sobre economia...",
            "conflitos": "Resumo em texto puro sobre conflitos..."
          },
          "novo_estado_mundo": {
            "nacoes_fichadas": [
              {
                "nome_nacao": "Nome da Nacao",
                "situacao_interna": "Resumo de ate 3 frases.",
                "postura_externa": "Resumo de ate 3 frases."
              }
            ],
            "tensoes_globais_ativas": ["Fato 1", "Fato 2"],
            "resumo_narrativo": "Resumo do clima mundial."
          },
          "conexoes_detectadas": ["Conexoes secretas."]
        }`;

        const resposta = await gerarComRetry(prompt);

        const classeHTML = "font-extrabold text-xl mt-6 mb-2 text-stone-800 border-b border-stone-300";
        const jornalFinalHTML = {
            destaques: `<h4 class='${classeHTML}'>Destaques Globais</h4><p>${resposta.jornal_textos.destaques}</p>`,
            politica: `<h4 class='${classeHTML}'>Cenario Politico</h4><p>${resposta.jornal_textos.politica}</p>`,
            economia: `<h4 class='${classeHTML}'>Movimentacoes Economicas</h4><p>${resposta.jornal_textos.economia}</p>`,
            conflitos: `<h4 class='${classeHTML}'>Relatorios de Conflito</h4><p>${resposta.jornal_textos.conflitos}</p>`
        };

        const { data: novoJornal, error: erroJornal } = await supabase
            .from('journals')
            .insert([{ pdf_url: null, content: jornalFinalHTML }])
            .select()
            .single();
            
        if(erroJornal) throw erroJornal;

        await supabase
            .from('world_memory')
            .insert([{ state_json: resposta.novo_estado_mundo }]);

        await supabase
            .from('processed_entries')
            .update({ is_used: true })
            .eq('is_used', false);

        console.log("Edicao finalizada com sucesso!");

    } catch (erro) {
        console.error("Erro no fechamento da edicao:", erro.message);
    }
}

module.exports = { fecharEdicaoJornal };