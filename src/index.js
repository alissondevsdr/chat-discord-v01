const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { pipeline } = require('@xenova/transformers');
const IntentionClassifier = require('./modules/support/analyzers/intentionClassifier');
const MessageAnalyzer = require('./modules/support/analyzers/messageAnalyzer');
const SolutionHumanizer = require('./modules/support/generators/solutionHumanizer');
const ResponseGenerator = require('./modules/support/generators/responseGenerator');
const fs = require('fs');
require('dotenv').config();

let humanizador = null;
let intentionClassifier = null;

// ==========================================
// 1. CONFIGURAÇÕES
// ==========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const qdrant = new QdrantClient({
  url: process.env.URL_QDRANT,
  checkCompatibility: false,
  timeout: 30000
});

const COLLECTION_NAME = 'solucoes_inovar';
const JSON_FILE = './data/solutions.json';
let extractor;

// ⚙️ THRESHOLDS DE BUSCA (PUXADOS DO .ENV)
const THRESHOLD_BUSCA = parseFloat(process.env.THRESHOLD_BUSCA) || 0.65;  // Limiar principal de relevância
const THRESHOLD_MINIMO = parseFloat(process.env.THRESHOLD_MINIMO) || 0.50;  // Mínimo para aceitar resultado
const THRESHOLD_HUMANIZACAO = parseFloat(process.env.THRESHOLD_HUMANIZACAO) || 0.60;  // Confiança para humanizar
const THRESHOLD_CONFIANCA_ALTA = parseFloat(process.env.THRESHOLD_CONFIANCA_ALTA) || 0.75;  // Para cor verde
const THRESHOLD_RELACIONADAS = parseFloat(process.env.THRESHOLD_RELACIONADAS) || 0.40;  // Para mostrar soluções relacionadas

// ==========================================
// 2. PREPARAÇÃO DE IA
// ==========================================
async function prepararIA() {
  registrarLog('INFO', '🧠 Carregando modelo de IA (multilingual-e5-small)...');
  extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');

  // Inicializar detector de intenção
  registrarLog('INFO', '🧭 Inicializando Detector de Intenção.');
  intentionClassifier = new IntentionClassifier();
  registrarLog('INFO', '✅ Detector de Intenção pronto!');

  // Inicializar humanizador
  const USAR_HUMANIZACAO = process.env.USAR_HUMANIZACAO === 'true';
  if (USAR_HUMANIZACAO) {
    registrarLog('INFO', '✨ Inicializando Humanizador (Ollama)...');
    humanizador = new SolutionHumanizer();

    const ollamaOk = await humanizador.testarConexao();
    if (ollamaOk) {
      registrarLog('INFO', '✅ Ollama conectado! Humanização ativa.');
    } else {
      registrarLog('AVISO', '⚠️ Ollama não acessível. Humanização desativada.');
      humanizador = null;
    }
  }

  registrarLog('INFO', '✅ IA Pronta! Sistema: Busca Vetorial + Detector Intenção + Respostas Coloquiais.');
}

// ==========================================
// 3. FUNÇÕES DE APOIO
// ==========================================
let bancoDados = {};
try {
  const dados = fs.readFileSync(JSON_FILE, 'utf8');
  bancoDados = JSON.parse(dados);
  console.log(`✅ Banco de dados carregado: ${bancoDados.solucoes.length} soluções`);
} catch (erro) {
  console.error(`❌ Erro ao carregar ${JSON_FILE}:`, erro.message);
  process.exit(1);
}

const LOG_DIR = './logs';
const LOG_FILE = `${LOG_DIR}/log.txt`;

// Criar diretório se não existir
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function registrarLog(tipo, mensagem) {
  const timestamp = new Date().toLocaleString('pt-BR');
  const linha = `[${timestamp}] ${tipo}: ${mensagem}\n`;
  fs.appendFileSync(LOG_FILE, linha);
  console.log(linha.trim());
}

// ==========================================
// 4. FUNÇÕES DE IA (BUSCA E SALVAMENTO)
// ==========================================

