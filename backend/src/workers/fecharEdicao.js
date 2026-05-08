const supabase = require('../infra/supabase');
const genAI = require('../infra/gemini');

// MOTOR BLINDADO COM CÂMERA DE SEGURANÇA
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
                console.log(`Olhe o final do texto gerado para ver onde cortou:`);
                console.log(textoCru.slice(-250)); 
                throw erroJson; 
            }

        } catch (erro) {
            console.log(`⚠️ ${nomeTarefa} engasgou (Tentativa ${i}/${tentativas}). O Motor está corrigindo...`);
            if (i === tentativas) throw new Error(`Falha critica em ${nomeTarefa} apos 3 tentativas.`);
        }
    }
}

async function fecharEdicaoJornal() {
    console.log("🛠️ Iniciando fechamento: Redação e Arquivo trabalhando separadamente em lotes...");

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
        // 🗃️ TAREFA 2: ATUALIZAR DOSSIÊ EM LOTES
        // ==========================================
        console.log("🧠 TAREFA 2: Preparando lotes de Nações para o Dossiê...");

        // Coleta todas as nações (antigas e novas) sem repetir
        const nomesNacoesSet = new Set();
        estadoAntigoObj.nacoes_fichadas.forEach(n => nomesNacoesSet.add(n.nome_nacao));
        novosFatos.forEach(f => nomesNacoesSet.add(f.nacao));
        const todasNacoes = Array.from(nomesNacoesSet);

        // Divide as nações em grupos de 7
        const lotes = [];
        for (let i = 0; i < todasNacoes.length; i += 7) {
            lotes.push(todasNacoes.slice(i, i + 7));
        }

        let nacoesFichadasAtualizadas = [];

        for (let i = 0; i < lotes.length; i++) {
            const loteAtual = lotes[i];
            console.log(`📦 Processando Lote ${i + 1} de ${lotes.length} (${loteAtual.length} nações)...`);

            // Pega a ficha antiga apenas das nações deste lote para a IA ler
            const contextoLote = estadoAntigoObj.nacoes_fichadas.filter(n => loteAtual.includes(n.nome_nacao));

            const promptLote = `Você é o Arquivista Mestre.
            SUA TAREFA EXCLUSIVA: Atualizar APENAS as fichas das seguintes nações: ${loteAtual.join(', ')}.

            FICHAS ANTIGAS DESSAS NAÇÕES: ${JSON.stringify(contextoLote)}
            NOVOS FATOS GERAIS: ${JSON.stringify(novosFatos)}

            Atualize o estado cruzando as informações antigas com os fatos novos.
            Resuma a situacao_interna e postura_externa em NO MAXIMO 2 FRASES CURTAS. Use aspas simples (').

            Retorne EXATAMENTE este JSON:
            {
              "nacoes_fichadas": [
                {
                  "nome_nacao": "Nome da Nacao",
                  "situacao_interna": "Resumo de até 2 frases.",
                  "postura_externa": "Resumo de até 2 frases."
                }
              ]
            }`;

            const resultadoLote = await gerarComRetry(promptLote, `DOSSIÊ LOTE ${i + 1}`);
            nacoesFichadasAtualizadas = nacoesFichadasAtualizadas.concat(resultadoLote.nacoes_fichadas);
        }

        // ==========================================
        // 🌍 TAREFA 3: RESUMO GLOBAL
        // ==========================================
        console.log("🌍 TAREFA 3: Atualizando tensões globais...");

        const promptGlobal = `Você é o Arquivista Mestre.
        ESTADO ANTERIOR: Tensões (${JSON.stringify(estadoAntigoObj.tensoes_globais_ativas)})
        NOVOS FATOS: ${JSON.stringify(novosFatos)}

        Atualize as tensões do mundo e faça um resumo narrativo da edição.

        Retorne EXATAMENTE este JSON:
        {
          "tensoes_globais_ativas": ["Fato latente 1", "Fato latente 2"],
          "resumo_narrativo": "Resumo curto do clima mundial após esta edição."
        }`;

        const resultadoGlobal = await gerarComRetry(promptGlobal, "RESUMO GLOBAL");

        const dadosDossie = {
            nacoes_fichadas: nacoesFichadasAtualizadas,
            tensoes_globais_ativas: resultadoGlobal.tensoes_globais_ativas || [],
            resumo_narrativo: resultadoGlobal.resumo_narrativo || ""
        };

        // ==========================================
        // 🚀 TAREFA 4: MONTAGEM E SALVAMENTO
        // ==========================================
        console.log("⚙️ TAREFA 4: Diagramando e salvando no banco...");

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
            .insert([{ state_json: dadosDossie }]);
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