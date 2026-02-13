const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { pipeline } = require('@xenova/transformers');
const Human = require('./utils/Human');
const fs = require('fs');
const DetectIntention = require('./utils/detectIntention');
require('dotenv').config();

let humanizador = null;
let detectIntention = null;

// ==========================================
// 1. CONFIGURAÇÕES
// ==========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const qdrant = new QdrantClient({
  url: process.env.URL_QDRANT,
  checkCompatibility: false,
  timeout: 30000
});

const COLLECTION_NAME = 'solucoes_inovar';
const JSON_FILE = './utils/solutions.json';
let extractor;

// ==========================================
// 2. PREPARAÇÃO DE IA
// ==========================================
async function prepararIA() {
  registrarLog('INFO', '🧠 Carregando modelo de IA (all-MiniLM-L6-v2)...');
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  // Inicializar detector de intenção (V2.0 com respostas coloquiais)
  registrarLog('INFO', '🧭 Inicializando Detector de Intenção v2.0...');
  detectIntention = new DetectIntention();
  registrarLog('INFO', '✅ Detector de Intenção pronto!');

  // Inicializar humanizador se ativado
  const USAR_HUMANIZACAO = process.env.USAR_HUMANIZACAO === 'true';
  if (USAR_HUMANIZACAO) {
    registrarLog('INFO', '✨ Inicializando Humanizador (Ollama)...');
    humanizador = new Human();

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

function registrarLog(tipo, mensagem) {
  const timestamp = new Date().toLocaleString('pt-BR');
  const linha = `[${timestamp}] ${tipo}: ${mensagem}\n`;
  fs.appendFileSync('log.txt', linha);
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
    const analise = await detectIntention.classificarComResposta(message.content);
    const info = detectIntention.obterInfo(analise.tipo);

    console.log(`\n[ANALYSIS] ${info.emoji} ${analise.tipo} (confiança: ${(analise.confianca * 100).toFixed(0)}%)`);

    // --- SAUDAÇÃO ---
    if (analise.tipo === 'SAUDACAO') {
      console.log(`[ANALYSIS] 💬 Respondendo com mensagem coloquial...`);

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
      console.log(`[ANALYSIS] ❌ Mensagem fora do escopo`);

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(analise.resposta)
        .setFooter({ text: 'Inovar Sistemas • Foco: Suporte Técnico' });

      await message.reply({ embeds: [embed] });
      registrarLog('INFO', `❌ Off-topic rejeitado gentilmente`);
      return;
    }

    // --- VAGO ---
    if (analise.tipo === 'VAGO') {
      console.log(`[ANALYSIS] ❓ Mensagem vaga`);

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

    // --- SUPORTE ou INDEFINIDO ---
    if (analise.tipo === 'SUPORTE' || analise.tipo === 'INDEFINIDO') {
      console.log(`[ANALYSIS] 🔍 Buscando solução na base...`);
      return processarSuporte(message);
    }

  } catch (erro) {
    registrarLog('ERRO', `Erro ao processar mensagem: ${erro.message}`);
    await message.reply('❌ Oops! Teve um erro. Tenta de novo?');
  }
}

async function processarSuporte(message) {
  const resultados = await buscarSolucaoIA(message.content);

  if (resultados.length > 0) {
    console.log(`[ANALYSIS] 🔎 Pergunta: "${message.content}"`);
    console.log(`[ANALYSIS] 🎯 Match: "${resultados[0].payload.problema}"`);
    console.log(`[ANALYSIS] 📊 Score: ${resultados[0].score.toFixed(4)}`);
    console.log(`[ANALYSIS] 🚦 Status: ${resultados[0].score > 0.50 ? '✅ APROVADO' : '❌ REJEITADO'}\n`);
  }

  if (resultados.length > 0 && resultados[0].score > 0.50) {
    const principal = resultados[0].payload;
    const confianca = (resultados[0].score * 100).toFixed(1);

    let solucaoExibida = principal.solucao;
    let humanizada = false;

    if (humanizador && confianca >= 60) {
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

    const corEmbed = resultados[0].score > 0.75 ? 0x2ecc71 : 0xf1c40f;

    const embed = new EmbedBuilder()
      .setColor(corEmbed)
      .setTitle(`✅ Solução: ${principal.problema}`)
      .setDescription(solucaoExibida.replace(/@everyone/g, ''))
      .addFields(
        { name: 'Confiança', value: `**${confianca}%**`, inline: true },
        { name: 'ID', value: `#${principal.id}`, inline: true },
        { name: 'Status', value: humanizada ? '🎨 Humanizada' : '📖 Original', inline: true }
      )
      .setFooter({ text: 'Inovar Sistemas • Suporte IA Semântico' });

    const msgResposta = await message.reply({ embeds: [embed] });

    await msgResposta.react('👍');
    await msgResposta.react('👎');
    if (humanizada) await msgResposta.react('🤖');

    const relacionadas = resultados.slice(1).filter(r => r.score > 0.40);
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
    const ajuda = `**🤖 Suporte IA Inovar (v0.4.0)**\n\n` +
      `**Conversar:** Digite uma saudação ou pergunta normalmente.\n` +
      `**Perguntar:** Dúvida sobre o sistema - busca automática.\n` +
      `**Salvar:** \`!salvar | título | solução | palavras | tags\`\n` +
      `**Listar:** \`!listar\``;
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
}

// ==========================================
// 6. EVENTOS DO DISCORD
// ==========================================

client.once('ready', async () => {
  await prepararIA();
  registrarLog('INFO', `✅ Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || message.channel.id !== process.env.CANAL_SUPORTE_ID) return;

  await processarMensagem(message);
});

client.login(process.env.DISCORD_TOKEN);