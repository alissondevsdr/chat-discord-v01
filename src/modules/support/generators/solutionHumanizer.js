const config = require('../../../core/config');
const fetch = require('node-fetch');

class Humanizador {
  constructor(modelo = config.OLLAMA_MODEL) {
    this.modelo = modelo;
    this.urlOllama = config.OLLAMA_URL;
    this.cache = new Map();
    this.metricas = {
      sucesso: 0,
      falha: 0,
      fallback: 0,
      tempoTotal: 0
    };

    console.log(`🤖 Humanizador V04 inicializado:`);
    console.log(`   URL Ollama: ${this.urlOllama}`);
    console.log(`   Modelo: ${this.modelo}`);
  }

  /**
   * Humaniza resposta mantendo fidelidade ao conteúdo
   * V04: Validação menos rigorosa, mais pragmática
   */
  async humanizar(solucaoOriginal, perguntaUsuario) {
    const tempoInicio = Date.now();

    // Limpeza automática antes de verificar cache
    const limiteCache = parseInt(process.env.LIMITE_CACHE) || 1000;
    if (this.cache.size >= limiteCache) {
      this.limparCache(Math.floor(limiteCache * 0.8)); // mantém 80% ao limpar
      console.log(`🧹 Cache auto-limpado. Novo tamanho: ${this.cache.size}`);
    }

    // Montar chave de cache
    const chave = this._gerarChave(solucaoOriginal.id, perguntaUsuario);

    // Verificar cache
    if (this.cache.has(chave)) {
      console.log(`📄 Cache hit para solução #${solucaoOriginal.id}`);
      return this.cache.get(chave);
    }

    const prompt = this._construirPrompt(solucaoOriginal, perguntaUsuario);

    try {
      // Fazer requisição ao Ollama
      const resposta = await fetch(`${this.urlOllama}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelo,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,    // Ligeiramente maior para variação natural
            top_p: 0.9,
            num_predict: 600     // Aumentado para mais liberdade
          }
        })
      });

      // Verificar status HTTP
      if (!resposta.ok) {
        throw new Error(`HTTP ${resposta.status}: ${resposta.statusText}`);
      }

      const data = await resposta.json();
      let respostaHumanizada = data.response.trim();

      // Guardar no cache
      this.cache.set(chave, respostaHumanizada);
      this.metricas.sucesso++;

      // Registrar tempo
      const tempo = Date.now() - tempoInicio;
      this.metricas.tempoTotal += tempo;
      console.log(`✅ Humanizada #${solucaoOriginal.id} em ${tempo}ms`);

      return respostaHumanizada;

    } catch (erro) {
      console.error(`❌ Erro humanizando #${solucaoOriginal.id}: ${erro.message}`);
      this.metricas.falha++;
      return solucaoOriginal.solucao;
    }
  }

  /**
   * Construir prompt otimizado
   * V04: Prompt mais simples e efetivo
   */
  _construirPrompt(solucao, pergunta) {
    return `Você é um assistente de suporte técnico da Inovar Sistemas.

Sua tarefa é apenas REESCREVER a solução técnica para deixá-la mais clara e amigável para o usuário.

IMPORTANTE:
- NÃO altere o conteúdo técnico.
- NÃO remova passos.
- NÃO adicione novos passos.
- NÃO mude a ordem dos passos.
- NÃO altere nomes de menus, botões, campos ou módulos.
- NÃO altere atalhos de teclado (ex: Ctrl+X, F11).
- NÃO altere números ou sequências.
- NÃO invente informações.

PERMITIDO:
- Melhorar a clareza das frases.
- Tornar o texto mais conversacional.
- Adicionar pequenas frases de orientação ao usuário (ex: "Agora faça o seguinte:").

FORMATAÇÃO:
- Preserve listas numeradas ou passo a passo se existirem.
- Mantenha a mesma estrutura da solução original.

PERGUNTA DO USUÁRIO:
"${pergunta}"

SOLUÇÃO ORIGINAL:
${solucao.solucao}

Agora reescreva a solução mantendo todos os detalhes técnicos.

Responda SOMENTE com a solução reescrita.`;
  }



  /**
   * Gerar chave de cache - V04: Melhorada
   */
  _gerarChave(solucaoId, pergunta) {
    const perguntaSimples = pergunta
      .substring(0, 100)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''); // Remove caracteres especiais
    return `${solucaoId}:${perguntaSimples}`;
  }

  /**
   * Obter métricas de qualidade
   */
  obterMetricas() {
    const total = this.metricas.sucesso + this.metricas.falha + this.metricas.fallback;
    const tempoMedio = this.metricas.sucesso > 0
      ? (this.metricas.tempoTotal / this.metricas.sucesso).toFixed(0)
      : 0;
    const taxaSucesso = total > 0 ? ((this.metricas.sucesso / total) * 100).toFixed(1) : 0;
    const taxaFallback = total > 0 ? ((this.metricas.fallback / total) * 100).toFixed(1) : 0;

    return {
      sucessos: this.metricas.sucesso,
      falhas: this.metricas.falha,
      fallbacks: this.metricas.fallback,
      totalTentativas: total,
      taxaSucessoPct: taxaSucesso,
      taxaFallbackPct: taxaFallback,
      tempoMedioPorRequisicaoMs: tempoMedio,
      tamanhoCache: this.cache.size
    };
  }

  /**
   * Limpar cache se ficar muito grande
   */
  limparCache(limit = 1000) {
    if (this.cache.size > limit) {
      const paraRemover = this.cache.size - limit;
      let removidos = 0;

      for (const [chave] of this.cache) {
        this.cache.delete(chave);
        removidos++;
        if (removidos >= paraRemover) break;
      }

      console.log(`🧹 Cache limitado: removidos ${removidos} itens (novo tamanho: ${this.cache.size})`);
    }
  }

  /**
   * Testar conexão com Ollama
   */
  async testarConexao() {
    try {
      console.log(`🔍 Testando conexão com Ollama em: ${this.urlOllama}/api/tags`);
      const resposta = await fetch(`${this.urlOllama}/api/tags`, { timeout: 5000 });

      if (resposta.ok) {
        console.log(`✅ Ollama está acessível!`);
        return true;
      } else {
        console.log(`❌ Ollama respondeu com status ${resposta.status}`);
        return false;
      }
    } catch (erro) {
      console.error(`❌ Erro ao conectar com Ollama: ${erro.message}`);
      console.error(`   Verifique se o URL está correto: ${this.urlOllama}`);
      return false;
    }
  }

  /**
   * Resetar métricas
   */
  resetarMetricas() {
    this.metricas = { sucesso: 0, falha: 0, fallback: 0, tempoTotal: 0 };
  }
}

module.exports = Humanizador;