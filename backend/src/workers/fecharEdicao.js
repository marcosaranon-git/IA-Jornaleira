const supabase = require('../infra/supabase');
const genAI = require('../infra/gemini');

// 🛡️ MOTOR BLINDADO
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

            textoCru = textoCru.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            textoCru = textoCru.replace(/\n/g, ' ').trim(); 

            try {
                return JSON.parse(textoCru);
            } catch (erroJson) {
                console.log(`\n🎥 [CÂMERA DE SEGURANÇA - ${nomeTarefa}] Falha na leitura do JSON!`);
                console.log(`Corte no texto: ${textoCru.slice(-250)}`);
                throw erroJson; 
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

        const { data: memoriaAntiga } = await supabase
            .from('world_memory')
            .select('state_json')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // 🌟 MUDANÇA ARQUITETURAL: O JavaScript agora segura o estado do mundo na memória dele
        let estadoMundoObj = { nacoes_fichadas: [], tensoes_globais_ativas: [], resumo_narrativo: "" };
        if (memoriaAntiga && memoriaAntiga.state_json) {
            estadoMundoObj = memoriaAntiga.state_json;
        }

        // ==========================================
        // 📰 TAREFA 1: ESCREVER O JORNAL
        // ==========================================
        console.log("📝 TAREFA 1: Redação escrevendo as notícias...");
        const promptJornal = `Você é a Editora do jornal "Cronicas de Carmesim".
        NOVOS FATOS: ${JSON.stringify(novosFatos)}
        
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
        // 🗃️ TAREFA 2: ATUALIZAR O DOSSIÊ (MÉTODO DELTA)
        // ==========================================
        console.log("🧠 TAREFA 2: Arquivo calculando apenas as mudanças (Patch Notes)...");
        const promptDossie = `Você é o Arquivista Mestre do "Cronicas de Carmesim".
        ESTADO ANTERIOR DO MUNDO: ${JSON.stringify(estadoMundoObj)}
        NOVOS FATOS: ${JSON.stringify(novosFatos)}

        Sua tarefa é focar APENAS NAS MUDANÇAS. Analise os 'Novos Fatos' e veja quais nações foram afetadas ou mencionadas.
        Retorne um JSON contendo APENAS as nações que sofreram alteração ou são novas. Não reescreva as nações que ficaram quietas nesta edição!
        Resuma a situacao_interna e postura_externa em no MAXIMO 2 frases. Use aspas simples (').
        
        Retorne EXATAMENTE este JSON:
        {
          "nacoes_atualizadas": [
            {
              "nome_nacao": "Nome Exato da Nacao Afetada",
              "situacao_interna": "Novo resumo curto.",
              "postura_externa": "Novo resumo curto."
            }
          ],
          "tensoes_globais_ativas": ["Atualize as tensões do mundo inteiro aqui"],
          "resumo_narrativo": "Resumo curto do novo clima mundial."
        }`;

        const dadosDossie = await gerarComRetry(promptDossie, "ATUALIZAÇÃO DO DOSSIÊ");

        // ==========================================
        // 🧩 TAREFA 3: O GRANDE MERGE DE DADOS
        // ==========================================
        console.log("🧩 Fundindo o Dossiê antigo com as novas atualizações...");

        if (dadosDossie.nacoes_atualizadas && Array.isArray(dadosDossie.nacoes_atualizadas)) {
            dadosDossie.nacoes_atualizadas.forEach(nacaoNova => {
                const index = estadoMundoObj.nacoes_fichadas.findIndex(n => n.nome_nacao === nacaoNova.nome_nacao);
                if (index !== -1) {
                    estadoMundoObj.nacoes_fichadas[index] = nacaoNova; // Atualiza se a nação já existe
                } else {
                    estadoMundoObj.nacoes_fichadas.push(nacaoNova); // Adiciona se for uma nação nova
                }
            });
        }
        estadoMundoObj.tensoes_globais_ativas = dadosDossie.tensoes_globais_ativas || [];
        estadoMundoObj.resumo_narrativo = dadosDossie.resumo_narrativo || "";

        // ==========================================
        // 🚀 TAREFA 4: MONTAGEM E SALVAMENTO
        // ==========================================
        console.log("⚙️ TAREFA 4: Diagramando HTML e salvando no banco de dados...");

        const classeHTML = "font-extrabold text-xl mt-6 mb-2 text-stone-800 border-b border-stone-300";
        const jornalFinalHTML = {
            destaques: `<h4 class='${classeHTML}'>Destaques Globais</h4><p>${dadosJornal.destaques}</p>`,
            politica: `<h4 class='${classeHTML}'>Cenario Politico</h4><p>${dadosJornal.politica}</p>`,
            economia: `<h4 class='${classeHTML}'>Movimentacoes Economicas</h4><p>${dadosJornal.economia}</p>`,
            conflitos: `<h4 class='${classeHTML}'>Relatorios de Conflito</h4><p>${dadosJornal.conflitos}</p>`
        };

        const { error: erroJornal } = await supabase
            .from('journals')
            .insert([{ pdf_url: null, content: jornalFinalHTML }]);
        if(erroJornal) throw erroJornal;

        const { error: erroMemoria } = await supabase
            .from('world_memory')
            .insert([{ state_json: estadoMundoObj }]); // Salva o mundo fundido perfeitamente
        if(erroMemoria) throw erroMemoria;

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