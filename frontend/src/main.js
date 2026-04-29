import './style.css'; 
import html2pdf from 'html2pdf.js'; 

// Elementos da Interface
const btnCarregar = document.getElementById('btn-carregar');
const btnPdf = document.getElementById('btn-pdf');
const containerJornal = document.getElementById('jornal-conteudo');
const jornalVazio = document.getElementById('jornal-vazio');
const areaBotoes = document.getElementById('area-botoes');

// Elementos das Abas e Dossiê
const secaoJornal = document.getElementById('secao-jornal');
const secaoDossie = document.getElementById('secao-dossie');
const tabJornal = document.getElementById('tab-jornal');
const tabDossie = document.getElementById('tab-dossie');
const listaDossie = document.getElementById('lista-dossie');

// ==========================================
// 1. LÓGICA DAS ABAS (Com tema Carmesim)
// ==========================================
tabJornal.addEventListener('click', () => {
    secaoJornal.classList.remove('hidden');
    secaoDossie.classList.add('hidden');
    
    tabJornal.classList.add('border-red-900', 'bg-red-100', 'text-red-900');
    tabJornal.classList.remove('border-transparent', 'text-stone-600');
    tabDossie.classList.remove('border-red-900', 'bg-red-100', 'text-red-900');
    tabDossie.classList.add('border-transparent', 'text-stone-600');
    
    areaBotoes.classList.remove('hidden');
});

tabDossie.addEventListener('click', async () => {
    secaoJornal.classList.add('hidden');
    secaoDossie.classList.remove('hidden');
    
    tabDossie.classList.add('border-red-900', 'bg-red-100', 'text-red-900');
    tabDossie.classList.remove('border-transparent', 'text-stone-600');
    tabJornal.classList.remove('border-red-900', 'bg-red-100', 'text-red-900');
    tabJornal.classList.add('border-transparent', 'text-stone-600');
    
    areaBotoes.classList.add('hidden');

    await carregarDossie();
});

// ==========================================
// 2. BUSCAR E DESENHAR DOSSIÊ GLOBAL
// ==========================================
async function carregarDossie() {
    const menuNacoes = document.getElementById('menu-nacoes');
    const conteudoFicha = document.getElementById('conteudo-ficha');
    
    menuNacoes.innerHTML = '<p class="text-red-700 animate-pulse">Consultando arquivos...</p>';
    
    try {
        const res = await fetch('https://backend-ia-jornaleira.onrender.com/api/world-state');
        if (!res.ok) throw new Error("Erro ao buscar a memória.");
        
        const estadoMundo = await res.json();
        
        if (!estadoMundo || !estadoMundo.nacoes_fichadas || estadoMundo.nacoes_fichadas.length === 0) {
            menuNacoes.innerHTML = "";
            conteudoFicha.innerHTML = '<p class="text-center italic text-stone-500 py-10">Nenhum dado de inteligência disponível ainda.</p>';
            return;
        }

        // 1. Criar os botões do Menu
        menuNacoes.innerHTML = estadoMundo.nacoes_fichadas.map(nacao => `
            <button 
                onclick="exibirFichaNacao('${nacao.nome_nacao.replace(/'/g, "\\'")}')"
                class="btn-nacao px-4 py-2 bg-stone-100 border border-red-200 rounded text-sm font-bold text-red-900 hover:bg-red-900 hover:text-white transition-all shadow-sm"
            >
                ${nacao.nome_nacao}
            </button>
        `).join('');

        // Salva os dados globalmente para a função de exibir usar depois
        window.dadosDossieAtual = estadoMundo.nacoes_fichadas;

    } catch (e) {
        console.error(e);
        menuNacoes.innerHTML = '<p class="text-red-600 font-bold">Erro ao carregar menu.</p>';
    }
}

