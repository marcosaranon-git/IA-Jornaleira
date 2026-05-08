const supabase = require('../infra/supabase');
const genAI = require('../infra/gemini');

// 🛡️ MOTOR BLINDADO COM CÂMERA DE SEGURANÇA
async function gerarComRetry(prompt, nomeTarefa, tentativas = 3) {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
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
            
            // Faxina
            textoCru = textoCru.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            textoCru = textoCru.replace(/\n/g, ' ').trim(); 

            // Câmera de Segurança: Tenta ler o JSON. Se falhar, captura a cena do crime.
            try {
                return JSON.parse(textoCru);
            } catch (erroJson) {
                console.log(`\n🎥 [CÂMERA DE SEGURANÇA - ${nomeTarefa}] Falha na leitura do JSON!`);
                console.log(`Olhe o final do texto gerado para ver onde cortou:`);
                console.log(textoCru.slice(-250)); // Mostra os últimos 250 caracteres
                throw erroJson; // Joga o erro para forçar a nova tentativa
            }

        } catch (erro) {
            console.log(`⚠️ ${nomeTarefa} engasgou (Tentativa ${i}/${tentativas}). O Motor está corrigindo...`);
            if (i === tentativas) throw new Error(`Falha critica em ${nomeTarefa} apos 3 tentativas.`);
        }
    }
}

async function fecharEdicaoJornal() {
    console.log("🛠️ Iniciando fechamento: Redação e Arquivo trabalhando separadamente...");

    try {
        // 1. Pega os fatos no banco
        const { data: segmentosBrutos, error: erroSegmentos } = await supabase
            .from('entry_segments')
            .select(`segment_text, categories ( name ), processed_entries!inner (is_used, raw_entries (authors ( name )))`)
            .eq('processed_entries.is_used', false);

        if (erroSegmentos || !segmentosBrutos || segmentosBrutos.length === 0) {
            console.log("😴 Nada de novo para publicar hoje.");
            return;
        }

        const novosFatos = segmentosBrutos.map(seg => ({
            nacao: seg.processed_entries.raw_entries.authors.name,
            categoria: seg.categories.name,
            texto: seg.segment_text
        }));

        // 2. Pega a memória antiga
        const { data: memoriaAntiga } = await supabase
            .from('world_memory')
            .select('state_json')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const contextoPassado = memoriaAntiga ? JSON.stringify(memoriaAntiga.state_json) : "O mundo comecou agora.";

        // ==========================================
        // 📰 TAREFA 1: ESCREVER O JORNAL
        // ==========================================
        console.log("📝 TAREFA 1: Redação escrevendo as notícias...");
        
        const promptJornal = `Você é a Editora do jornal "Cronicas de Carmesim".
        Baseado nestes NOVOS FATOS: ${JSON.stringify(novosFatos)}
        
        Escreva as noticias da edicao de forma sobria, imparcial e sem inventar dados.
        PROIBIDO USAR HTML. Escreva apenas texto puro. Use aspas simples (') em vez de duplas (").
        
        Retorne EXATAMENTE este JSON:
        {
            "destaques": "Paragrafo texto puro com a noticia mais chocante.",
            "politica": "Paragrafo texto puro de politica.",
            "economia": "Paragrafo texto puro de economia.",
            "conflitos": "Paragrafo texto puro de conflitos."
        }`;

        const dadosJornal = await gerarComRetry(promptJornal, "GERAÇÃO DO JORNAL");

        // ==========================================
        // 🗃️ TAREFA 2: ATUALIZAR O DOSSIÊ
        // ==========================================
        console.log("🧠 TAREFA 2: Arquivo atualizando o dossiê das Nações...");

        const promptDossie = `Você é o Arquivista Mestre do "Cronicas de Carmesim".
        ESTADO ANTERIOR DO MUNDO: ${contextoPassado}
        NOVOS FATOS: ${JSON.stringify(novosFatos)}

        Atualize o estado do mundo fundindo os fatos novos com o estado anterior. 
        MUITO IMPORTANTE: Resuma a situacao_interna e postura_externa de cada nacao em NO MAXIMO 2 FRASES CURTAS. Seja extremamente conciso para economizar espaço. Use aspas simples (').
        
        Retorne EXATAMENTE este JSON:
        {
          "nacoes_fichadas": [
            {
              "nome_nacao": "Nome da Nacao",
              "situacao_interna": "Resumo muito curto (2 frases max).",
              "postura_externa": "Resumo muito curto (2 frases max)."
            }
          ],
          "tensoes_globais_ativas": ["Fato 1", "Fato 2"],
          "resumo_narrativo": "Resumo curto do clima mundial."
        }`;

        const dadosDossie = await gerarComRetry(promptDossie, "ATUALIZAÇÃO DO DOSSIÊ");

        // ==========================================
        // 🚀 TAREFA 3: MONTAGEM E SALVAMENTO
        // ==========================================
        console.log("⚙️ TAREFA 3: Diagramando e salvando no banco...");

        const classeHTML = "font-extrabold text-xl mt-6 mb-2 text-stone-800 border-b border-stone-300";
        const jornalFinalHTML = {
            destaques: `<h4 class='${classeHTML}'>Destaques Globais</h4><p>${dadosJornal.destaques}</p>`,
            politica: `<h4 class='${classeHTML}'>Cenario Politico</h4><p>${dadosJornal.politica}</p>`,
            economia: `<h4 class='${classeHTML}'>Movimentacoes Economicas</h4><p>${dadosJornal.economia}</p>`,
            conflitos: `<h4 class='${classeHTML}'>Relatorios de Conflito</h4><p>${dadosJornal.conflitos}</p>`
        };

        // Salva Jornal
        const { error: erroJornal } = await supabase
            .from('journals')
            .insert([{ pdf_url: null, content: jornalFinalHTML }]);
        if(erroJornal) throw erroJornal;

        // Salva Memória
        const { error: erroMemoria } = await supabase
            .from('world_memory')
            .insert([{ state_json: dadosDossie }]);
        if(erroMemoria) throw erroMemoria;

        // Limpeza
        await supabase
            .from('processed_entries')
            .update({ is_used: true })
            .eq('is_used', false);

        console.log("✅ CRÔNICAS DE CARMESIM PUBLICADO COM SUCESSO ABSOLUTO!");

    } catch (erro) {
        console.error("❌ ERRO FATAL NO FECHAMENTO:", erro.message);
    }
}

module.exports = { fecharEdicaoJornal };