/**
 * 💬 GERADOR DE RESPOSTA COLOQUIAL
 * Usa Ollama para responder mensagens não-suporte de forma natural
 * 
 * Padrão: camelCase, integrado com sistema existente
 */

const fetch = require('node-fetch');

class welcomeMessage {
  constructor() {
    this.urlOllama = process.env.URL_OLLAMA || 'http://127.0.0.1:11435';
    this.modelo = process.env.MODELO_OLLAMA || 'qwen1.5b-safe:latest';
    this.respostasPadrao = this._inicializarRespostasCache();

    console.log(`💬 Gerador de Resposta Coloquial inicializado`);
    console.log(`   URL: ${this.urlOllama} | Modelo: ${this.modelo}`);
  }

  /**
   * Respostas padrão por categoria (rápidas, sem chamar Ollama)
   */
  _inicializarRespostasCache() {
    return {
      SAUDACAO: [
        'Olá! 👋 Bem-vindo ao suporte da Inovar Sistemas. Como posso ajudar com seu sistema?',
        'Oi! 😊 Estou aqui para ajudar com dúvidas sobre o sistema. O que você precisa?',
        'E aí! 🤖 Pronto para resolver suas dúvidas de suporte. Em que posso ajudar?',
        'Bem-vindo! 🎯 Qual é sua dúvida sobre o sistema?'
      ],
      OFF_TOPIC: [
        'Entendo! 😄 Mas sou focado em suporte técnico da Inovar Sistemas. Temos alguma dúvida sobre o sistema?',
        'Boa pergunta! 🤔 Mas meu foco é ajudar com o sistema Inovar. Posso ajudar com algo técnico?',
        'Que legal! 😊 Mas meu expertise é em suporte técnico. Tem alguma dúvida sobre o sistema?',
        'Interessante! 💭 Mas meu foco é suporte. Posso ajudar com algo técnico?'
      ],
      VAGO: [
        'Hmm, entendi... 🤔 Pode ser mais específico? Qual é a sua dúvida exatamente?',
        'Entendi! 😊 Mas preciso de mais detalhes para te ajudar. Qual é o problema?',
        'Beleza! 👍 Pode me detalhar melhor? O que você gostaria de saber?',
        'Claro! 💡 Mas preciso saber mais. Qual é sua dúvida específica?'
      ],
      INDEFINIDO: [
        'Hmm, não tenho certeza... 🤔 Pode clarificar sua pergunta?',
        'Entendi! 😊 Pode detalhar mais para eu ajudar melhor?'
      ]
    };
  }

  /**
   * Gerar resposta (tenta padrão primeiro, depois Ollama se necessário)
   */
  async gerarResposta(mensagem, tipo) {
    // Tentar resposta padrão primeiro (muito mais rápida)
    const respostaPadrao = this._obterRespostaPadrao(tipo);
    if (respostaPadrao) {
      return {
        resposta: respostaPadrao,
        fonte: 'PADRAO',
        latencia: 0
      };
    }

    // Se não houver padrão, tentar Ollama
    return await this._gerarComOllama(mensagem, tipo);
  }

  /**
   * Obter resposta padrão (aleatória para não parecer robótico)
   */
  _obterRespostaPadrao(tipo) {
    const respostas = this.respostasPadrao[tipo];

    if (!respostas || respostas.length === 0) {
      return null;
    }

    // Retorna aleatória
    return respostas[Math.floor(Math.random() * respostas.length)];
  }

  /**
   * Gerar resposta com Ollama (para casos especiais)
   */
  async _gerarComOllama(mensagem, tipo) {
    const tempoInicio = Date.now();

    try {
      const prompt = this._construirPrompt(mensagem, tipo);

      const resposta = await fetch(`${this.urlOllama}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelo,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.95,
            num_predict: 200
          }
        })
      });

      if (!resposta.ok) {
        throw new Error(`HTTP ${resposta.status}`);
      }

      const data = await resposta.json();
      const latencia = Date.now() - tempoInicio;

      return {
        resposta: data.response.trim(),
        fonte: 'OLLAMA',
        latencia: latencia
      };

    } catch (erro) {
      console.error(`❌ Erro ao gerar resposta: ${erro.message}`);
      // Fallback seguro
      return {
        resposta: 'Opa, teve um erro aqui. 🤖 Pode tentar de novo?',
        fonte: 'FALLBACK',
        latencia: 0
      };
    }
  }

  /**
   * Construir prompt adaptado ao tipo
   */
  _construirPrompt(mensagem, tipo) {
    const prompts = {
      SAUDACAO: `Você é um assistente de suporte técnico amigável da Inovar Sistemas.
Alguém cumprimentou você: "${mensagem}"

Responda com cumprimento caloroso oferecendo ajuda. Curto (1-2 linhas), natural e coloquial.`,

      OFF_TOPIC: `Você é assistente de suporte técnico da Inovar Sistemas.
Pergunta fora do escopo: "${mensagem}"

Rejeite gentilmente mantendo tom amigável. Ofereça ajuda técnica. Curto (1-2 linhas).`,

      VAGO: `Você é assistente de suporte técnico da Inovar Sistemas.
Mensagem vaga: "${mensagem}"

Peça para ser mais específico sobre a dúvida. Tom amigável. Curto (1-2 linhas).`,

      INDEFINIDO: `Você é assistente de suporte técnico da Inovar Sistemas.
Mensagem: "${mensagem}"

Não ficou claro. Peça para esclarecer. Tom amigável, curto.`
    };

    return prompts[tipo] || prompts.INDEFINIDO;
  }

  /**
   * Testar conexão com Ollama
   */
  async testarConexao() {
    try {
      const resposta = await fetch(`${this.urlOllama}/api/tags`, { timeout: 5000 });
      return resposta.ok;
    } catch {
      return false;
    }
  }
}

module.exports = welcomeMessage;