// FUNÇÃO PARA EXIBIR A FICHA DE UMA NAÇÃO ESPECÍFICA
window.exibirFichaNacao = function(nomeNacao) {
    const conteudoFicha = document.getElementById('conteudo-ficha');
    const nacao = window.dadosDossieAtual.find(n => n.nome_nacao === nomeNacao);

    if (!nacao) return;

    // Atualiza o visual dos botões (marcar o selecionado)
    document.querySelectorAll('.btn-nacao').forEach(btn => {
        if (btn.innerText === nomeNacao) {
            btn.classList.add('bg-red-900', 'text-white');
        } else {
            btn.classList.remove('bg-red-900', 'text-white');
        }
    });

    // Desenha a ficha com o tema Carmesim
    conteudoFicha.innerHTML = `
        <article class="bg-red-50 p-8 rounded border-l-8 border-red-900 shadow-xl fade-in">
            <div class="flex justify-between items-center border-b border-red-300 pb-3 mb-6">
                <h3 class="text-4xl font-black uppercase tracking-tighter text-red-950">${nacao.nome_nacao}</h3>
                <div class="text-right">
                    <span class="block text-[10px] font-bold text-red-800 uppercase">Status do Relatório</span>
                    <span class="text-xs font-black px-3 py-1 bg-red-900 text-red-50 rounded-full">CONFIDENCIAL</span>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-10 font-sans">
                <div class="space-y-4">
                    <div class="flex items-center gap-2 border-b border-red-200 pb-1">
                        <span class="text-lg">🏛️</span>
                        <h4 class="font-bold text-red-900 uppercase text-sm tracking-widest">Situação Interna</h4>
                    </div>
                    <p class="text-stone-900 leading-relaxed text-base bg-white/50 p-4 rounded border border-red-100">${nacao.situacao_interna}</p>
                </div>
                
                <div class="space-y-4">
                    <div class="flex items-center gap-2 border-b border-red-200 pb-1">
                        <span class="text-lg">🌍</span>
                        <h4 class="font-bold text-red-900 uppercase text-sm tracking-widest">Postura Geopolítica</h4>
                    </div>
                    <p class="text-stone-900 leading-relaxed text-base bg-white/50 p-4 rounded border border-red-100">${nacao.postura_externa}</p>
                </div>
            </div>

            <footer class="mt-8 pt-4 border-t border-red-200 text-[10px] text-red-800 italic text-center uppercase tracking-widest">
                Dados processados pela IA Jornaleira - Protocolo Carmesim
            </footer>
        </article>
    `;
};

// ==========================================
// 3. FUNÇÃO MESTRE: DESENHAR O JORNAL
// ==========================================
function desenharJornalNaTela(conteudo) {
    let htmlGerado = '';

    if (conteudo.destaques) {
      htmlGerado += `
        <section class="min-h-[1050px] flex flex-col">
          <h2 class="text-3xl font-extrabold border-b-2 border-red-900 text-red-950 mb-6 uppercase tracking-widest text-center mt-4">Página Principal</h2>
          <h3 class="text-2xl font-bold border-b border-red-300 text-red-900 mb-4 uppercase tracking-wide">Destaques</h3>
          <div class="text-xl leading-relaxed text-justify whitespace-pre-line text-stone-900">${conteudo.destaques}</div>
        </section>
      `;
    }

    if (conteudo.politica) {
      htmlGerado += `
        <div class="html2pdf__page-break"></div> 
        <section class="min-h-[1050px] mt-10">
          <h2 class="text-3xl font-extrabold border-b-2 border-red-900 text-red-950 mb-6 uppercase tracking-widest text-center">Caderno de Política</h2>
          <div class="text-lg leading-relaxed text-justify columns-2 gap-10 whitespace-pre-line text-stone-900">${conteudo.politica}</div>
        </section>
      `;
    }

    if (conteudo.economia) {
      htmlGerado += `
        <div class="html2pdf__page-break"></div> 
        <section class="min-h-[1050px] mt-10">
          <h2 class="text-3xl font-extrabold border-b-2 border-red-900 text-red-950 mb-6 uppercase tracking-widest text-center">Caderno de Economia</h2>
          <div class="text-lg leading-relaxed text-justify columns-2 gap-10 whitespace-pre-line text-stone-900">${conteudo.economia}</div>
        </section>
      `;
    }

    if (conteudo.conflitos) {
      htmlGerado += `
        <div class="html2pdf__page-break"></div> 
        <section class="min-h-[1050px] mt-10 bg-red-50 p-10 rounded border-l-8 border-red-900 shadow-sm">
          <h2 class="text-3xl font-extrabold border-b-2 border-red-900 text-red-950 mb-6 uppercase tracking-widest text-center">Boletim de Conflitos</h2>
          <div class="text-lg leading-relaxed text-justify columns-2 gap-10 whitespace-pre-line text-stone-900">${conteudo.conflitos}</div>
        </section>
      `;
    }

    jornalVazio.classList.add('hidden');
    containerJornal.innerHTML = htmlGerado;
    containerJornal.classList.remove('hidden');
    btnPdf.classList.remove('hidden');
}

