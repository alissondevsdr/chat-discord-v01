/**
 * 💬 GERADOR DE RESPOSTA COLOQUIAL (AI-ONLY)
 * Usa exclusivamente Ollama para responder mensagens naturais
 * 
 * Padrão: camelCase, integrado com sistema existente
 */

const fetch = require('node-fetch');
const config = require('../../../core/config');

class responseGenerator {
  constructor() {
    this.urlOllama = config.OLLAMA_URL;
    this.modelo = config.OLLAMA_MODEL;
  }

  /**
   * Gerar resposta via IA (Ollama)
   */
  async gerarResposta(mensagem, tipo) {
    const tempoInicio = Date.now();

    try {
      const prompt = this._construirPrompt(mensagem, tipo);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!resposta.ok) {
        throw new Error(`Ollama indisponível (Status: ${resposta.status})`);
      }

      const data = await resposta.json();
      const latencia = Date.now() - tempoInicio;

      return {
        resposta: data.response.trim(),
        fonte: 'OLLAMA',
        latencia: latencia
      };

    } catch (erro) {
      console.error(`❌ Erro crítico ao gerar resposta coloquial: ${erro.message}`);
      // Lógica de "não funciona": o bot para aqui ou retorna um erro fatal
      throw new Error(`Sistema de IA indisponível para gerar resposta do tipo ${tipo}.`);
    }
  }

  /**
   * Construir prompt adaptado ao tipo
   */
  _construirPrompt(mensagem, tipo) {
    const prompts = {
      SAUDACAO: `Você é um assistente de suporte técnico amigável da Inovar Sistemas.
Alguém cumprimentou você: "${mensagem}"

Responda com cumprimento caloroso oferecendo ajuda técnica sobre o sistema Inovar. Seja curto (1-2 linhas), natural e coloquial.`,

      OFF_TOPIC: `Você é assistente de suporte técnico da Inovar Sistemas.
O usuário enviou uma mensagem fora do escopo do sistema Inovar: "${mensagem}"

Rejeite gentilmente e explique que você é um especialista técnico focado no sistema ERP Inovar. Não responda a pergunta do usuário se ela for sobre outro assunto. Sugira que ele faça perguntas sobre o sistema. Seja curto (1-2 linhas).`,

      VAGO: `Você é assistente de suporte técnico da Inovar Sistemas.
O usuário enviou uma mensagem vaga: "${mensagem}"

Peça para o usuário ser mais específico sobre a dúvida dele em relação ao sistema Inovar. Diga que você precisa de mais detalhes para ajudá-lo. Seja curto (1-2 linhas).`,

      INDEFINIDO: `Você é assistente de suporte técnico da Inovar Sistemas.
O usuário enviou: "${mensagem}"

Não ficou claro o que ele deseja. Peça educadamente para ele explicar melhor a dúvida técnica sobre o sistema ERP Inovar. Seja amigável e curto.`
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

module.exports = responseGenerator;