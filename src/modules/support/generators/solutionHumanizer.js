const fetch = require('node-fetch');

class Humanizador {
  constructor(modelo = process.env.MODELO_OLLAMA || 'qwen1.5b-safe:latest') {
    this.modelo = modelo;
    this.urlOllama = process.env.URL_OLLAMA || 'http://127.0.0.1:11435';
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

      // V04: Validação otimizada - menos rigorosa
      const validacao = this._validarFidelidade(
        solucaoOriginal.solucao,
        respostaHumanizada
      );

      if (!validacao.ok) {
        console.warn(`⚠️ Validação falhou (#${solucaoOriginal.id}): ${validacao.motivo}`);
        console.warn(`   🔧 Motivo: ${validacao.motivo}`);
        console.warn(`   💡 Usando fallback (resposta original)`);
        this.metricas.fallback++;
        return solucaoOriginal.solucao;
      }

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
      console.error(`   Verifique se Ollama está rodando em: ${this.urlOllama}`);
      this.metricas.falha++;
      return solucaoOriginal.solucao;
    }
  }

  /**
   * Construir prompt otimizado
   * V04: Prompt mais simples e efetivo
   */
  _construirPrompt(solucao, pergunta) {
    return `Você é um assistente de suporte técnico amigável da Inovar Sistemas.

SOLUÇÃO ORIGINAL (não mude os detalhes técnicos):
${solucao.solucao}

PERGUNTA: "${pergunta}"

REESCREVA a solução acima de forma amigável e clara, mantendo:
- Todos os números, passos e sequências exatas
- Todos os atalhos de teclado (Ctrl+X, F11, etc)
- Todos os nomes de menus e campos do sistema
- O tom técnico mas mais conversacional

Responda APENAS com a solução reescrita, sem explicações adicionais.`;
  }

  /**
   * Validar fidelidade - V04: Mais pragmática
   */
  _validarFidelidade(original, humanizada) {
    // Verificação 1: Não pode ser MUITO mais curta
    const comprimentoMinimo = original.length * 0.7; // 70% do original

    if (humanizada.length < comprimentoMinimo) {
      return {
        ok: false,
        motivo: `Resposta muito curta (${humanizada.length} < ${comprimentoMinimo.toFixed(0)})`
      };
    }

    // Verificação 2: Não pode ser absurdamente longa
    const comprimentoMaximo = original.length * 3.0; // 300% do original

    if (humanizada.length > comprimentoMaximo) {
      return {
        ok: false,
        motivo: `Resposta muito longa (${humanizada.length} > ${comprimentoMaximo.toFixed(0)})`
      };
    }

    // Verificação 3: Números críticos (não sumir completamente)
    const extrairNumeros = (texto) => {
      return (texto.match(/\b\d{2,}\b/g) || []).map(Number); // Apenas números de 2+ dígitos
    };

    const numOriginal = extrairNumeros(original);
    const numHumanizada = extrairNumeros(humanizada);

    // Se havia números críticos no original, devem estar na resposta
    if (numOriginal.length > 0) {
      for (const n of numOriginal) {
        if (!numHumanizada.includes(n)) {
          return {
            ok: false,
            motivo: `Número crítico ${n} foi removido`
          };
        }
      }
    }

    // Verificação 4: Atalhos críticos (F-keys, Ctrl+X)
    const extrairAtalhos = (texto) => {
      const atalhos = texto.match(/(?:Ctrl|Shift|Alt|F\d+|ENTER|ESC|DELETE|BACKSPACE)/gi) || [];
      return atalhos.map(a => a.toUpperCase()).sort();
    };

    const atalhoOriginal = extrairAtalhos(original);
    const atalhoHumanizada = extrairAtalhos(humanizada);

    if (atalhoOriginal.length > 0) {
      for (const atalho of atalhoOriginal) {
        if (!atalhoHumanizada.includes(atalho)) {
          return {
            ok: false,
            motivo: `Atalho crítico ${atalho} foi removido`
          };
        }
      }
    }

    // Verificação 5: Caminhos do sistema (Menu > Submenu)
    const extrairCaminhos = (texto) => {
      const caminhos = texto.match(/([A-ZÁÀÂÃÉÈÊÍÓÔÕÚÇa-záàâãéèêíóôõúç]+\s*>\s*[A-ZÁÀÂÃÉÈÊÍÓÔÕÚÇa-záàâãéèêíóôõúç\s]+)/g) || [];
      return caminhos.map(c => c.trim()).sort();
    };

    const caminhoOriginal = extrairCaminhos(original);
    const caminhoHumanizada = extrairCaminhos(humanizada);

    if (caminhoOriginal.length > 0) {
      for (const caminho of caminhoOriginal) {
        if (!caminhoHumanizada.includes(caminho)) {
          // Talvez esteja escrito diferente - não é erro fatal
          console.log(`   ℹ️ Caminho possivelmente reformulado: ${caminho}`);
        }
      }
    }

    // ✅ Se passou em todas as verificações críticas
    return { ok: true };
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