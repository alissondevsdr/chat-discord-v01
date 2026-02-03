// Importar bibliotecas necessárias
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// Criar o cliente do bot com as permissões necessárias
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Carregar banco de dados de soluções
let bancoDados = {};
try {
  const dados = fs.readFileSync('solucoes_importadas.json', 'utf8');
  bancoDados = JSON.parse(dados);
  console.log(`✅ Banco de dados carregado: ${bancoDados.solucoes.length} soluções`);
} catch (erro) {
  console.error('❌ Erro ao carregar solucoes_importadas.json:', erro.message);
  process.exit(1);
}

// Função para registrar logs em arquivo
function registrarLog(tipo, mensagem) {
  const timestamp = new Date().toLocaleString('pt-BR');
  const linha = `[${timestamp}] ${tipo}: ${mensagem}\n`;

  fs.appendFileSync('log.txt', linha);
  console.log(linha.trim());
}

// Função para buscar solução por palavras-chave (versão melhorada)
function buscarSolucao(pergunta) {
  const perguntaLower = pergunta.toLowerCase();
  let melhorMatch = null;
  let maiorPontuacao = 0;

  // Percorrer todas as soluções e dar pontuação
  for (const solucao of bancoDados.solucoes) {
    let pontuacao = 0;

    // Verificar palavras-chave (peso maior)
    for (const palavra of solucao.palavras_chave) {
      if (perguntaLower.includes(palavra.toLowerCase())) {
        pontuacao += 3; // Peso 3 para palavras-chave
      }
    }

    // Verificar tags (peso menor)
    for (const tag of solucao.tags) {
      if (perguntaLower.includes(tag.toLowerCase())) {
        pontuacao += 1; // Peso 1 para tags
      }
    }

    // Verificar no título do problema
    const problemaWords = solucao.problema.toLowerCase().split(' ');
    for (const word of problemaWords) {
      if (word.length > 3 && perguntaLower.includes(word)) {
        pontuacao += 2; // Peso 2 para palavras do título
      }
    }

    // Atualizar melhor match se encontrou pontuação maior
    if (pontuacao > maiorPontuacao) {
      maiorPontuacao = pontuacao;
      melhorMatch = solucao;
    }
  }

  // Retornar apenas se tiver pontuação mínima de 2
  return maiorPontuacao >= 2 ? melhorMatch : null;
}

// Função para buscar múltiplas soluções relacionadas
function buscarSolucoesRelacionadas(pergunta, limite = 3) {
  const perguntaLower = pergunta.toLowerCase();
  const resultados = [];

  for (const solucao of bancoDados.solucoes) {
    let pontuacao = 0;

    // Mesma lógica de pontuação da função anterior
    for (const palavra of solucao.palavras_chave) {
      if (perguntaLower.includes(palavra.toLowerCase())) {
        pontuacao += 3;
      }
    }

    for (const tag of solucao.tags) {
      if (perguntaLower.includes(tag.toLowerCase())) {
        pontuacao += 1;
      }
    }

    if (pontuacao > 0) {
      resultados.push({ solucao, pontuacao });
    }
  }

  // Ordenar por pontuação e retornar top N
  return resultados
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .slice(0, limite)
    .map(r => r.solucao);
}

// Função para salvar nova solução no JSON
function salvarNovaSolucao(problema, solucao, palavrasChave, tags) {
  const novoId = bancoDados.solucoes.length > 0
    ? Math.max(...bancoDados.solucoes.map(s => s.id)) + 1
    : 1;

  const novaSolucao = {
    id: novoId,
    palavras_chave: palavrasChave,
    problema: problema,
    solucao: solucao,
    tags: tags,
    metadata: {
      canal_id: null,
      canal_nome: 'adicionado-manualmente',
      total_mensagens: 1,
      data_export: new Date().toISOString()
    }
  };

  bancoDados.solucoes.push(novaSolucao);

  try {
    fs.writeFileSync('solucoes_importadas.json', JSON.stringify(bancoDados, null, 2), 'utf8');
    return true;
  } catch (erro) {
    registrarLog('ERRO', `Erro ao salvar: ${erro.message}`);
    return false;
  }
}

// Quando o bot estiver pronto e online
client.once('ready', () => {
  registrarLog('INFO', `Bot conectado como ${client.user.tag}`);
  registrarLog('INFO', `Monitorando canal ID: ${process.env.CANAL_SUPORTE_ID}`);
});