async function buscarSolucaoIA(pergunta) {
  const buscaComPeso = `PROBLEMA: ${pergunta}. PROBLEMA: ${pergunta}. PROBLEMA: ${pergunta}.`;

  const output = await extractor(buscaComPeso, { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data);

  return await qdrant.search(COLLECTION_NAME, {
    vector: embedding,
    limit: 3,
    with_payload: true
  });
}

async function salvarNovaSolucao(problema, solucao, palavrasChave, tags, canalId, canalNome) {
  const novoId = bancoDados.solucoes.length > 0
    ? Math.max(...bancoDados.solucoes.map(s => s.id)) + 1
    : 1;

  try {
    const textoParaVetor = `PROBLEMA: ${problema}. PROBLEMA: ${problema}. PROBLEMA: ${problema}. CONTEÚDO: ${solucao}`;
    const output = await extractor(textoParaVetor, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);

    await qdrant.upsert(COLLECTION_NAME, {
      points: [{
        id: novoId,
        vector: embedding,
        payload: {
          id: novoId,
          problema,
          solucao,
          tags,
          canal_id: canalId,
          canal_nome: canalNome
        }
      }]
    });

    const novaSolucao = {
      id: novoId,
      palavras_chave: palavrasChave,
      problema: problema,
      solucao: solucao,
      tags: tags,
      metadata: {
        canal_id: canalId,
        canal_nome: canalNome,
        total_mensagens: 1,
        data_export: new Date().toISOString()
      }
    };

    bancoDados.solucoes.push(novaSolucao);
    fs.writeFileSync(JSON_FILE, JSON.stringify(bancoDados, null, 2), 'utf8');

    return novoId;
  } catch (erro) {
    registrarLog('ERRO', `Falha ao salvar: ${erro.message}`);
    return null;
  }
}

// ==========================================
// 5. PROCESSAMENTO DE MENSAGENS
// ==========================================

async function processarMensagem(message) {
  try {
    // Classificar e gerar resposta se necessário
    const analise = await intentionClassifier.classificarComResposta(message.content);
    const info = intentionClassifier.obterInfo(analise.tipo);
    const validacao = analise.validacaoContexto;
    const acao = analise.acaoRecomendada;

    console.log(`\n[ANALYSIS] ${info.emoji} ${analise.tipo} (confiança: ${(analise.confianca * 100).toFixed(0)}%)`);

    if (validacao && validacao.scoreRelevancia !== undefined) {
      const scoreRelevancia = validacao.scoreRelevancia || 0;
      const scoreOffTopic = validacao.scoreOffTopic || 0;
      const scoreCoerencia = validacao.scoreCoerencia || 0;
      const estrutura = validacao?.categorias?.estrutura || 'INDEFINIDO';
      console.log(`[CONTEXT] 📊 Relevância: ${(scoreRelevancia * 100).toFixed(0)}% | Off-Topic: ${(scoreOffTopic * 100).toFixed(0)}%`);
      console.log(`[CONTEXT] 🔍 Estrutura: ${estrutura} | Coerência: ${(scoreCoerencia * 100).toFixed(0)}%`);
    }

    // --- SAUDAÇÃO ---
    if (analise.tipo === 'SAUDACAO') {
      console.log(`[ACTION] 💬 Respondendo com mensagem coloquial...`);

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setDescription(analise.resposta)
        .setFooter({ text: `Inovar Sistemas • ${analise.fonteFesposta}` });

      await message.reply({ embeds: [embed] });
      registrarLog('INFO', `💬 Saudação respondida (${analise.fonteFesposta})`);
      return;
    }

    // --- OFF-TOPIC ---
    if (analise.tipo === 'OFF_TOPIC') {
      console.log(`[ACTION] ❌ Mensagem detectada como off-topic`);
      console.log(`[REASON] ${validacao.motivo}`);

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(analise.resposta)
        .setFooter({ text: 'Inovar Sistemas • Foco: Suporte Técnico' });

      await message.reply({ embeds: [embed] });
      registrarLog('INFO', `❌ Off-topic rejeitado gentilmente (${validacao.motivo})`);
      return;
    }

    // --- VAGO ---
    if (analise.tipo === 'VAGO') {
      console.log(`[ACTION] ❓ Mensagem vaga - pedindo clarificação`);

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setDescription(analise.resposta)
        .setFooter({ text: 'Inovar Sistemas • Preciso de mais detalhes' });

      await message.reply({ embeds: [embed] });
      registrarLog('INFO', `❓ Pedido de clarificação enviado`);
      return;
    }

    // --- COMANDO ---
    if (analise.tipo === 'COMANDO') {
      return processarComando(message);
    }

    // --- SUPORTE ou INDEFINIDO com validação ---
    if (analise.tipo === 'SUPORTE' || analise.tipo === 'INDEFINIDO') {
      // Se não validar contexto, pedir clarificação
      const scoreRelevancia = validacao?.scoreRelevancia || 0;
      const valido = validacao?.valido !== false;

      if (!valido && scoreRelevancia < 0.3) {
        console.log(`[ACTION] ❓ Contexto inválido - rejeitando`);
        const embed = new EmbedBuilder()
          .setColor(0xf39c12)
          .setDescription(`Hmm, sua pergunta não ficou clara... 🤔\n\nPode me detalhar melhor? Qual é a dúvida específica sobre o sistema Inovar?`)
          .setFooter({ text: 'Inovar Sistemas' });

        await message.reply({ embeds: [embed] });
        registrarLog('INFO', `❓ Contexto inválido - esclarecimento solicitado`);
        return;
      }

      console.log(`[ACTION] 🔍 Buscando solução na base...`);
      return processarSuporte(message);
    }

  } catch (erro) {
    registrarLog('ERRO', `Erro ao processar mensagem: ${erro.message}`);
    await message.reply('❌ Oops! Teve um erro. Tenta de novo?');
  }
}

async function reescreverPergunta(perguntaOriginal) {
  try {
    const response = await fetch(`${process.env.URL_OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.MODELO_OLLAMA,
        prompt: `Você é especialista em sistemas ERP de gestão comercial.
Reformule a pergunta abaixo em linguagem técnica, em 1-2 frases objetivas.
Não responda a pergunta, apenas reformule-a.

Pergunta original: "${perguntaOriginal}"
Pergunta reformulada:`,
        stream: false,
        options: { temperature: 0.1, num_predict: 80 }
      })
    });

    const data = await response.json();
    const reformulada = data.response.trim();

    registrarLog('INFO', `🔄 Pergunta reformulada: "${reformulada}"`);
    return reformulada;
  } catch (erro) {
    registrarLog('AVISO', `⚠️ Reescrita falhou, usando original: ${erro.message}`);
    return perguntaOriginal; // fallback seguro
  }
}

async function buscarComMultiQuery(pergunta) {
  try {
    const response = await fetch(`${process.env.URL_OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.MODELO_OLLAMA,
        prompt: `Gere 3 formas diferentes de perguntar sobre o mesmo problema de sistema ERP.
Responda apenas com as 3 perguntas, uma por linha, sem numeração.

Pergunta original: "${pergunta}"`,
        stream: false,
        options: { temperature: 0.4, num_predict: 150 }
      })
    });

    const data = await response.json();
    const variacoes = [
      pergunta,
      ...data.response.trim().split('\\n').filter(l => l.trim()).slice(0, 3)
    ];

    // Busca paralela com todas as variações
    const todosResultados = await Promise.all(
      variacoes.map(v => buscarSolucaoIA(v))
    );

    // Junta, remove duplicatas por ID e ordena por score
    const mapa = new Map();
    todosResultados.flat().forEach(r => {
      if (!mapa.has(r.id) || mapa.get(r.id).score < r.score) {
        mapa.set(r.id, r);
      }
    });

    return Array.from(mapa.values()).sort((a, b) => b.score - a.score);
  } catch {
    return buscarSolucaoIA(pergunta); // fallback
  }
}

