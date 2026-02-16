/**
 * 🧭 DETECTOR DE INTENÇÃO
 * Classifica mensagens em categorias e coordena respostas apropriadas
 * 
 * Versão: 3.0 (com validação de contexto semântico)
 * Padrão: camelCase, integrado ao fluxo existente
 */

const responseGenerator = require('../generators/responseGenerator');
const messageAnalyzer = require('./messageAnalyzer');

class DetectIntention {
  constructor() {
    this.generador = new responseGenerator();
    this.validadorContexto = new messageAnalyzer();

    // Padrões de saudação
    this.padroesSaudacao = [
      /^(olá|oi|opa|e aí|e ai|tudo bem|como vai|bom dia|boa tarde|boa noite|hey|hi|hello)/i,
      /^(bem.?vindo|welcome|blz|valeu|thanks|obrigad)/i,
      /^(tudo|cê tá|você está|que tal)/i
    ];

    // Palavras-chave de suporte
    this.palavrasChaveSuporte = [
      'como', 'qual', 'onde', 'quando', 'por que', 'porquê', 'sistema',
      'problema', 'erro', 'bug', 'não funciona', 'não tá', 'falha',
      'quebrado', 'crash', 'travou', 'congelou', 'usuário', 'senha',
      'login', 'acesso', 'permissão', 'relatório', 'backup', 'export',
      'import', 'download', 'upload', 'configurar', 'instalar',
      'desinstalar', 'atualizar', 'version', 'versão', 'reset',
      'reiniciar', 'reboot', 'sincronizar', 'conectar', 'desconectar',
      'servidor', 'banco', 'dados', 'tabela', 'campo', 'inovar',
      'suporte', 'help', 'ajuda'
    ];

    // Palavras-chave off-topic
    this.palavrasOffTopic = [
      'piada', 'humor', 'meme', 'qual seu nome', 'quem é você',
      'age', 'idade', 'namorada', 'namoro', 'amor', 'política',
      'futebol', 'time', 'jogo', 'filme', 'série', 'música', 'banda',
      'comida', 'receita', 'pizza', 'cerveja', 'vinho', 'viagem',
      'carro', 'moto', 'computador pessoal', 'gamer', 'game',
      'anime', 'manga', 'bolsa', 'ações', 'cripto'
    ];

    console.log('🧭 Detector de Intenção v2.0 inicializado');
  }

  /**
   * Classificar mensagem com validação de contexto e gerar resposta
   */
  async classificarComResposta(mensagem) {
    // Primeira: Validar contexto
    const validacao = this.validadorContexto.validar(mensagem);
    const acao = this.validadorContexto.sugerirAcao(validacao);

    const classificacao = this.classificar(mensagem);

    // Combinar análise de intenção com validação de contexto
    const analiseCompleta = {
      ...classificacao,
      validacaoContexto: validacao,
      acaoRecomendada: acao,
      confianca: Math.min(classificacao.confianca * validacao.score, 1.0)
    };

    // Se for resposta coloquial, gera também a resposta
    if (['SAUDACAO', 'OFF_TOPIC', 'VAGO', 'INDEFINIDO'].includes(analiseCompleta.tipo)) {
      const resposta = await this.generador.gerarResposta(mensagem, analiseCompleta.tipo, validacao);

      return {
        ...analiseCompleta,
        resposta: resposta.resposta,
        fonteFesposta: resposta.fonte,
        latencia: resposta.latencia
      };
    }

    return analiseCompleta;
  }

