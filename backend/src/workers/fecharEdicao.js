const supabase = require('../infra/supabase');
const genAI = require('../infra/gemini');

async function gerarComRetry(prompt, nomeTarefa, tentativas = 3) {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-lite", 
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
            
            const inicio = textoCru.indexOf('{');
            const fim = textoCru.lastIndexOf('}');
            if (inicio !== -1 && fim !== -1) {
                textoCru = textoCru.substring(inicio, fim + 1);
            }
            textoCru = textoCru.replace(/\n/g, ' ').trim(); 

            try {
                return JSON.parse(textoCru);
            } catch (erroJson) {
                console.log(`\n🎥 [CÂMERA DE SEGURANÇA - ${nomeTarefa}] Falha na leitura!`);
                console.log(`Corte no texto: ${textoCru.slice(-250)}`);
                throw erroJson; 
            }

        } catch (erro) {
            console.log(`⚠️ ${nomeTarefa} engasgou (Tentativa ${i}/${tentativas}). Motivo: ${erro.message}`);
            if (i === tentativas) throw new Error(`Falha critica em ${nomeTarefa}. Motivo: ${erro.message}`);
        }
    }
}

async function fecharEdicaoJornal() {
    console.log("🛠️ Iniciando fechamento: Metodo Alvo Fixo ativado...");

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

        let estadoAntigoObj = { nacoes_fichadas: [], tensoes_globais_ativas: [], resumo_narrativo: "" };
        if (memoriaAntiga && memoriaAntiga.state_json) {
            estadoAntigoObj = memoriaAntiga.state_json;
            if (!estadoAntigoObj.nacoes_fichadas) estadoAntigoObj.nacoes_fichadas = [];
        }

        console.log("📝 TAREFA 1: Redacao escrevendo materias ricas e detalhadas...");
        
        // 🌟 NOVO PROMPT DO JORNAL: Sem amarras, com lista de parágrafos!
        const promptJornal = `Você é a Editora Chefe do jornal "Cronicas de Carmesim".
        NOVOS FATOS: ${JSON.stringify(novosFatos)}
        
        Escreva matérias ricas, longas e detalhadas, cruzando os fatos e explicando o impacto geopolítico. Sinta-se livre para desenvolver bastante o texto.
        PROIBIDO USAR HTML. Use aspas simples (').
        
        Retorne EXATAMENTE este JSON, onde cada caderno recebe uma LISTA de parágrafos:
        {
            "destaques": ["Paragrafo 1 longo e detalhado da manchete...", "Paragrafo 2 desenvolvendo os detalhes..."],
            "politica": ["Paragrafo 1 detalhado sobre aliancas...", "Paragrafo 2..."],
            "economia": ["Paragrafo 1 sobre embargos...", "Paragrafo 2..."],
            "conflitos": ["Paragrafo 1 relatando a guerra...", "Paragrafo 2..."]
        }`;

        const dadosJornal = await gerarComRetry(promptJornal, "GERAÇÃO DO JORNAL");

        console.log("🧠 TAREFA 2: Atualizando APENAS as nacoes que enviaram noticias...");

        const nacoesAfetadasSet = new Set(novosFatos.map(f => f.nacao));
        const nacoesAfetadas = Array.from(nacoesAfetadasSet);

        const lotes = [];
        for (let i = 0; i < nacoesAfetadas.length; i += 5) {
            lotes.push(nacoesAfetadas.slice(i, i + 5));
        }

        let nacoesFichadasAtualizadas = [];

        for (let i = 0; i < lotes.length; i++) {
            const loteAtual = lotes[i];
            console.log(`📦 Processando Lote ${i + 1} de ${lotes.length} (${loteAtual.length} nacoes)...`);

            const fichasAntigasLote = estadoAntigoObj.nacoes_fichadas.filter(n => loteAtual.includes(n.nome_nacao));
            const fatosLote = novosFatos.filter(f => loteAtual.includes(f.nacao));

            const promptLote = `Atualize o dossie EXCLUSIVAMENTE destas nacoes: ${loteAtual.join(', ')}.
            FICHAS ANTIGAS: ${JSON.stringify(fichasAntigasLote)}
            FATOS NOVOS: ${JSON.stringify(fatosLote)}

            Resuma a situacao_interna e postura_externa em NO MAXIMO 2 FRASES. Use aspas simples (').

            Retorne EXATAMENTE este JSON:
            {
              "nacoes_fichadas": [
                {
                  "nome_nacao": "Nome da Nacao",
                  "situacao_interna": "Resumo max 2 frases.",
                  "postura_externa": "Resumo max 2 frases."
                }
              ]
            }`;

            const resultadoLote = await gerarComRetry(promptLote, `DOSSIE LOTE ${i + 1}`);
            nacoesFichadasAtualizadas = nacoesFichadasAtualizadas.concat(resultadoLote.nacoes_fichadas);
        }

        console.log("🌍 TAREFA 3: Atualizando tensoes globais...");

        const promptGlobal = `ESTADO ANTERIOR: ${JSON.stringify(estadoAntigoObj.tensoes_globais_ativas)}
        FATOS NOVOS: ${JSON.stringify(novosFatos)}

        Atualize as tensoes do mundo.

        Retorne EXATAMENTE este JSON:
        {
          "tensoes_globais_ativas": ["Fato 1", "Fato 2"],
          "resumo_narrativo": "Resumo curto do clima mundial."
        }`;

        const resultadoGlobal = await gerarComRetry(promptGlobal, "RESUMO GLOBAL");

        console.log("🧩 TAREFA 4: Diagramando HTML bonito e salvando...");

        nacoesFichadasAtualizadas.forEach(nacaoNova => {
            const index = estadoAntigoObj.nacoes_fichadas.findIndex(n => n.nome_nacao === nacaoNova.nome_nacao);
            if (index !== -1) {
                estadoAntigoObj.nacoes_fichadas[index] = nacaoNova;
            } else {
                estadoAntigoObj.nacoes_fichadas.push(nacaoNova);
            }
        });

        estadoAntigoObj.tensoes_globais_ativas = resultadoGlobal.tensoes_globais_ativas || [];
        estadoAntigoObj.resumo_narrativo = resultadoGlobal.resumo_narrativo || "";

        // 🌟 FUNÇÃO NOVA: Transforma os arrays de parágrafos em blocos de texto HTML bem formatados!
        const formatarSessao = (arrayTextos) => {
            if (!arrayTextos || !Array.isArray(arrayTextos)) return "<p class='text-stone-500 italic'>Sem movimentações de destaque.</p>";
            return arrayTextos.map(p => `<p style="margin-bottom: 1rem; text-align: justify; line-height: 1.6;">${p}</p>`).join('');
        };

        const classeHTML = "font-extrabold text-xl mt-6 mb-2 text-stone-800 border-b border-stone-300";
        const jornalFinalHTML = {
            destaques: `<h4 class='${classeHTML}'>Destaques Globais</h4>${formatarSessao(dadosJornal.destaques)}`,
            politica: `<h4 class='${classeHTML}'>Cenário Político</h4>${formatarSessao(dadosJornal.politica)}`,
            economia: `<h4 class='${classeHTML}'>Movimentações Econômicas</h4>${formatarSessao(dadosJornal.economia)}`,
            conflitos: `<h4 class='${classeHTML}'>Relatórios de Conflito</h4>${formatarSessao(dadosJornal.conflitos)}`
        };

        const { error: erroJornal } = await supabase.from('journals').insert([{ pdf_url: null, content: jornalFinalHTML }]);
        if(erroJornal) throw erroJornal;

        const { error: erroMemoria } = await supabase.from('world_memory').insert([{ state_json: estadoAntigoObj }]);
        if(erroMemoria) throw erroMemoria;

        await supabase.from('processed_entries').update({ is_used: true }).eq('is_used', false);

        console.log("✅ CRONICAS DE CARMESIM PUBLICADO COM SUCESSO ABSOLUTO!");

    } catch (erro) {
        console.error("❌ ERRO FATAL NO FECHAMENTO:", erro.message);
    }
}

module.exports = { fecharEdicaoJornal };