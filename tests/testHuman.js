/**
 * 🧪 TESTE DO HUMANIZADOR V04
 * Valida se a humanização está funcionando corretamente
 * 
 * Execução:
 *   node testar-humanizador.js
 */

const Humanizador = require('../utils/Human');
const fs = require('fs');
require('dotenv').config();

// Cores para terminal
const cores = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  amarelo: '\x1b[33m',
  azul: '\x1b[34m',
  cinza: '\x1b[90m'
};

function log(cor, emoji, texto) {
  console.log(`${cores[cor]}${emoji} ${texto}${cores.reset}`);
}

async function testarHumanizador() {
  log('azul', '🧪', '=== TESTE DO HUMANIZADOR V04 ===\n');

  const humanizador = new Humanizador();

  // Teste 1: Conexão
  log('azul', '1️⃣', 'Testando conexão com Ollama...');
  const conectado = await humanizador.testarConexao();
  if (!conectado) {
    log('amarelo', '⚠️', 'Ollama não está acessível. Iniciando mesmo assim...\n');
  } else {
    console.log('');
  }

  // Teste 2: Carregar soluções do banco
  log('azul', '2️⃣', 'Carregando soluções do banco...');
  let bancoDados = {};
  try {
    const dados = fs.readFileSync('../utils/solutions.json', 'utf8');
    bancoDados = JSON.parse(dados);
    log('verde', '✅', `${bancoDados.solucoes.length} soluções carregadas\n`);
  } catch (erro) {
    log('amarelo', '⚠️', `Não conseguiu carregar solucoes.json: ${erro.message}\n`);
    process.exit(1);
  }

  // Teste 3: Humanizar primeiras 3 soluções
  log('azul', '3️⃣', 'Testando humanização (3 primeiras soluções)...\n');

  const solucoesTeste = bancoDados.solucoes.slice(0, 3);

  for (let i = 0; i < solucoesTeste.length; i++) {
    const solucao = solucoesTeste[i];
    const pergunta = `Como ${solucao.problema.toLowerCase()}?`;

    log('cinza', `   [${i + 1}/${solucoesTeste.length}]`, `Humanizando: "${solucao.problema}"`);
    console.log(`${cores.cinza}       Pergunta: "${pergunta}"${cores.reset}`);

    const resultado = await humanizador.humanizar(solucao, pergunta);

    // Comparar comprimentos
    const compOriginal = solucao.solucao.length;
    const compHumanizada = resultado.length;
    const diferenca = ((compHumanizada / compOriginal) * 100).toFixed(0);

    console.log(`${cores.cinza}       Original: ${compOriginal} chars | Humanizada: ${compHumanizada} chars (${diferenca}%)${cores.reset}`);

    // Mostrar preview
    const preview = resultado.substring(0, 80).replace(/\n/g, ' ');
    console.log(`${cores.cinza}       Preview: "${preview}..."${cores.reset}\n`);
  }

  // Teste 4: Cache
  log('azul', '4️⃣', 'Testando cache (mesma solução novamente)...\n');

  const solucaoTeste = solucoesTeste[0];
  const perguntaTeste = `Como ${solucaoTeste.problema.toLowerCase()}?`;

  const tempoInicio = Date.now();
  const resultado = await humanizador.humanizar(solucaoTeste, perguntaTeste);
  const tempoCache = Date.now() - tempoInicio;

  console.log(`${cores.cinza}   Tempo de cache: ${tempoCache}ms (ideal <50ms)${cores.reset}\n`);

  // Teste 5: Métricas
  log('azul', '5️⃣', 'Métricas Finais:\n');

  const metricas = humanizador.obterMetricas();
  console.log(`${cores.verde}✅ Sucessos:        ${metricas.sucessos}${cores.reset}`);
  console.log(`${cores.amarelo}⚠️  Fallbacks:       ${metricas.fallbacks}${cores.reset}`);
  console.log(`${cores.cinza}❌ Falhas:          ${metricas.falhas}${cores.reset}`);
  console.log(`${cores.cinza}   Total tentativas: ${metricas.totalTentativas}${cores.reset}`);
  console.log(`${cores.verde}   Taxa sucesso:     ${metricas.taxaSucessoPct}%${cores.reset}`);
  console.log(`${cores.cinza}   Taxa fallback:    ${metricas.taxaFallbackPct}%${cores.reset}`);
  console.log(`${cores.cinza}   Tempo médio:      ${metricas.tempoMedioPorRequisicaoMs}ms${cores.reset}`);
  console.log(`${cores.cinza}   Tamanho cache:    ${metricas.tamanhoCache} items${cores.reset}\n`);

  // Resumo
  log('azul', '📊', '=== RESUMO ===\n');

  if (metricas.taxaSucessoPct > 50) {
    log('verde', '🎉', `Humanizador com boa taxa de sucesso (${metricas.taxaSucessoPct}%)!`);
    log('verde', '✅', 'Pronto para usar em produção.');
  } else if (metricas.taxaSucessoPct > 0) {
    log('amarelo', '💡', `Taxa de sucesso: ${metricas.taxaSucessoPct}%. Melhorando...`);
    log('amarelo', '💡', 'Algumas respostas usarão fallback (original).');
  } else {
    log('amarelo', '⚠️', 'Humanizador não está gerando respostas válidas.');
    log('amarelo', '💡', 'Verifique:');
    log('cinza', '   ', '1. Ollama está rodando? (ollama serve)');
    log('cinza', '   ', '2. Modelo está instalado? (ollama pull qwen1.5b-safe:latest)');
    log('cinza', '   ', '3. URL está correta? (URL_OLLAMA no .env)');
  }

  console.log('');
}

// Executar testes
testarHumanizador().catch(erro => {
  log('vermelho', '❌', `Erro geral: ${erro.message}`);
  process.exit(1);
});