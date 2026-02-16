/**
 * 🧪 TESTE DO DETECTOR DE INTENÇÃO
 * Classifica mensagens para ver se detecção está funcionando
 * 
 * Execução:
 *   node testar-detector.js
 */

const DetectorIntencao = require('../utils/detectIntention');

const cores = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  amarelo: '\x1b[33m',
  azul: '\x1b[34m',
  vermelho: '\x1b[31m',
  cinza: '\x1b[90m'
};

function log(cor, emoji, texto) {
  console.log(`${cores[cor]}${emoji} ${texto}${cores.reset}`);
}

function testar() {
  log('azul', '🧪', '=== TESTE DO DETECTOR DE INTENÇÃO ===\n');

  const detector = new DetectorIntencao();

  // Testes para cada categoria
  const testes = [
    // Saudações
    { msg: 'Olá!', esperado: 'SAUDACAO', emoji: '💬' },
    { msg: 'Oi, tudo bem?', esperado: 'SAUDACAO', emoji: '💬' },
    { msg: 'Bom dia!', esperado: 'SAUDACAO', emoji: '💬' },
    { msg: 'Como vai?', esperado: 'SAUDACAO', emoji: '💬' },
    { msg: 'Obrigado!', esperado: 'SAUDACAO', emoji: '💬' },

    // Suporte
    { msg: 'Como resetar senha?', esperado: 'SUPORTE', emoji: '🔧' },
    { msg: 'Problema com backup', esperado: 'SUPORTE', emoji: '🔧' },
    { msg: 'Qual é a versão do sistema?', esperado: 'SUPORTE', emoji: '🔧' },
    { msg: 'Como configurar permissões de usuário?', esperado: 'SUPORTE', emoji: '🔧' },
    { msg: 'Sistema travou, o que fazer?', esperado: 'SUPORTE', emoji: '🔧' },

    // Off-topic
    { msg: 'Qual é sua música favorita?', esperado: 'OFF_TOPIC', emoji: '❌' },
    { msg: 'Me conta uma piada!', esperado: 'OFF_TOPIC', emoji: '❌' },
    { msg: 'Qual seu nome?', esperado: 'OFF_TOPIC', emoji: '❌' },
    { msg: 'Que time você torce?', esperado: 'OFF_TOPIC', emoji: '❌' },
    { msg: 'Como jogar Pokémon?', esperado: 'OFF_TOPIC', emoji: '❌' },

    // Vago
    { msg: 'ok', esperado: 'VAGO', emoji: '❓' },
    { msg: 'sim', esperado: 'VAGO', emoji: '❓' },
    { msg: 'haha', esperado: 'VAGO', emoji: '❓' },
    { msg: 'kkk', esperado: 'VAGO', emoji: '❓' },

    // Comando
    { msg: '!ajuda', esperado: 'COMANDO', emoji: '⚙️' },
    { msg: '!salvar | teste | solução | palavras | tags', esperado: 'COMANDO', emoji: '⚙️' },
    { msg: '!listar', esperado: 'COMANDO', emoji: '⚙️' },
    { msg: '!debug qual é o erro?', esperado: 'COMANDO', emoji: '⚙️' },
  ];

  let acertos = 0;
  const resultados = {};

  console.log(`${cores.cinza}Testando ${testes.length} mensagens...${cores.reset}\n`);

  testes.forEach((teste, idx) => {
    const classificacao = detector.classificar(teste.msg);
    const ok = classificacao.tipo === teste.esperado;

    if (ok) {
      acertos++;
      log('verde', '✅', `[${idx + 1}/${testes.length}] ${teste.emoji} ${teste.msg}`);
    } else {
      log('vermelho', '❌', `[${idx + 1}/${testes.length}] ${teste.msg}`);
      log('cinza', '   ', `Esperado: ${teste.esperado} | Recebido: ${classificacao.tipo} (${(classificacao.confianca * 100).toFixed(0)}%)`);
    }

    // Contar resultados por tipo
    if (!resultados[classificacao.tipo]) {
      resultados[classificacao.tipo] = 0;
    }
    resultados[classificacao.tipo]++;
  });

  // Resumo
  console.log('');
  log('azul', '📊', '=== RESUMO ===\n');
  log('verde', '✅', `Acertos: ${acertos}/${testes.length} (${((acertos / testes.length) * 100).toFixed(0)}%)`);

  console.log('\n📈 Distribuição de classificações:');
  Object.entries(resultados).forEach(([tipo, count]) => {
    const descricao = detector.obterDescricao(tipo);
    log('cinza', '•', `${descricao}: ${count}`);
  });

  // Conclusão
  console.log('');
  if (acertos >= testes.length * 0.8) {
    log('verde', '🎉', 'Detector está funcionando bem!');
  } else if (acertos >= testes.length * 0.6) {
    log('amarelo', '💡', 'Detector funcionando, mas pode melhorar.');
    log('amarelo', '💡', 'Ajuste palavras-chave conforme necessário.');
  } else {
    log('vermelho', '⚠️', 'Detector precisa de ajustes significativos.');
  }

  console.log('');
}

testar();
