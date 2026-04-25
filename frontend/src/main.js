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
// 1. LÓGICA DAS ABAS
// ==========================================
tabJornal.addEventListener('click', () => {
    // Mostra o Jornal, Esconde o Dossiê
    secaoJornal.classList.remove('hidden');
    secaoDossie.classList.add('hidden');
    
    // Atualiza o visual dos botões de Aba
    tabJornal.classList.add('border-stone-800', 'bg-stone-200');
    tabJornal.classList.remove('border-transparent');
    tabDossie.classList.remove('border-stone-800', 'bg-stone-200');
    tabDossie.classList.add('border-transparent');
    
    // Mostra a área de botões (Carregar/PDF)
    areaBotoes.classList.remove('hidden');
});

tabDossie.addEventListener('click', async () => {
    // Esconde o Jornal, Mostra o Dossiê
    secaoJornal.classList.add('hidden');
    secaoDossie.classList.remove('hidden');
    
    // Atualiza o visual dos botões de Aba
    tabDossie.classList.add('border-stone-800', 'bg-stone-200');
    tabDossie.classList.remove('border-transparent');
    tabJornal.classList.remove('border-stone-800', 'bg-stone-200');
    tabJornal.classList.add('border-transparent');
    
    // Esconde a área de botões (não queremos baixar PDF do dossiê agora)
    areaBotoes.classList.add('hidden');

    // MÁGICA: Carrega o Dossiê do banco de dados na hora!
    await carregarDossie();
});

// ==========================================
// 2. BUSCAR E DESENHAR DOSSIÊ GLOBAL
// ==========================================
async function carregarDossie() {
    listaDossie.innerHTML = '<p class="text-center italic text-stone-500 py-10">Consultando arquivos de inteligência da expansão Carmesim...</p>';
    try {
        const res = await fetch('https://backend-ia-jornaleira.onrender.com/api/journals/latest');
        if (!res.ok) throw new Error("Erro ao buscar a memória do mundo.");
        
        const estadoMundo = await res.json();
        
        if (!estadoMundo || !estadoMundo.nacoes_fichadas) {
            listaDossie.innerHTML = '<p class="text-center italic text-stone-500 py-10">O dossiê ainda está vazio. Feche uma edição do jornal primeiro!</p>';
            return;
        }

        listaDossie.innerHTML = estadoMundo.nacoes_fichadas.map(nacao => `
            <article class="bg-stone-50 p-6 rounded border-l-8 border-stone-800 shadow-md">
                <div class="flex justify-between items-center border-b border-stone-300 pb-2 mb-4">
                    <h3 class="text-2xl font-black uppercase tracking-tighter">${nacao.nome_nacao}</h3>
                    <span class="text-xs font-bold px-3 py-1 bg-stone-800 text-stone-100 rounded-full">FICHA ATUALIZADA</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                    <div>
                        <h4 class="font-bold text-stone-500 uppercase text-xs mb-2 italic">Situação Interna</h4>
                        <p class="text-stone-800 leading-relaxed text-sm">${nacao.situacao_interna}</p>
                    </div>
                    <div>
                        <h4 class="font-bold text-stone-500 uppercase text-xs mb-2 italic">Postura Externa</h4>
                        <p class="text-stone-800 leading-relaxed text-sm">${nacao.postura_externa}</p>
                    </div>
                </div>
            </article>
        `).join('');
    } catch (e) {
        console.error(e);
        listaDossie.innerHTML = '<p class="text-red-600 font-bold text-center py-10">Erro ao acessar os arquivos confidenciais do servidor.</p>';
    }
}

