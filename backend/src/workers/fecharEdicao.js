const supabase = require('../infra/supabase');
const genAI = require('../infra/gemini');

async function fecharEdicaoJornal() {
    console.log("🛠️ Iniciando fechamento da edição e atualização de memória...");

    try {
        // 1. Pega os segmentos e faz um "mergulho" profundo no banco para achar o nome da Nação!
        const { data: segmentosBrutos, error: erroSegmentos } = await supabase
            .from('entry_segments')
            .select(`
                segment_text,
                categories ( name ),
                processed_entries!inner (
                    is_used,
                    raw_entries (
                        authors ( name )
                    )
                )
            `)
            .eq('processed_entries.is_used', false);

        if (erroSegmentos || !segmentosBrutos || segmentosBrutos.length === 0) {
            console.log("😴 Nada de novo para publicar hoje.");
            return;
        }

        // 1.5 Limpa os dados para a IA não se confundir com a estrutura do banco
        const novosFatos = segmentosBrutos.map(seg => ({
            nacao: seg.processed_entries.raw_entries.authors.name,
            categoria: seg.categories.name,
            texto: seg.segment_text
        }));

        // 2. Pega a última memória do mundo salva
        const { data: memoriaAntiga } = await supabase
            .from('world_memory')
            .select('state_json')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const contextoPassado = memoriaAntiga ? JSON.stringify(memoriaAntiga.state_json) : "Nenhuma memória anterior. O mundo começou agora.";

        console.log("🧠 Consultando a memória do mundo e redigindo dossiê detalhado...");

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // 3. O NOVO PROMPT: Muito mais rigoroso e focado em reter nomes e fatos!
        const prompt = `Você é a Editora Chefe e Arquivista de um jornal geopolítico de RPG. 
        Seu trabalho é escrever o jornal, fazer conexões lógicas entre os fatos, e manter um dossiê ESTRITAMENTE DETALHADO das nações.

        ESTADO ANTERIOR DO MUNDO:
        ${contextoPassado}

        NOVOS FATOS (Observe os carimbos de "Escala" e "ALERTA DE EFEITO BORBOLETA"):
        ${JSON.stringify(novosFatos)}

        DIRETRIZES DE EDIÇÃO (O Faro Jornalístico e a Sobriedade):
        1. TOM IMPARCIAL E SÓBRIO: Seja pé no chão, analítica e estritamente jornalística. NÃO SEJA ALARMISTA. Não exagere a gravidade das situações, não crie pânico desnecessário e evite adjetivos sensacionalistas.
        2. FIDELIDADE AOS FATOS (MUITO IMPORTANTE): Respeite as nuances das notícias originais. Se uma nação impôs uma regra com exceções ou avisos prévios, INCLUA essa informação. Não omita detalhes para fazer uma nação parecer "vilã" ou "heroína". Ater-se aos fatos relatados.
        3. CRUZAMENTO DE DADOS: Conecte os fatos se várias nações falarem do mesmo assunto, mas mantenha a objetividade: "Fontes apontam que...", "A medida coincide com...".
        4. DIAGRAMAÇÃO (SUBTÍTULOS): Separe as notícias distintas dentro de cada categoria usando subtítulos. Para isso, use EXATAMENTE esta tag HTML para os títulos (USE ASPAS SIMPLES): <h4 class='font-extrabold text-xl mt-6 mb-2 text-stone-800 border-b border-stone-300'>SEU SUBTÍTULO AQUI</h4> seguido do texto da notícia em formato normal.
        5. REGRA DE OURO DO FORMATO: NUNCA use aspas duplas (") dentro dos textos das notícias. Se precisar citar algo, use aspas simples (').

        TAREFAS:
        1. JORNAL: Escreva a narrativa cruzando as informações. Use a tag de subtítulo (h4) que te ensinei para separar os assuntos dentro de Política, Economia e Conflitos. Nunca invente atritos que não foram citados.
        2. MEMÓRIA: Atualize o dossiê. Registre fatos concretos e literais.

        Retorne EXATAMENTE este JSON puro (sem marcadores de markdown):
        {
          "jornal_html": {
            "destaques": "...",
            "politica": "...",
            "economia": "...",
            "conflitos": "..."
          },
          "novo_estado_mundo": {
            "nacoes_fichadas": [
              {
                "nome_nacao": "Nome da Nação",
                "situacao_interna": "O que está acontecendo dentro dela",
                "postura_externa": "Ações diplomáticas, fronteiras, conflitos"
              }
            ],
            "tensoes_globais_ativas": ["Fato 1", "Fato 2"],
            "resumo_narrativo": "..."
          },
          "conexoes_detectadas": ["Explique brevemente as conexões que você fez entre as nações nesta edição"]
        }`;

        const result = await model.generateContent(prompt);
        
        // 🧹 A GRANDE FAXINA: Limpa blocos markdown e lixos que a IA possa ter mandado antes de transformar em JSON
        let textoCru = result.response.text();
        textoCru = textoCru.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const resposta = JSON.parse(textoCru);

        // 4. Salva o Jornal
        const { data: novoJornal } = await supabase
            .from('journals')
            .insert([{ 
                pdf_url: null,
                content: resposta.jornal_html 
            }])
            .select()
            .single();

        // 5. Salva a nova Memória Rica
        await supabase
            .from('world_memory')
            .insert([{ state_json: resposta.novo_estado_mundo }]);

        // 6. Limpeza
        await supabase
            .from('processed_entries')
            .update({ is_used: true })
            .eq('is_used', false);

        console.log("✅ Edição finalizada com Dossiê Geopolítico!");
        console.log("📝 Nações Fichadas:", resposta.novo_estado_mundo.nacoes_fichadas.map(n => n.nome_nacao).join(', '));

    } catch (erro) {
        console.error("❌ Erro no fechamento da edição:", erro);
    }
}

module.exports = { fecharEdicaoJornal };