/**
 * 🔍 VALIDADOR DE CONTEXTO
 * Analisa se a mensagem é relevante dentro do contexto do sistema Inovar
 * 
 * Versão: 1.0
 * Padrão: camelCase
 */

class messageAnalyzer {
  constructor() {
    // Palavras-chave do sistema Inovar
    this.palavrasChaveInovar = [
      'inovar', 'sistema', 'software', 'relatório', 'usuário', 'senha',
      'login', 'backup', 'exportar', 'importar', 'sincronizar', 'acesso',
      'permissão', 'módulo', 'campo', 'menu', 'atalho', 'função',
      'erro', 'falha', 'problema', 'dúvida', 'como', 'onde', 'quando',
      'banco', 'dados', 'tabela', 'configurar', 'instalar', 'atualizar'
    ];

    // Padrões de perguntas inválidas/vazias
    this.padroesPerguntasInvalidas = [
      /^[.!?~\-_*#+&@]+$/,  // Apenas símbolos
      /^(oi|olá|opa|e aí|tudo bem|oi bot)$/i,  // Apenas saudações
      /^(ok|sim|nao|não|claro|certo)$/i,  // Respostas curtas
      /^\d{1,3}(\.\d{1,3})?$/,  // Apenas números
    ];

    // Termos que indicam conversas off-topic
    this.termosOffTopic = [
      'piada', 'meme', 'gado', 'incel', 'política', 'futebol',
      'bolsa', 'ações', 'cripto', 'namoro', 'casamento', 'sexo',
      'droga', 'bebida', 'jogo', 'aposta', 'cassino'
    ];

    console.log('🔍 Validador de Contexto inicializado');
  }

  /**
   * Validar mensagem em profundidade
   * Retorna: { valido, score, motivo, categorias }
   */
  validar(mensagem) {
    const msg = mensagem.trim().toLowerCase();

    // 1. Validação básica
    const validacaoBasica = this._validarBasica(msg);
    if (!validacaoBasica.valido) {
      // Sempre retornar estrutura completa mesmo quando falha
      return {
        valido: false,
        score: validacaoBasica.score || 0,
        scoreRelevancia: 0,
        scoreOffTopic: 0,
        scoreEstrutura: 0,
        scoreCoerencia: 0,
        motivo: validacaoBasica.motivo || 'Validação básica falhou',
        categorias: {
          estrutura: 'INDEFINIDO',
          temPoesiasOuRimas: false,
          offtopic: false,
          relevancia: 'BAIXA'
        }
      };
    }

    // 2. Análise de relevância ao contexto
    const scoreRelevancia = this._calcularRelevancia(msg);

    // 3. Detecção de off-topic
    const scoreOffTopic = this._calcularOffTopic(msg);

    // 4. Análise de estrutura (parece uma dúvida legítima?)
    const estrutura = this._analisarEstrutura(msg);

    // 5. Análise de coerência
    const coerencia = this._verificarCoerencia(msg);

    // Calcular score final
    const scoreGeral = (scoreRelevancia * 0.4 + estrutura.score * 0.3 + coerencia.score * 0.3);

    return {
      valido: scoreGeral > 0.35 && scoreOffTopic < 0.5,
      score: scoreGeral,
      scoreRelevancia,
      scoreOffTopic,
      scoreEstrutura: estrutura.score,
      scoreCoerencia: coerencia.score,
      motivo: this._obterMotivo(scoreGeral, scoreOffTopic, estrutura, coerencia),
      categorias: {
        estrutura: estrutura.tipo,
        temPoesiasOuRimas: estrutura.temPoesiasOuRimas,
        offtopic: scoreOffTopic > 0.5,
        relevancia: scoreRelevancia > 0.5 ? 'ALTA' : scoreRelevancia > 0.25 ? 'MÉDIA' : 'BAIXA'
      }
    };
  }

  /**
   * Validação básica - rejeita óbvias
   */
  _validarBasica(msg) {
    // Muito curta
    if (msg.length < 3) {
      return { valido: false, score: 0, motivo: 'Mensagem muito curta' };
    }

    // Padrões inválidos
    if (this.padroesPerguntasInvalidas.some(p => p.test(msg))) {
      return { valido: false, score: 0, motivo: 'Formato de mensagem inválido' };
    }

    // Muito longa (pode ser spam)
    if (msg.length > 2000) {
      return { valido: false, score: 0.2, motivo: 'Mensagem muito longa (possível spam)' };
    }

    return { valido: true, score: 1.0 };
  }

  /**
   * Calcular relevância ao sistema Inovar (0-1)
   */
  _calcularRelevancia(msg) {
    let matches = 0;
    const palavras = msg.split(/\s+/);

    this.palavrasChaveInovar.forEach(palavra => {
      if (new RegExp(`\\b${palavra}\\b`, 'i').test(msg)) {
        matches++;
      }
    });

    if (matches === 0) {
      // Sem palavras-chave, mas será mais criiteria
      // Se tem estrutura de pergunta (como, qual, onde, quando, por que)
      const temPergunta = /\b(como|qual|onde|quando|porquê|por que|como|o quê)\b/i.test(msg);
      return temPergunta ? 0.3 : 0.1;
    }

    // Score baseado em densidade de palavras-chave
    const densidade = matches / Math.max(palavras.length / 3, 1);
    return Math.min(densidade, 1.0);
  }

  /**
   * Calcular score off-topic (0-1)
   */
  _calcularOffTopic(msg) {
    let matches = 0;
    const palavras = msg.split(/\s+/);

    this.termosOffTopic.forEach(termo => {
      if (new RegExp(`\\b${termo}\\b`, 'i').test(msg)) {
        matches++;
      }
    });

    if (matches === 0) return 0;
    return Math.min(matches / Math.max(palavras.length / 2, 1), 1.0);
  }

  /**
   * Analisar estrutura da mensagem
   */
  _analisarEstrutura(msg) {
    // Parece uma pergunta?
    const temInterrogacao = msg.includes('?') || /\b(como|qual|onde|quando|porquê|o que)\b/i.test(msg);

    // Parece um problema/bug report?
    const temProblema = /\b(erro|falha|não funciona|não tá|quebrado|crash|travou|problema)\b/i.test(msg);

    // Parece um pedido/dúvida?
    const temPedido = /\b(como|qual|onde|quando|me ajuda|me help|pode|dúvida)\b/i.test(msg);

    // Tem poesia/rima (spam)?
    const temPoesiasOuRimas = this._verificarPoesia(msg);

    let tipo = 'INDEFINIDO';
    let score = 0.3;

    if (temProblema) {
      tipo = 'PROBLEMA';
      score = 0.85;
    } else if (temPedido) {
      tipo = 'PEDIDO';
      score = 0.8;
    } else if (temInterrogacao) {
      tipo = 'PERGUNTA';
      score = 0.75;
    }

    return {
      tipo,
      score,
      temInterrogacao,
      temProblema,
      temPedido,
      temPoesiasOuRimas
    };
  }

  /**
   * Verificar coerência da mensagem
   */
  _verificarCoerencia(msg) {
    let score = 0.7;
    const motivos = [];

    // Verificar se tem muitos erros de digitação
    const palavras = msg.split(/\s+/);
    let errosPravaveis = 0;

    palavras.forEach(palavra => {
      // Palavras muito estranhas (mais de 3 consonantes seguidas, números aleatórios)
      if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(palavra)) {
        errosPravaveis++;
      }
    });

    if (errosPravaveis > palavras.length * 0.2) {
      score -= 0.3;
      motivos.push('Muitos erros de digitação');
    }

    // Verificar se tem muitas LETRAS MAIÚSCULAS (irritação/spam)
    const taxaMaiusculas = (msg.match(/[A-Z]/g) || []).length / msg.length;
    if (taxaMaiusculas > 0.5) {
      score -= 0.2;
      motivos.push('Mensagem em CAPS');
    }

    // Verificar repetição excessiva
    const temRepeticao = msg.match(/(.)\1{4,}/);
    if (temRepeticao) {
      score -= 0.25;
      motivos.push('Repetição excessiva de caracteres');
    }

    return {
      score: Math.max(score, 0.2),
      motivos,
      errosDetectados: errosPravaveis,
      maiusculasPercentual: (taxaMaiusculas * 100).toFixed(0)
    };
  }