// ==========================================
// 4. BOTÃO: CARREGAR ÚLTIMA EDIÇÃO
// ==========================================
btnCarregar.addEventListener('click', async () => {
  btnCarregar.innerText = 'Puxando dos Arquivos...';
  btnCarregar.disabled = true;

  try {
    // ROTA CORRIGIDA E BLINDADA!
    const resposta = await fetch('https://backend-ia-jornaleira.onrender.com/api/journals/latest');
    if (!resposta.ok) throw new Error("Erro na rede.");
    
    const dados = await resposta.json();
    
    if (dados.erro || !dados.content) {
        document.getElementById('jornal-conteudo').innerHTML = `<p class="text-red-700 italic text-center py-10 font-bold">O acervo de Carmesim está vazio ou a edição foi perdida. A redação aguarda sangue novo.</p>`;
        jornalVazio.classList.add('hidden');
        containerJornal.classList.remove('hidden');
        return;
    }

    desenharJornalNaTela(dados.content); 

    btnCarregar.innerText = 'Edição Lida com Sucesso!';
  } catch (erro) {
    console.error(erro);
    alert("Falha ao buscar a edição.");
    btnCarregar.innerText = 'Tentar Novamente';
  } finally {
    btnCarregar.disabled = false;
  }
});

// ==========================================
// 5. MENU LATERAL: ACERVO HISTÓRICO
// ==========================================
async function carregarAcervo() {
    const lista = document.getElementById('lista-acervo');
    try {
        // ROTA CORRIGIDA!
        const resposta = await fetch('https://backend-ia-jornaleira.onrender.com/api/journals');
        const jornais = await resposta.json();

        if (!Array.isArray(jornais) || jornais.length === 0) {
            lista.innerHTML = '<p class="text-stone-500 p-4 font-bold">O acervo está vazio.</p>';
            return;
        }

        // Tira os jornais corrompidos da lista!
        const jornaisValidos = jornais.filter(j => j.content !== null);

        if (jornaisValidos.length > 0) {
            iniciarRelogioDoJornal(jornaisValidos[0].created_at);
        }

        lista.innerHTML = jornaisValidos.map(j => {
            const data = new Date(j.created_at).toLocaleDateString('pt-BR');
            return `
                <li>
                    <button data-id="${j.id}" class="btn-historico w-full text-left bg-red-100 p-2 rounded hover:bg-red-200 border border-red-200 transition font-bold text-red-950 shadow-sm">
                        Edição de ${data}
                    </button>
                </li>
            `;
        }).join('');

        document.querySelectorAll('.btn-historico').forEach(botao => {
            botao.addEventListener('click', () => {
                tabJornal.click();
                const id = botao.getAttribute('data-id');
                const jornalEscolhido = jornaisValidos.find(j => j.id === id);
                if(jornalEscolhido) {
                    desenharJornalNaTela(jornalEscolhido.content);
                    btnCarregar.innerText = `Lendo edição de ${new Date(jornalEscolhido.created_at).toLocaleDateString('pt-BR')}`;
                }
            });
        });

    } catch (e) {
        console.error("Erro ao carregar acervo", e);
    }
}
carregarAcervo(); 