  /**
   * Classificar a mensagem em uma das 6 categorias (V3 - mais inteligente)
   */
  classificar(mensagem) {
    const msg = mensagem.trim().toLowerCase();
    const validacao = this.validadorContexto.validar(msg);

    // 1. COMANDO
    if (msg.startsWith('!')) {
      return {
        tipo: 'COMANDO',
        confianca: 1.0,
        descricao: 'Comando do bot'
      };
    }

    // 2. SAUDAÇÃO
    if (this._ehSaudacao(msg)) {
      return {
        tipo: 'SAUDACAO',
        confianca: 0.95,
        descricao: 'Saudação ou cumprimento'
      };
    }

    // 3. OFF_TOPIC (baseado em validação)
    const offtopic = validacao?.categorias?.offtopic || false;
    if (offtopic) {
      return {
        tipo: 'OFF_TOPIC',
        confianca: Math.min(validacao.scoreOffTopic || 0, 1.0),
        descricao: 'Não relacionada a suporte',
        motivo: validacao.motivo
      };
    }

    // 4. VAGO (mensagem muito curta ou sem contexto)
    const scoreRelevancia = validacao?.scoreRelevancia || 0;
    if (this._ehMuitoCurta(msg) || scoreRelevancia < 0.2) {
      return {
        tipo: 'VAGO',
        confianca: 0.7,
        descricao: 'Mensagem vaga ou muito curta'
      };
    }

    // 5. SUPORTE (tem palavras-chave e contexto válido)
    const scoreSuporte = this._calcularScoreSuporte(msg);
    if (scoreSuporte > 0.3 || scoreRelevancia > 0.5) {
      return {
        tipo: 'SUPORTE',
        confianca: Math.min(scoreSuporte * 0.7 + scoreRelevancia * 0.3, 1.0),
        descricao: 'Pergunta sobre o sistema'
      };
    }

    // 6. INDEFINIDO
    return {
      tipo: 'INDEFINIDO',
      confianca: validacao?.score || 0,
      descricao: 'Não classificado com certeza'
    };
  }

  /**
   * Verificar se é saudação
   */
  _ehSaudacao(msg) {
    return this.padroesSaudacao.some(padrao => padrao.test(msg));
  }

  /**
   * Verificar se é muito curta
   */
  _ehMuitoCurta(msg) {
    const padroesCurtos = [
      /^(ok|sim|não|nao|blz|claro|pode|certo|entendi|msg)$/i,
      /^(haha|kkkk|rsrs|kkk|hehe|ué|uai|sei|ah|oi)$/i
    ];

    if (padroesCurtos.some(p => p.test(msg))) return true;
    if (msg.length < 5) return true;
    if (/^[0-9!@#$%^&*()]+$/.test(msg)) return true;

    return false;
  }

  /**
   * Score de off-topic (0-1)
   */
  _calcularScoreOffTopic(msg) {
    let matches = 0;
    const totalPalavras = msg.split(/\s+/).length;

    this.palavrasOffTopic.forEach(palavra => {
      if (new RegExp(`\\b${palavra}\\b`, 'i').test(msg)) {
        matches++;
      }
    });

    return Math.min(matches / Math.max(totalPalavras / 2, 1), 1);
  }

  /**
   * Score de suporte (0-1)
   */
  _calcularScoreSuporte(msg) {
    let matches = 0;
    const totalPalavras = msg.split(/\s+/).length;

    this.palavrasChaveSuporte.forEach(palavra => {
      if (new RegExp(`\\b${palavra}\\b`, 'i').test(msg)) {
        matches++;
      }
    });

    return Math.min(matches / Math.max(totalPalavras / 2, 1), 1);
  }

  /**
   * Obter emoji e descrição por tipo
   */
  obterInfo(tipo) {
    const info = {
      SAUDACAO: { emoji: '💬', desc: 'Saudação' },
      SUPORTE: { emoji: '🔧', desc: 'Suporte' },
      OFF_TOPIC: { emoji: '❌', desc: 'Off-Topic' },
      COMANDO: { emoji: '⚙️', desc: 'Comando' },
      VAGO: { emoji: '❓', desc: 'Vago' },
      INDEFINIDO: { emoji: '🤔', desc: 'Indefinido' }
    };

    return info[tipo] || { emoji: '❓', desc: 'Desconhecido' };
  }

  /**
   * Obter validação de contexto para uma mensagem
   */
  obterValidacaoContexto(mensagem) {
    return this.validadorContexto.validar(mensagem);
  }

  /**
   * Obter análise completa (para debug)
   */
  async obterAnaliseCompleta(mensagem) {
    const resposta = await this.classificarComResposta(mensagem);
    const validacao = this.validadorContexto.obterAnaliseDetalhada(mensagem);

    return {
      mensagem,
      classificacao: resposta,
      validacao: validacao,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = DetectIntention;