async function processarSuporte(message) {
  // Reescrever antes de buscar
  const perguntaOtimizada = await reescreverPergunta(message.content);

  // Busca com a pergunta otimizada (mantém fallback para original)
  const resultados = await buscarComMultiQuery(perguntaOtimizada);

  if (resultados.length > 0) {
    console.log(`[ANALYSIS] 🔎 Pergunta: "${message.content}"`);
    console.log(`[ANALYSIS] 🎯 Match: "${resultados[0].payload.problema}"`);
    console.log(`[ANALYSIS] 📊 Score: ${resultados[0].score.toFixed(4)}`);
    console.log(`[ANALYSIS] 🚦 Status: ${resultados[0].score > THRESHOLD_MINIMO ? '✅ APROVADO' : '❌ REJEITADO'}\n`);
  }

  if (resultados.length > 0 && resultados[0].score > THRESHOLD_MINIMO) {
    const principal = resultados[0].payload;
    const confianca = (resultados[0].score * 100).toFixed(1);

    let solucaoExibida = principal.solucao;
    let humanizada = false;

    if (humanizador && confianca >= (THRESHOLD_HUMANIZACAO * 100)) {
      registrarLog('INFO', `🎨 Humanizando solução #${principal.id}...`);
      try {
        solucaoExibida = await humanizador.humanizar(principal, message.content);
        humanizada = true;
        registrarLog('INFO', `✅ Humanização bem-sucedida #${principal.id}`);
      } catch (erro) {
        registrarLog('AVISO', `Erro ao humanizar: ${erro.message}`);
        solucaoExibida = principal.solucao;
      }
    }

    // Registrar informações detalhadas no log
    registrarLog('INFO', `✅ Confiança: ${confianca}% | ID: #${principal.id} | Status: ${humanizada ? '🎨 Humanizada' : '📖 Original'}`);

    // Formatar resposta com título e conteúdo bem estruturado
    const respostaPronta = `**${principal.problema}**\n\n${solucaoExibida.replace(/@everyone/g, '')}`;

    // Enviar resposta como mensagem normal (sem embed)
    const msgResposta = await message.reply(respostaPronta);

    const relacionadas = resultados.slice(1).filter(r => r.score > THRESHOLD_RELACIONADAS);
    if (relacionadas.length > 0) {
      let textoRel = `**🔗 Relacionadas:**\n`;
      relacionadas.forEach(r => {
        const local = r.payload.canal_id ? `<#${r.payload.canal_id}>` : 'Geral';
        textoRel += `• ${r.payload.problema} (${(r.score * 100).toFixed(0)}%)\n`;
      });
      await message.channel.send(textoRel);
    }
  } else {
    await message.reply('❌ Nenhuma solução encontrada. Tente detalhar melhor.');
  }
}

