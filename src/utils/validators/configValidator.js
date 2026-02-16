/**
 * ⚙️ CONFIGURAÇÕES DO VALIDADOR DE CONTEXTO
 * Ajuste estes parâmetros para tunar o comportamento do bot
 * 
 * 💡 TIP: Valores para scoreConfig podem ser sobrescritos via variáveis de ambiente
 * Exemplos: THRESHOLD_MINIMO, THRESHOLD_RELACIONADAS, etc (veja .env)
 */

require('dotenv').config();

module.exports = {
  // 🎯 SCORE LIMITES
  scoreConfig: {
    // Score mínimo de relevância para considerar uma pergunta válida
    minRelevanciaParaValida: parseFloat(process.env.THRESHOLD_MINIMO) || 0.25,

    // Score máximo de off-topic para não rejeitar automaticamente
    maxOffTopicParaAceitar: parseFloat(process.env.THRESHOLD_OFFTOPIC_MAX) || 0.5,

    // Score mínimo de coerência para aceitar
    minCoerenciaParaValida: parseFloat(process.env.THRESHOLD_COERENCIA_MIN) || 0.2,

    // Score mínimo geral para considerar mensagem válida (sem contexto positivo)
    minScoreGeralParaValida: parseFloat(process.env.THRESHOLD_SCORE_GERAL_MIN) || 0.35,

    // Comprimento mínimo de mensagem (caracteres)
    minComprimento: 3,

    // Comprimento máximo de mensagem (caracteres)
    maxComprimento: 2000,

    // Comprimento mínimo para pergunta válida (sem palavras-chave)
    minComprimentoParaPergunta: 10
  },

  // 📚 PALAVRAS-CHAVE DO SISTEMA
  palavrasChaveInovar: [
    // Termos gerais
    'inovar', 'sistema', 'software', 'programa', 'aplicativo',

    // Operações
    'relatório', 'backup', 'exportar', 'importar', 'sincronizar',
    'atualizar', 'instalar', 'desinstalar', 'reiniciar', 'reset',
    'reboot', 'conectar', 'desconectar',

    // Segurança
    'usuário', 'senha', 'login', 'acesso', 'permissão', 'privilégio',
    'autenticação', 'autorização', 'token', 'sessão',

    // Dados
    'banco', 'dados', 'tabela', 'campo', 'registro', 'query',
    'sql', 'database', 'armazenar', 'salvar',

    // Sistema
    'módulo', 'função', 'atalho', 'menu', 'tela', 'interface',
    'configurar', 'configuração', 'opção', 'comando',

    // Problemas
    'erro', 'falha', 'problema', 'bug', 'crash', 'travado',
    'congelado', 'lento', 'não funciona', 'não tá',
    'quebrado', 'inconsistência',

    // Dúvida
    'como', 'qual', 'onde', 'quando', 'por que', 'porquê',
    'o que', 'dúvida', 'help', 'ajuda', 'suporte'
  ],

  // 🚫 TERMOS OFF-TOPIC
  termosOffTopic: [
    // Esportes
    'futebol', 'time', 'jogo', 'gol', 'league', 'nba',
    'flamengo', 'são paulo', 'corinthians', 'palmeiras',

    // Política
    'política', 'governo', 'presidente', 'eleição', 'voto',
    'direita', 'esquerda', 'bolsonaro', 'lula', 'partido',

    // Finanças
    'bolsa', 'ações', 'cripto', 'bitcoin', 'ethereum',
    'investimento', 'forex', 'trader', 'daytrader',

    // Relacionamentos
    'namoro', 'namorada', 'namorado', 'casamento', 'casar',
    'amor', 'paquera', 'romance', 'beijo',

    // Saúde/Álcool/Drogas
    'droga', 'cocaína', 'maconha', 'álcool', 'cerveja',
    'vinho', 'bebida', 'saúde', 'médico', 'doença',

    // Memes/Piadas
    'piada', 'humor', 'meme', 'risada', 'kkk', 'haha',
    'brincadeira', 'trollagem', 'troll',

    // Games
    'gamer', 'game', 'jogo', 'console', 'minecraft',
    'fortnite', 'ataque dos titãs', 'anime',

    // Outros
    'música', 'banda', 'filme', 'série', 'ator',
    'carro', 'moto', 'viagem', 'praia', 'festa'
  ],

  // 📊 PESOS ALGORÍTMICOS
  pesos: {
    // Pesos de relevância ao sistema (score final)
    relevancia: 0.4,
    estrutura: 0.3,
    coerencia: 0.3,

    // Penalizações de coerência
    erroDigitacao: -0.3,      // Erros de digitação excessivos
    maiusculas: -0.2,         // Mensagem em CAPS
    repeticao: -0.25,         // Repetição de caracteres (spam)
    poesia: -0.4              // Poesia/Rimas detectadas
  },

  // 🎨 PADRÕES DE DETECÇÃO
  padroes: {
    // Padrões que indicam mensagem inválida/spam
    invalidos: [
      /^[.!?~\-_*#+&@]+$/,              // Apenas símbolos
      /^(oi|olá|opa|e aí|tudo bem)$/i,  // Apenas saudações
      /^(ok|sim|nao|não|claro|certo)$/i, // Respostas curtas
      /^\d{1,3}(\.\d{1,3})?$/,           // Apenas números
    ],

    // Padrões que indicam pergunta
    pergunta: /\b(como|qual|onde|quando|porquê|por que|o que)\b/i,

    // Padrões que indicam problema/erro
    problema: /\b(erro|falha|não funciona|não tá|quebrado|crash|travou|problema)\b/i,

    // Padrões que indicam pedido/dúvida
    pedido: /\b(como|qual|onde|quando|me ajuda|me help|pode|dúvida|suporte)\b/i
  },

  // 🔍 ANÁLISE DE ESTRUTURA
  estrutura: {
    // Score para cada tipo de estrutura detectada
    scores: {
      PROBLEMA: 0.85,
      PEDIDO: 0.8,
      PERGUNTA: 0.75,
      INDEFINIDO: 0.3
    },

    // Threshold para considerar poesia (% de rimas)
    thresholdPoesia: 0.3
  },

  // 📝 MENSAGENS CUSTOMIZADAS
  mensagensCustomizadas: {
    // IMPORTANTE: Adicione aqui respostas customizadas para casos específicos
    // Formato: { condicao: function, resposta: string }

    // Exemplo - descomente para usar:
    /*
    {
      condicao: (msg) => /resetar senha/i.test(msg),
      resposta: 'Para resetar sua senha, acesse Menu > Configurações > Segurança > Resetar Senha'
    }
    */
  },

  // 🔧 DEBUG
  debug: {
    // Se true, exibe logs detalhados de análise
    habilitado: false,

    // Se true, exibe scores de cada componente
    exibirScores: false,

    // Se true, exibe termos detectados
    exibirTermos: false
  },

  // 🌍 LOCALIZACAO
  idioma: 'pt-BR',

  timezone: 'America/Sao_Paulo'
};
