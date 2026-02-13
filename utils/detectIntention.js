/**
 * 🧭 DETECTOR DE INTENÇÃO
 * Classifica mensagens em categorias e coordena respostas apropriadas
 * 
 * Versão: 2.0 (com suporte a respostas coloquiais)
 * Padrão: camelCase, integrado ao fluxo existente
 */

const welcomeMessage = require('./welcomeMessage');

class DetectIntention {
  constructor() {
    this.generador = new welcomeMessage();

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
   * Classificar mensagem e retornar tipo + resposta (se aplicável)
   */
  async classificarComResposta(mensagem) {
    const classificacao = this.classificar(mensagem);

    // Se for resposta coloquial, gera também a resposta
    if (['SAUDACAO', 'OFF_TOPIC', 'VAGO', 'INDEFINIDO'].includes(classificacao.tipo)) {
      const resposta = await this.generador.gerarResposta(mensagem, classificacao.tipo);

      return {
        ...classificacao,
        resposta: resposta.resposta,
        fonteFesposta: resposta.fonte,
        latencia: resposta.latencia
      };
    }

    return classificacao;
  }

  /**
   * Classificar a mensagem em uma das 6 categorias
   */
  classificar(mensagem) {
    const msg = mensagem.trim().toLowerCase();

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

    // 3. VAGO
    if (this._ehMuitoCurta(msg)) {
      return {
        tipo: 'VAGO',
        confianca: 0.8,
        descricao: 'Mensagem vaga ou muito curta'
      };
    }

    // 4. OFF_TOPIC
    const scoreOffTopic = this._calcularScoreOffTopic(msg);
    if (scoreOffTopic > 0.6) {
      return {
        tipo: 'OFF_TOPIC',
        confianca: scoreOffTopic,
        descricao: 'Não relacionada a suporte'
      };
    }

    // 5. SUPORTE
    const scoreSuporte = this._calcularScoreSuporte(msg);
    if (scoreSuporte > 0.4) {
      return {
        tipo: 'SUPORTE',
        confianca: scoreSuporte,
        descricao: 'Pergunta sobre o sistema'
      };
    }

    // 6. INDEFINIDO
    return {
      tipo: 'INDEFINIDO',
      confianca: 0.5,
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
}

module.exports = DetectIntention;