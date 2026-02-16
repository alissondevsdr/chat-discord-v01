/**
 * 🧪 TESTES - VALIDADOR DE CONTEXTO
 * Valida o funcionamento do novo sistema de análise
 * 
 * Como rodar: node tests/testmessageAnalyzer.js
 */

const messageAnalyzer = require('../../src/modules/support/analyzers/messageAnalyzer');
const DetectIntention = require('../../src/modules/support/analyzers/intentionClassifier');

// Cores para console
const cores = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  vermelho: '\x1b[31m',
  amarelo: '\x1b[33m',
  azul: '\x1b[34m',
  cinza: '\x1b[90m'
};

class TestemessageAnalyzer {
  constructor() {
    this.validador = new messageAnalyzer();
    this.detector = new DetectIntention();
    this.testes = [
      // Testes de RELEVÂNCIA
      {
        nome: 'Pergunta sobre backup (VÁLIDA)',
        mensagem: 'Como faço backup do banco de dados?',
        esperado: { valido: true, relevancia: 'ALTA', tipo: 'SUPORTE' }
      },
      {
        nome: 'Pergunta vaga (VAGA)',
        mensagem: 'Como?',
        esperado: { valido: false, relevancia: 'BAIXA', tipo: 'VAGO' }
      },
      {
        nome: 'Off-topic futebol (OFF-TOPIC)',
        mensagem: 'Qual seu time de futebol favorito?',
        esperado: { valido: false, offtopic: true, tipo: 'OFF_TOPIC' }
      },
      {
        nome: 'Off-topic política (OFF-TOPIC)',
        mensagem: 'O que você acha da situação política do Brasil?',
        esperado: { valido: false, offtopic: true, tipo: 'OFF_TOPIC' }
      },
      {
        nome: 'Problema de erro (VÁLIDA)',
        mensagem: 'O relatório não está sendo gerado, dá erro 500!',
        esperado: { valido: true, relevancia: 'ALTA', tipo: 'SUPORTE' }
      },
      {
        nome: 'Saudação simples (SAUDAÇÃO)',
        mensagem: 'Olá!',
        esperado: { valido: true, tipo: 'SAUDACAO' }
      },
      {
        nome: 'Spam com poesia (SPAM)',
        mensagem: 'Quando o sol nasce,\nA lua desce,\nVocê quer conhecer,\nMeu novo interesse!',
        esperado: { valido: false, temPoesia: true }
      },
      {
        nome: 'Mensagem em CAPS (SPAM)',
        mensagem: 'COMO FAÇO LOGIN???!!!',
        esperado: { valido: false, tipo: 'VAGO' }
      },
      {
        nome: 'Dúvida legítima média relevância',
        mensagem: 'Como usar o módulo de relatórios?',
        esperado: { valido: true, relevancia: 'ALTA', tipo: 'SUPORTE' }
      },
      {
        nome: 'Off-topic namoro',
        mensagem: 'Quer namora comigo?',
        esperado: { valido: false, offtopic: true }
      },
      {
        nome: 'Pergunta sobre Inovar (VÁLIDA)',
        mensagem: 'Qual é a versão atual do Inovar?',
        esperado: { valido: true, relevancia: 'ALTA' }
      },
      {
        nome: 'Comando (COMANDO)',
        mensagem: '!ajuda',
        esperado: { tipo: 'COMANDO' }
      }
    ];

    this.resultados = {
      passou: 0,
      falhou: 0,
      detalhes: []
    };
  }

  async executarTestes() {
    console.log(`\n${cores.azul}🧪 INICIANDO TESTES DE VALIDAÇÃO DE CONTEXTO${cores.reset}\n`);

    for (const teste of this.testes) {
      await this.executarTeste(teste);
    }

    this.exibirResultados();
  }

  async executarTeste(teste) {
    try {
      const validacao = this.validador.validar(teste.mensagem);
      const classificacao = this.detector.classificar(teste.mensagem);

      let passou = this._verificarTeste(teste, validacao, classificacao);

      if (passou) {
        this.resultados.passou++;
        console.log(`${cores.verde}✅ PASSOU${cores.reset} - ${teste.nome}`);
      } else {
        this.resultados.falhou++;
        console.log(`${cores.vermelho}❌ FALHOU${cores.reset} - ${teste.nome}`);
      }

      this.resultados.detalhes.push({
        teste: teste.nome,
        mensagem: teste.mensagem,
        passou,
        validacao,
        classificacao
      });

    } catch (erro) {
      this.resultados.falhou++;
      console.log(`${cores.vermelho}💥 ERRO${cores.reset} - ${teste.nome}: ${erro.message}`);
    }
  }

