const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { pipeline } = require('@xenova/transformers');
const fs = require('fs');
require('dotenv').config();

// ==========================================
// 1. CONFIGURAÇÕES E CLIENTES
// ==========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const qdrant = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION_NAME = 'solucoes_inovar';
const JSON_FILE = 'solucoes.json';
let extractor;

// ==========================================
// 2. MOTOR DE IA (PREPARAÇÃO)
// ==========================================
async function prepararIA() {
  registrarLog('INFO', '🧠 Carregando modelo de IA (all-MiniLM-L6-v2)...');
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  registrarLog('INFO', '✅ IA Pronta! Sistema operando com Busca Vetorial.');
}

// ==========================================
// 3. FUNÇÕES DE APOIO E LOGS
// ==========================================
let bancoDados = {};
try {
  // CORREÇÃO: Forçando leitura em UTF-8 para evitar caracteres bugados (ex: conexo)
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
  // AÇÃO: Aplicamos o peso triplicado na BUSCA para dar match com o banco populado
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
    // Técnica de Peso de Campo no salvamento
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
// 5. EVENTOS DO DISCORD
// ==========================================

client.once('ready', async () => {
  await prepararIA();
  registrarLog('INFO', `Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || message.channel.id !== process.env.CANAL_SUPORTE_ID) return;

  // --- 1. FILTRO DE COMANDOS (!ajuda, !salvar, !listar) ---
  if (message.content.startsWith('!')) {
    const partes = message.content.split('|').map(p => p.trim());
    const comando = partes[0].toLowerCase();

    if (comando === '!ajuda') {
      const ajuda = `**🤖 Suporte IA Inovar (v0.3.3)**\n\n` +
        `**Perguntar:** Digite sua dúvida normalmente.\n` +
        `**Salvar:** \`!salvar | título | solução | palavras | tags\`\n` +
        `**Listar:** \`!listar\``;
      await message.reply(ajuda);
      return; // Trava para não responder 2x
    }

    if (comando === '!listar') {
      await message.reply(`**📚 Base de Conhecimento:** ${bancoDados.solucoes.length} soluções indexadas.`);
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
      await message.reply(idSalvo ? `✅ Solução #${idSalvo} salva e canal <#${message.channel.id}> vinculado!` : '❌ Erro ao salvar.');
      return;
    }
    
    return; 
  }

  // --- 2. BUSCA SEMÂNTICA ---
  try {
    const resultados = await buscarSolucaoIA(message.content);

    // O PAINEL DE ANÁLISE COM O STATUS DE VOLTA:
    if (resultados.length > 0) {
        console.log(`\n[ANALYSIS] 🔍 Pergunta: "${message.content}"`);
        console.log(`[ANALYSIS] 🎯 Melhor Match: "${resultados[0].payload.problema}"`);
        console.log(`[ANALYSIS] 📊 Score: ${resultados[0].score.toFixed(4)} (Threshold: 0.50)`);
        console.log(`[ANALYSIS] 📈 Status: ${resultados[0].score > 0.50 ? '✅ APROVADO' : '❌ REJEITADO'}\n`);
    }

    if (resultados.length > 0 && resultados[0].score > 0.50) {
      const principal = resultados[0].payload;
      const confianca = (resultados[0].score * 100).toFixed(1);
      const corEmbed = resultados[0].score > 0.75 ? 0x2ecc71 : 0xf1c40f; 

      const embed = new EmbedBuilder()
        .setColor(corEmbed)
        .setTitle(`✅ Solução Encontrada: ${principal.problema}`)
        .setDescription(principal.solucao.replace(/@everyone/g, ''))
        .addFields(
          { name: 'Confiança da IA', value: `**${confianca}%**`, inline: true },
          { name: 'ID da Base', value: `#${principal.id}`, inline: true }
        )
        .setFooter({ text: 'Inovar Sistemas • Suporte IA Semântico' });

      await message.reply({ embeds: [embed] });

      // Sugestões Relacionadas com Menção de Canal Corrigida
      const relacionadas = resultados.slice(1).filter(r => r.score > 0.40);
      if (relacionadas.length > 0) {
        let textoRel = `**📎 Talvez isso também ajude:**\n`;
        relacionadas.forEach(r => {
          const local = r.payload.canal_id ? `<#${r.payload.canal_id}>` : `canal ${r.payload.canal_nome || 'Geral'}`;
          textoRel += `• **${r.payload.problema}** no ${local} (Confiança: ${(r.score * 100).toFixed(0)}%)\n`;
        });
        await message.channel.send(textoRel);
      }
    } else {
      await message.reply('❌ Nenhuma solução encontrada com confiança alta. Tente detalhar melhor a pergunta.');
    }
  } catch (error) {
    registrarLog('ERRO', `Falha na busca vetorial: ${error.message}`);
  }
});

client.login(process.env.DISCORD_TOKEN);