  /**
   * Verificar se é poesia/rima (spam)
   */
  _verificarPoesia(msg) {
    const linhas = msg.split(/\n/).filter(l => l.trim());

    if (linhas.length < 2) return false;

    // Verificar se termina com rimas (últimas sílabas)
    let rimasEncontradas = 0;

    for (let i = 0; i < linhas.length - 1; i++) {
      const fim1 = this._extrairRima(linhas[i]);
      const fim2 = this._extrairRima(linhas[i + 1]);

      if (fim1 && fim2 && this._saoParecidas(fim1, fim2)) {
        rimasEncontradas++;
      }
    }

    return rimasEncontradas > linhas.length * 0.3;
  }

  /**
   * Extrair possível rima de uma linha
   */
  _extrairRima(linha) {
    const palavras = linha.trim().toLowerCase().split(/\s+/);
    if (palavras.length === 0) return null;
    return palavras[palavras.length - 1].slice(-3); // Últimas 3 caracteres
  }

  /**
   * Verificar se duas palavras são parecidas (para rimas)
   */
  _saoParecidas(palavra1, palavra2) {
    if (!palavra1 || !palavra2) return false;
    return palavra1.slice(-2) === palavra2.slice(-2);
  }

  /**
   * Obter motivo legível
   */
  _obterMotivo(score, scoreOffTopic, estrutura, coerencia) {
    if (scoreOffTopic > 0.6) {
      return 'Mensagem não relacionada ao suporte';
    }

    if (estrutura.temPoesiasOuRimas) {
      return 'Parece ser poesia ou spam com rimas';
    }

    if (coerencia.motivos.length > 0) {
      return `Problema de coerência: ${coerencia.motivos.join(', ')}`;
    }

    if (score < 0.35) {
      return 'Contexto muito vago ou não relacionado ao sistema';
    }

    return 'Mensagem válida';
  }

  /**
   * Obter análise detalhada para debug
   */
  obterAnaliseDetalhada(mensagem) {
    return this.validar(mensagem);
  }

  /**
   * Sugerir ação recomendada
   */
  sugerirAcao(validacao) {
    // Verificações de segurança - garantir que as propriedades existem
    const offtopic = validacao?.categorias?.offtopic || false;
    const estrutura = validacao?.categorias?.estrutura || 'INDEFINIDO';
    const scoreRelevancia = validacao?.scoreRelevancia || 0;
    const scoreCoerencia = validacao?.scoreCoerencia || 0;

    if (!validacao?.valido) {
      if (offtopic) {
        return 'REJEITAR_OFF_TOPIC';
      }
      if (scoreRelevancia < 0.2) {
        return 'PEDIR_CLARIFICACAO';
      }
      if (estrutura === 'INDEFINIDO') {
        return 'PEDIR_DETALHES';
      }
    }

    if (scoreRelevancia > 0.7 && scoreCoerencia > 0.7) {
      return 'BUSCAR_SOLUCAO';
    }

    if (scoreRelevancia > 0.3) {
      return 'BUSCAR_SOLUCAO_COM_CAUTION';
    }

    return 'PEDIR_CLARIFICACAO';
  }
}

module.exports = messageAnalyzer;