async function processarComando(message) {
  const partes = message.content.split('|').map(p => p.trim());
  const comando = partes[0].toLowerCase();

  if (comando === '!ajuda') {
    const ajuda = `**🤖 Suporte IA Inovar (v0.5.0 - Smart Context)**\n\n` +
      `**Conversar:** Digite uma saudação ou pergunta normalmente.\n` +
      `**Perguntar:** Dúvida sobre o sistema - busca automática.\n` +
      `**Salvar:** \`!salvar | título | solução | palavras | tags\`\n` +
      `**Listar:** \`!listar\`\n` +
      `**Debug:** \`!debug <pergunta>\` - análise de busca\n` +
      `**Análise:** \`!analise <mensagem>\` - análise completa de intenção`;
    await message.reply(ajuda);
    return;
  }

  if (comando === '!listar') {
    await message.reply(`**📚 Base:** ${bancoDados.solucoes.length} soluções indexadas.`);
    return;
  }

  if (comando === '!salvar') {
    if (partes.length !== 5) {
      await message.reply('❌ Use: `!salvar | título | solução | palavras | tags`');
      return;
    }

    const [, problema, solucao, palavrasTexto, tagsTexto] = partes;
    const idSalvo = await salvarNovaSolucao(
      problema,
      solucao,
      palavrasTexto.split(','),
      tagsTexto.split(','),
      message.channel.id,
      message.channel.name
    );
    await message.reply(idSalvo ? `✅ Solução #${idSalvo} salva!` : '❌ Erro ao salvar.');
    return;
  }

  if (comando === '!debug') {
    if (partes.length < 2) {
      await message.reply('Use: `!debug <sua pergunta>`');
      return;
    }

    const pergunta = partes.slice(1).join(' ');
    const resultados = await buscarSolucaoIA(pergunta);

    let debug = `**🔍 Debug: "${pergunta}"**\n\n`;
    debug += `Resultados: ${resultados.length}\n\n`;

    resultados.forEach((r, i) => {
      debug += `${i + 1}. ${r.payload.problema} (${r.score.toFixed(4)})\n`;
    });

    if (humanizador) {
      const metricas = humanizador.obterMetricas();
      debug += `\n**Humanizador:** ${metricas.sucessos} sucessos`;
    }

    await message.reply(debug);
    return;
  }

  if (comando === '!analise') {
    if (partes.length < 2) {
      await message.reply('Use: `!analise <sua mensagem>`');
      return;
    }

    const textoPraAnalisar = partes.slice(1).join(' ');
    const analiseCompleta = await intentionClassifier.obterAnaliseCompleta(textoPraAnalisar);
    const val = analiseCompleta.validacao;

    let resposta = `**📊 ANÁLISE COMPLETA: "${textoPraAnalisar}"\n\n`;
    resposta += `🎯 **Classificação:** ${analiseCompleta.classificacao.tipo} (${(analiseCompleta.classificacao.confianca * 100).toFixed(0)}%)\n`;
    resposta += `📈 **Relevância ao Sistema:** ${(val.scoreRelevancia * 100).toFixed(0)}%\n`;
    resposta += `🚨 **Off-Topic Score:** ${(val.scoreOffTopic * 100).toFixed(0)}%\n`;
    resposta += `🔧 **Estrutura:** ${val.categorias.estrutura}\n`;
    resposta += `✅ **Coerência:** ${(val.scoreCoerencia * 100).toFixed(0)}%\n`;
    resposta += `\n💡 **Motivo:** ${val.motivo}\n`;
    resposta += `🎬 **Ação Recomendada:** ${analiseCompleta.classificacao.acaoRecomendada}\n`;

    if (analiseCompleta.classificacao.resposta) {
      resposta += `\n📝 **Resposta Gerada:** ${analiseCompleta.classificacao.resposta.substring(0, 200)}...\n`;
    }

    resposta += `\n📌 **Detalhes da Validação:**\n`;
    resposta += `• Poesia/Rimas: ${val.categorias.temPoesiasOuRimas ? 'SIM ⚠️' : 'não'}\n`;
    resposta += `• Maiúsculas: ${val.scoreCoerencia > 0.5 ? 'Normal ✅' : 'Suspeito 🚩'}\n`;
    resposta += `• Valido: ${val.valido ? 'SIM ✅' : 'NÃO ❌'}\n` + '```';

    await message.reply(resposta);
    return;
  }
}

// ==========================================
// 6. EVENTOS DO DISCORD
// ==========================================

client.once('ready', async () => {
  await prepararIA();
  registrarLog('INFO', `✅ Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const isDM = message.channel.type === 1; // ChannelType.DM = 1

  if (!isDM) {
    try {
      await message.author.send(
        '👋 Oi! Para dúvidas sobre o sistema, me manda uma mensagem aqui no privado. Estou pronto para ajudar!'
      );
    } catch {
      // Usuário pode ter DMs desabilitadas — ignora silenciosamente
    }
    return;
  }

  await processarMensagem(message);
});

client.login(process.env.DISCORD_TOKEN);