  _verificarTeste(teste, validacao, classificacao) {
    const esperado = teste.esperado;

    // Verificar tipo de classificação
    if (esperado.tipo && classificacao.tipo !== esperado.tipo) {
      return false;
    }

    // Verificar validade
    if (esperado.valido !== undefined && validacao.valido !== esperado.valido) {
      return false;
    }

    // Verificar relevância
    if (esperado.relevancia) {
      const rel = validacao.categorias.relevancia;
      if (rel !== esperado.relevancia) {
        return false;
      }
    }

    // Verificar off-topic
    if (esperado.offtopic !== undefined && validacao.categorias.offtopic !== esperado.offtopic) {
      return false;
    }

    // Verificar poesia
    if (esperado.temPoesia !== undefined && validacao.categorias.temPoesiasOuRimas !== esperado.temPoesia) {
      return false;
    }

    return true;
  }

  exibirResultados() {
    console.log(`\n${cores.cinza}${'='.repeat(60)}${cores.reset}`);
    console.log(`\n📊 RESULTADOS:`);
    console.log(`${cores.verde}✅ Passou: ${this.resultados.passou}${cores.reset}`);
    console.log(`${cores.vermelho}❌ Falhou: ${this.resultados.falhou}${cores.reset}`);

    const total = this.resultados.passou + this.resultados.falhou;
    const percentual = ((this.resultados.passou / total) * 100).toFixed(1);

    console.log(`\n${cores.azul}📈 Taxa de Sucesso: ${percentual}%${cores.reset}`);
    console.log(`${cores.cinza}${'='.repeat(60)}${cores.reset}\n`);

    if (this.resultados.falhou > 0) {
      console.log(`${cores.amarelo}⚠️  Testes que falharam:${cores.reset}`);
      this.resultados.detalhes
        .filter(d => !d.passou)
        .forEach(d => {
          console.log(`\n  ${cores.vermelho}${d.teste}${cores.reset}`);
          console.log(`  Mensagem: "${d.mensagem}"`);
          console.log(`  Tipo: ${d.classificacao.tipo} (confiança: ${(d.classificacao.confianca * 100).toFixed(0)}%)`);
          console.log(`  Relevância: ${(d.validacao.scoreRelevancia * 100).toFixed(0)}%`);
          console.log(`  Off-Topic: ${(d.validacao.scoreOffTopic * 100).toFixed(0)}%`);
        });
    }
  }

  // Teste interativo
  async testarMensagemCustomizada(mensagem) {
    console.log(`\n${cores.azul}🔍 Analisando: "${mensagem}"${cores.reset}\n`);

    const validacao = this.validador.obterAnaliseDetalhada(mensagem);
    const classificacao = this.detector.classificar(mensagem);

    console.log(`📊 VALIDAÇÃO DE CONTEXTO:`);
    console.log(`  • Válida: ${validacao.valido ? cores.verde + 'SIM ✅' : cores.vermelho + 'NÃO ❌'}${cores.reset}`);
    console.log(`  • Score Geral: ${(validacao.score * 100).toFixed(0)}%`);
    console.log(`  • Relevância: ${(validacao.scoreRelevancia * 100).toFixed(0)}%`);
    console.log(`  • Off-Topic: ${(validacao.scoreOffTopic * 100).toFixed(0)}%`);
    console.log(`  • Estrutura: ${validacao.categorias.estrutura}`);
    console.log(`  • Coerência: ${(validacao.scoreCoerencia * 100).toFixed(0)}%`);
    console.log(`  • Motivo: ${validacao.motivo}`);

    console.log(`\n🎯 CLASSIFICAÇÃO:`);
    console.log(`  • Tipo: ${classificacao.tipo}`);
    console.log(`  • Confiança: ${(classificacao.confianca * 100).toFixed(0)}%`);
    console.log(`  • Descrição: ${classificacao.descricao}`);

    const acao = this.validador.sugerirAcao(validacao);
    console.log(`\n🎬 AÇÃO RECOMENDADA: ${cores.azul}${acao}${cores.reset}\n`);
  }
}

// Executar testes
async function main() {
  const teste = new TestemessageAnalyzer();
  await teste.executarTestes();

  // Teste interativo opcional
  console.log(`${cores.amarelo}💡 Exemplos de análise customizada:${cores.reset}\n`);

  const exemplos = [
    'Como faço para resetar a senha?',
    'Me faz uma piada por favor',
    'Erro ao sincronizar banco',
    'Qual seu nome?'
  ];

  for (const exemplo of exemplos) {
    await teste.testarMensagemCustomizada(exemplo);
  }
}

main().catch(console.error);
