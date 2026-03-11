/**
 * 🧭 DETECTOR DE INTENÇÃO (Versão AI-ONLY)
 * Classifica mensagens em categorias usando exclusivamente IA (Ollama)
 * 
 * Padrão: camelCase, integrado ao fluxo existente
 */

const responseGenerator = require('../generators/responseGenerator');
const config = require('../../../core/config');
const fetch = require('node-fetch');

class DetectIntention {
  constructor() {
    this.generador = new responseGenerator();
    this.urlOllama = config.OLLAMA_URL;
    this.modelo = config.OLLAMA_MODEL;

    console.log('🧭 Detector de Intenção (AI-ONLY) inicializado');
  }

  /**
   * Classificar mensagem e gerar resposta (Fluxo AI-ONLY)
   */
  async classificarComResposta(mensagem) {
    const textoLimpo = mensagem.trim();

    // 1. CHECAGEM RÁPIDA DE COMANDO (Prefix ! )
    // Única exceção de regex/string match por performance e segurança
    if (textoLimpo.startsWith('!')) {
      return {
        tipo: 'COMANDO',
        confianca: 1.0,
        descricao: 'Comando manual via prefixo !',
        fonte: 'SISTEMA'
      };
    }

    // 2. CLASSIFICAÇÃO VIA IA
    const classificacao = await this.classificarComOllama(textoLimpo);

    // Se for resposta coloquial (SAUDACAO, OFF_TOPIC, VAGO, INDEFINIDO), gera a resposta via IA
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

  async classificarComOllama(mensagem) {
    const prompt = `Você é um classificador de mensagens para o suporte técnico do sistema ERP "Inovar Sistemas".

Classifique a mensagem do usuário em UMA destas categorias:
- SAUDACAO: Cumprimentos, agradecimentos ou despedidas (Ex: "Olá", "bom dia", "obrigado", "valeu").
- SUPORTE: Qualquer dúvida sobre o sistema ERP Inovar, processos fiscais, contábeis ou de venda (Ex: "Como criar SPED?", "Erro na NFe", "Configurar TEF", "Relatório de vendas", "Cadastrar produto", "Sincronizar PDV", "Mariadb parou").
- OFF_TOPIC: Assuntos totalmente fora do contexto de software ou empresa (Ex: "quem ganhou o jogo?", "como fazer um bolo", "me conte uma piada", "rimas").
- VAGO: Mensagens que não possuem conteúdo suficiente para classificar (Ex: "oi" e nada mais, "????", "teste", letras soltas "a", "b", "f").
- COMANDO: Mensagens que iniciam com o prefixo "!".

REGRAS CRÍTICAS:
1. "SPED", "NFe", "Sieg", "Mariadb", "XML", "Heidi" são termos TÉCNICOS do sistema Inovar. Se aparecerem, é SUPORTE.
2. Seja conservador com OFF_TOPIC: Na dúvida entre SUPORTE e OFF_TOPIC, escolha SUPORTE.

Responda EXCLUSIVAMENTE em formato JSON:
{"tipo": "CATEGORIA", "confianca": 0.0, "motivo": " explicação curta"}

Mensagem: "${mensagem}"`;

    try {
      console.log(`[OLLAMA] Classificando: "${mensagem.substring(0, 50)}${mensagem.length > 50 ? '...' : ''}"`);
      const response = await fetch(`${this.urlOllama}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelo,
          prompt,
          stream: false,
          options: { temperature: 0.1, num_predict: 100 }
        })
      });

      if (!response.ok) throw new Error(`Ollama indisponível (Status: ${response.status})`);

      const data = await response.json();
      const texto = (data.response || '').trim();

      let resultado;
      try {
        const jsonLimpo = texto.replace(/```json|```/g, '').trim();
        resultado = JSON.parse(jsonLimpo);
      } catch (e) {
        console.error(`[OLLAMA ERROR] Falha ao parsear JSON. Resposta bruta: "${texto}"`);
        throw new Error("Resposta da IA em formato inválido.");
      }

      return {
        tipo: resultado.tipo || 'INDEFINIDO',
        confianca: resultado.confianca || 0.7,
        descricao: resultado.motivo || '',
        fonte: 'OLLAMA'
      };
    } catch (erro) {
      console.error(`❌ Erro crítico no Detector de Intenção (AI): ${erro.message}`);
      // Se não tem IA, o bot "morre" (não funciona) conforme pedido do usuário
      throw new Error("Sistema de IA indisponível. O bot não pode processar mensagens sem conexão com o Ollama.");
    }
  }

  /**
   * Mapeamento de emojis e nomes para UI
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

  async obterAnaliseCompleta(mensagem) {
    const resposta = await this.classificarComResposta(mensagem);
    return {
      mensagem,
      classificacao: resposta,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = DetectIntention;