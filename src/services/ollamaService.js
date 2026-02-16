const fetch = require('node-fetch');
const config = require('../core/config');

class OllamaService {
  constructor() {
    this.url = config.OLLAMA_URL;
    this.model = config.OLLAMA_MODEL;
  }

  async gerarResposta(prompt) {
    try {
      const response = await fetch(`${this.url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.statusCode}`);

      const data = await response.json();
      return data.response;
    } catch (erro) {
      console.error('❌ Erro Ollama:', erro.message);
      throw erro;
    }
  }

  async testarConexao() {
    try {
      const response = await fetch(`${this.url}/api/tags`);
      return response.ok;
    } catch (erro) {
      console.error('❌ Ollama indisponível:', erro.message);
      return false;
    }
  }
}

module.exports = OllamaService;