// Quando uma mensagem for enviada
client.on('messageCreate', async (message) => {
  // Ignorar mensagens do próprio bot
  if (message.author.bot) return;

  // Processar apenas mensagens do canal de suporte configurado
  if (message.channel.id !== process.env.CANAL_SUPORTE_ID) return;

  registrarLog('INFO', `Pergunta de ${message.author.tag}: ${message.content}`);

  // Comando de ajuda
  if (message.content === '!ajuda') {
    const ajuda = `
**🤖 Comandos do Bot de Suporte Inovar**

**Para fazer perguntas:**
Apenas escreva sua dúvida normalmente. Exemplo:
\`como resetar senha?\`

**Para salvar uma nova solução:**
\`!salvar | título do problema | solução detalhada | palavra1,palavra2,palavra3 | tag1,tag2\`

**Exemplo de salvamento:**
\`!salvar | Erro de conexão com banco | Reinicie o serviço SQL Server | erro,conexao,banco,sql | database,erro\`

**Para ver esta ajuda:**
\`!ajuda\`

**Para listar soluções:**
\`!listar\`

**Para buscar por tag:**
\`!tag nome-da-tag\`
    `;
    await message.reply(ajuda);
    return;
  }

  // Comando para listar todas as soluções
  if (message.content === '!listar') {
    if (bancoDados.solucoes.length === 0) {
      await message.reply('Ainda não há soluções cadastradas.');
      return;
    }

    // Agrupar por categoria
    const porCategoria = {};
    bancoDados.solucoes.forEach(sol => {
      const categoria = sol.tags[0] || 'Sem categoria';
      if (!porCategoria[categoria]) {
        porCategoria[categoria] = [];
      }
      porCategoria[categoria].push(sol);
    });

    let lista = '**📚 Soluções Cadastradas:**\n\n';

    for (const [categoria, solucoes] of Object.entries(porCategoria)) {
      lista += `**${categoria.toUpperCase()}:**\n`;
      solucoes.slice(0, 5).forEach(sol => {
        lista += `• **ID ${sol.id}:** ${sol.problema}\n`;
      });
      if (solucoes.length > 5) {
        lista += `  _(+ ${solucoes.length - 5} outras)_\n`;
      }
      lista += '\n';
    }

    lista += `\n**Total:** ${bancoDados.solucoes.length} soluções`;

    await message.reply(lista);
    return;
  }

  // Comando para buscar por tag
  if (message.content.startsWith('!tag ')) {
    const tagBuscada = message.content.replace('!tag ', '').toLowerCase().trim();

    const encontradas = bancoDados.solucoes.filter(sol =>
      sol.tags.some(tag => tag.toLowerCase().includes(tagBuscada))
    );

    if (encontradas.length === 0) {
      await message.reply(`Nenhuma solução encontrada com a tag "${tagBuscada}"`);
      return;
    }

    let lista = `**🏷️ Soluções com a tag "${tagBuscada}":**\n\n`;
    encontradas.slice(0, 10).forEach(sol => {
      lista += `**ID ${sol.id}:** ${sol.problema}\n`;
      lista += `*Tags: ${sol.tags.join(', ')}*\n\n`;
    });

    if (encontradas.length > 10) {
      lista += `_(Mostrando 10 de ${encontradas.length} resultados)_`;
    }

    await message.reply(lista);
    return;
  }

  // Comando para salvar nova solução
  if (message.content.startsWith('!salvar')) {
    const partes = message.content.split('|').map(p => p.trim());

    if (partes.length !== 5) {
      await message.reply('❌ Formato incorreto. Use:\n`!salvar | problema | solução | palavra1,palavra2 | tag1,tag2`');
      return;
    }

    const [, problema, solucao, palavrasTexto, tagsTexto] = partes;
    const palavras = palavrasTexto.split(',').map(p => p.trim());
    const tags = tagsTexto.split(',').map(t => t.trim());

    const sucesso = salvarNovaSolucao(problema, solucao, palavras, tags);

    if (sucesso) {
      await message.reply(`✅ Solução salva com sucesso! Total de soluções: ${bancoDados.solucoes.length}`);
      registrarLog('INFO', `Nova solução salva: "${problema}"`);
    } else {
      await message.reply('❌ Erro ao salvar a solução. Verifique os logs.');
    }

    return;
  }

  // Buscar solução no banco de dados
  const solucaoEncontrada = buscarSolucao(message.content);

  if (solucaoEncontrada) {
    // Encontrou uma solução!
    registrarLog('INFO', `Solução encontrada: ID ${solucaoEncontrada.id}`);

    // Limpar @everyone do texto
    const solucaoLimpa = solucaoEncontrada.solucao.replace(/@everyone/g, '');

    const resposta = `**${solucaoEncontrada.problema}**\n\n${solucaoLimpa}\n\n*Tags: ${solucaoEncontrada.tags.join(', ')}*\n*ID: ${solucaoEncontrada.id}*`;

    await message.reply(resposta);

    // Buscar soluções relacionadas
    const relacionadas = buscarSolucoesRelacionadas(message.content, 3)
      .filter(s => s.id !== solucaoEncontrada.id);

    if (relacionadas.length > 0) {
      let sugestoes = '\n\n**📎 Soluções relacionadas:**\n';
      relacionadas.forEach(sol => {
        sugestoes += `• ${sol.problema} (ID: ${sol.id})\n`;
      });
      await message.channel.send(sugestoes);
    }

  } else {
    // Não encontrou solução
    registrarLog('INFO', 'Nenhuma solução encontrada');

    await message.reply('❌ Não encontrei uma solução registrada para essa dúvida.\n\n**Você pode:**\n• Tentar reformular a pergunta\n• Usar `!listar` para ver todas as soluções\n• Consultar um membro da equipe de suporte');
  }
});

// Fazer login com o token
client.login(process.env.DISCORD_TOKEN);