// ==========================================
// 6. LÓGICA DE GERAR PDF
// ==========================================
btnPdf.addEventListener('click', () => {
    const textoOriginal = btnPdf.innerText;
    btnPdf.innerText = 'Gerando Arquivo...';

    const elemento = document.querySelector('.max-w-4xl'); 
    
    const areaNav = document.querySelector('nav');
    if(areaBotoes) areaBotoes.classList.add('hidden');
    if(areaNav) areaNav.classList.add('hidden');

    const opcoes = {
        margin:       [10, 10, 10, 10],
        filename:     'Cronicas_de_Carmesim.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opcoes).from(elemento).save().then(() => {
        if(areaBotoes) areaBotoes.classList.remove('hidden');
        if(areaNav) areaNav.classList.remove('hidden');
        btnPdf.innerText = textoOriginal;
    });
});

// ==========================================
// 7. FORMULÁRIO MANUAL COM SENHA DE SEGURANÇA
// ==========================================
const formNoticia = document.getElementById('form-noticia');
const msgSucesso = document.getElementById('msg-sucesso');

if(formNoticia) {
    formNoticia.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const botao = formNoticia.querySelector('button');
        botao.innerText = 'Enviando corvo...';
        botao.disabled = true;

        const autor = document.getElementById('input-autor').value;
        const texto = document.getElementById('input-texto').value;
        const senha = document.getElementById('input-senha').value; 

        try {
            const resposta = await fetch('https://backend-ia-jornaleira.onrender.com/api/webhooks/discord-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discord_id: "site_form_" + autor.toLowerCase().replace(/\s+/g, '_'), 
                    nome_autor: autor,
                    texto_mensagem: texto,
                    senha: senha,
                    id_mensagem: "msg_site_" + Date.now() 
                })
            });

            if (!resposta.ok) {
                if (resposta.status === 401) {
                    throw new Error("Senha da Redação incorreta. Acesso negado.");
                }
                throw new Error("Erro na rede. O servidor respondeu com problema.");
            }

            msgSucesso.classList.remove('hidden');
            formNoticia.reset(); 
            setTimeout(() => msgSucesso.classList.add('hidden'), 4000);

        } catch (erro) {
            console.error(erro);
            alert(erro.message); 
        } finally {
            botao.innerText = 'Enviar Manuscrito';
            botao.disabled = false;
        }
    });
}

// ==========================================
// 8. RELÓGIO DA PRÓXIMA EDIÇÃO
// ==========================================
let cronometroDaIA;

function iniciarRelogioDoJornal(dataUltimaEdicao) {
    clearInterval(cronometroDaIA); // Limpa relógios antigos
    const timerElemento = document.getElementById('contador-tempo');
    if (!timerElemento) return;

    // Calcula a data da próxima edição (Data do Último Jornal + 3 dias)
    const dataProxima = new Date(new Date(dataUltimaEdicao).getTime() + (3 * 24 * 60 * 60 * 1000));

    cronometroDaIA = setInterval(() => {
        const agora = new Date();
        const tempoRestante = dataProxima - agora;

        // Se o tempo zerou, avisa que a IA está trabalhando
        if (tempoRestante <= 0) {
            timerElemento.innerHTML = "<span class='text-amber-400 animate-pulse'>A Redação está escrevendo...</span>";
            return;
        }

        const dias = Math.floor(tempoRestante / (1000 * 60 * 60 * 24));
        const horas = Math.floor((tempoRestante % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((tempoRestante % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((tempoRestante % (1000 * 60)) / 1000);

        // Adiciona um zero à esquerda se for menor que 10 (ex: 09s)
        const hrStr = horas.toString().padStart(2, '0');
        const minStr = minutos.toString().padStart(2, '0');
        const segStr = segundos.toString().padStart(2, '0');

        timerElemento.innerText = `${dias}d ${hrStr}h ${minStr}m ${segStr}s`;
    }, 1000);
}