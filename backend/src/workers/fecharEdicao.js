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
            model: "gemini-1.5-pro",
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }
        });

        // Prompt para a IA
        const prompt = `Você é a Editora Chefe, Analista de Inteligência e Arquivista Mestre do jornal geopolítico "Crônicas de Carmesim" (Sistema Exotic RPG).
        Seu trabalho é transformar relatos brutos em matérias jornalísticas coesas, conectar pontos cegos entre as ações dos jogadores e manter um Dossiê de Inteligência impecável e SEMPRE ATUALIZADO.

        ESTADO ANTERIOR DO MUNDO:
        ${contextoPassado}

        NOVOS FATOS (Relatórios recentes da inteligência):
        ${JSON.stringify(novosFatos)}

        DIRETRIZES DE REDAÇÃO (O Faro Jornalístico):
        1. TOM IMPARCIAL E SÓBRIO: Escreva como uma analista geopolítica veterana. Seja fria, analítica e pé no chão. Evite sensacionalismo barato, mas destaque a gravidade real de guerras, embargos ou mudanças de poder.
        2. FIDELIDADE ABSOLUTA: Respeite as nuances das notícias originais. Se há exceções em uma lei ou condições para um ataque, cite-as. NUNCA invente atritos, guerras ou alianças que não estejam explicitamente nos fatos.
        3. CRUZAMENTO DE DADOS (A Mágica): Se a Nação A bloqueou o mar e a Nação B relata fome, conecte os fatos na matéria de forma analítica: 'A recente medida da Nação A já mostra impactos severos na Nação B...'.
        4. DIAGRAMAÇÃO (SUBTÍTULOS): Separe as notícias dentro de cada categoria (Política, Economia, Conflitos). Use EXATAMENTE esta tag HTML para os títulos, COM ASPAS SIMPLES: <h4 class='font-extrabold text-xl mt-6 mb-2 text-stone-800 border-b border-stone-300'>SEU SUBTÍTULO AQUI</h4>
        5. REGRA ANTI-CRASH (FORMATAÇÃO DE TEXTO): NUNCA, SOB NENHUMA HIPÓTESE, use aspas duplas (") dentro dos textos das notícias ou do dossiê. Substitua absolutamente todas as aspas por aspas simples (').
        6. SEJA CONCISA NO DOSSIÊ (MUITO IMPORTANTE): O mundo está enorme. Para o Dossiê não ficar gigantesco, resuma a 'situacao_interna' e a 'postura_externa' de CADA nação em NO MÁXIMO 3 FRASES CURTAS E DIRETAS. Seja cirúrgica.

        TAREFAS OBRIGATÓRIAS:
        1. O JORNAL: Escreva a edição cruzando as informações. Divida nos 4 cadernos. Se um caderno não tiver notícias relevantes nesta edição, escreva: '<p class='text-stone-500 italic'>Sem movimentações de destaque reportadas por nossa inteligência nesta edição.</p>'
        2. O DOSSIÊ (ATUALIZAÇÃO DE MEMÓRIA): Esta é a engrenagem principal do jogo. Você deve FUNDIR o 'Estado Anterior' com os 'Novos Fatos'. 
            - Se uma nação já existia no dossiê, SUBSTITUA as informações antigas pelas novas. Se ela estava em paz e agora atacou, a ficha DEVE refletir a guerra imediatamente.
            - Se uma nação for mencionada pela primeira vez, CRIE a ficha detalhada dela.
            - O objetivo é que o Dossiê reflita exclusivamente o "Aqui e Agora" do mundo, apagando tensões velhas que já foram resolvidas e destacando as novas.

        Retorne EXATAMENTE este JSON puro (sem marcações markdown como \`\`\`json):
        {
          "jornal_html": {
            "destaques": "Resumo dos acontecimentos mais chocantes e de impacto global...",
            "politica": "Diplomacia, leis, eleições, traições, discursos...",
            "economia": "Recursos, embargos, infraestrutura, comércio...",
            "conflitos": "Movimentações de tropas, batalhas, espionagem, ameaças..."
          },
          "novo_estado_mundo": {
            "nacoes_fichadas": [
              {
                "nome_nacao": "Nome Exato da Nação",
                "situacao_interna": "Economia, estabilidade do governo, moral do povo (atualizado).",
                "postura_externa": "Alianças, inimizades, guerras ativas e diplomacia (atualizado)."
              }
            ],
            "tensoes_globais_ativas": ["Fato latente 1", "Fato latente 2"],
            "resumo_narrativo": "Um parágrafo resumindo o clima do mundo após esta edição."
          },
          "conexoes_detectadas": ["Explique brevemente as conexões secretas que você fez entre as nações para os registros do Mestre."]
        }`;

        const result = await model.generateContent(prompt);
        
        // 🧹 A GRANDE FAXINA
        let textoCru = result.response.text();
        textoCru = textoCru.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // 🎥 CÂMERA DE SEGURANÇA: Imprime o começo do texto para a gente pegar a IA no pulo
        console.log("📝 CÂMERA DE SEGURANÇA - Texto bruto gerado pela IA:");
        console.log(textoCru.substring(0, 2000)); // Imprime os primeiros 2000 caracteres

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