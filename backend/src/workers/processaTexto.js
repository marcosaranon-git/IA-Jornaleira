const supabase = require('../infra/supabase');
const genAI = require('../infra/gemini'); 

async function processarTextosPendentes() {
    console.log("🔍 Procurando textos novos para o jornal...");

    try {
        const { data: entrada, error: erroBusca } = await supabase
            .from('raw_entries')
            .select(`*, authors ( name )`)
            .eq('status', 'pending')
            .limit(1)
            .single();

        if (erroBusca || !entrada) {
            console.log("😴 Nenhum texto novo no momento.");
            return;
        }

        const nomeNacao = entrada.authors.name;
        console.log(`🤖 IA Porteira lendo a notícia enviada por: ${nomeNacao}`);

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `Você é a Porteira de um jornal de RPG de geopolítica. 
        Analise o texto da nação "${nomeNacao}": "${entrada.original_text}"

        1. Divida o texto em partes baseadas nas categorias: Destaques, Política, Economia, Conflitos.
        2. ABANDONE NOTAS NUMÉRICAS. Para cada segmento, defina:
           - "escala": É uma questão "Interna", "Regional" (envolve vizinhos) ou "Global"?
           - "efeito_borboleta": (true/false) Isso ameaça a paz, muda o equilíbrio de poder, cria precedentes graves ou vai forçar outros jogadores a reagirem?
        3. Ignore detalhes triviais do dia a dia. Foque naquilo que move a história do mundo.

        Retorne EXATAMENTE um JSON assim:
        {
          "resumo_geral": "...",
          "segmentos": [
            { 
              "categoria": "Política", 
              "texto": "...", 
              "escala": "Interna", 
              "efeito_borboleta": true 
            }
          ]
        }`;

        const result = await model.generateContent(prompt);
        const respostaIA = result.response.text();

        // Lemos o JSON novo
        const analise = JSON.parse(respostaIA);
        console.log(`✅ IA gerou o resumo geral e encontrou ${analise.segmentos.length} segmento(s).`);

        // 1. Salva na tabela geral (Apenas o resumo)
        const { data: textoProcessado, error: erroInsert } = await supabase
            .from('processed_entries')
            .insert([{
                raw_entry_id: entrada.id,
                general_summary: analise.resumo_geral
            }])
            .select()
            .single();

        if (erroInsert) throw erroInsert;

        // 2. Faz um "loop" para ler cada segmento fatiado
        for (const segmento of analise.segmentos) {
            const { data: categoriaDB } = await supabase
                .from('categories')
                .select('id')
                .eq('name', segmento.categoria)
                .single();

            if (categoriaDB) {
                // Colocamos a etiqueta pro Editor ler depois!
                const etiquetaCascata = segmento.efeito_borboleta ? "🚨 ALERTA DE EFEITO BORBOLETA" : "Fato Isolado";
                const textoFinal = `[Escala: ${segmento.escala} | ${etiquetaCascata}] ${segmento.texto}`;

                await supabase
                    .from('entry_segments')
                    .insert([{
                        processed_entry_id: textoProcessado.id,
                        category_id: categoriaDB.id,
                        segment_text: textoFinal
                    }]);
                
                console.log(`   -> Guardado segmento de ${segmento.categoria} (Escala: ${segmento.escala} | Borboleta: ${segmento.efeito_borboleta})`);
            }
        }

        // 3. Finaliza a tarefa
        await supabase
            .from('raw_entries')
            .update({ status: 'completed' })
            .eq('id', entrada.id);

        console.log("💾 Notícia processada e guardada com sucesso!");

    } catch (erro) {
        console.error("❌ Erro ao processar com a IA:", erro);
    }
}

// Exportando a função para o servidor poder chamar!
module.exports = { processarTextosPendentes };