// ==========================================
// 3. FUNÇÃO MESTRE: DESENHAR O JORNAL
// ==========================================
function desenharJornalNaTela(conteudo) {
    let htmlGerado = '';

    if (conteudo.destaques) {
      htmlGerado += `
        <section class="min-h-[1050px] flex flex-col">
          <h2 class="text-3xl font-extrabold border-b-2 border-stone-800 mb-6 uppercase tracking-widest text-center mt-4">Página Principal</h2>
          <h3 class="text-2xl font-bold border-b border-stone-400 mb-4 uppercase tracking-wide">Destaques</h3>
          <div class="text-xl leading-relaxed text-justify whitespace-pre-line">${conteudo.destaques}</div>
        </section>
      `;
    }

    if (conteudo.politica) {
      htmlGerado += `
        <div class="html2pdf__page-break"></div> 
        <section class="min-h-[1050px] mt-10">
          <h2 class="text-3xl font-extrabold border-b-2 border-stone-800 mb-6 uppercase tracking-widest text-center">Caderno de Política</h2>
          <div class="text-lg leading-relaxed text-justify columns-2 gap-10 whitespace-pre-line">${conteudo.politica}</div>
        </section>
      `;
    }

    if (conteudo.economia) {
      htmlGerado += `
        <div class="html2pdf__page-break"></div> 
        <section class="min-h-[1050px] mt-10">
          <h2 class="text-3xl font-extrabold border-b-2 border-stone-800 mb-6 uppercase tracking-widest text-center">Caderno de Economia</h2>
          <div class="text-lg leading-relaxed text-justify columns-2 gap-10 whitespace-pre-line">${conteudo.economia}</div>
        </section>
      `;
    }

    if (conteudo.conflitos) {
      htmlGerado += `
        <div class="html2pdf__page-break"></div> 
        <section class="min-h-[1050px] mt-10 bg-stone-200 p-10 rounded border-l-8 border-stone-800">
          <h2 class="text-3xl font-extrabold border-b-2 border-stone-800 mb-6 uppercase tracking-widest text-center">Boletim de Conflitos</h2>
          <div class="text-lg leading-relaxed text-justify columns-2 gap-10 whitespace-pre-line">${conteudo.conflitos}</div>
        </section>
      `;
    }

    // Esconde o aviso de "Jornal Vazio" e mostra as notícias
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
    const resposta = await fetch('https://backend-ia-jornaleira.onrender.com/api/journals');
    if (!resposta.ok) throw new Error("Erro na rede.");
    
    const dados = await resposta.json();
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
        const resposta = await fetch('https://backend-ia-jornaleira.onrender.com/api/world-state');
        const jornais = await resposta.json();

        lista.innerHTML = jornais.map(j => {
            const data = new Date(j.created_at).toLocaleDateString('pt-BR');
            return `
                <li>
                    <button data-id="${j.id}" class="btn-historico w-full text-left bg-stone-200 p-2 rounded hover:bg-stone-300 transition font-bold text-stone-700">
                        Edição de ${data}
                    </button>
                </li>
            `;
        }).join('');

        document.querySelectorAll('.btn-historico').forEach(botao => {
            botao.addEventListener('click', () => {
                // Se estiver no dossiê, força a voltar pra aba de jornal pra ler
                tabJornal.click();
                
                const id = botao.getAttribute('data-id');
                const jornalEscolhido = jornais.find(j => j.id === id);
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
    
    // Escondendo os menus temporariamente para não saírem no PDF
    const areaNav = document.querySelector('nav');
    areaBotoes.classList.add('hidden');
    areaNav.classList.add('hidden');

    const opcoes = {
        margin:       [10, 10, 10, 10],
        filename:     'Cronicas_do_Mundo.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opcoes).from(elemento).save().then(() => {
        // Trazendo os botões de volta
        areaBotoes.classList.remove('hidden');
        areaNav.classList.remove('hidden');
        btnPdf.innerText = textoOriginal;
    });
});

// ==========================================
// 7. FORMULÁRIO MANUAL COM SENHA DE SEGURANÇA
// ==========================================
const formNoticia = document.getElementById('form-noticia');
const msgSucesso = document.getElementById('msg-sucesso');

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