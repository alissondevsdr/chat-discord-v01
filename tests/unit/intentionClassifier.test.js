const IntentionClassifier = require('../../src/modules/support/analyzers/intentionClassifier');

async function executarTestes() {
    console.log('\n🧪 TESTES UNITÁRIOS: CLASSIFICADOR DE INTENÇÃO (AI-ONLY)\n');
    const classificador = new IntentionClassifier();

    const casos = [
        { text: 'Olá, bom dia!', expected: 'SAUDACAO' },
        { text: 'Erro ao emitir nota fiscal', expected: 'SUPORTE' },
        { text: 'piada piada piada', expected: 'OFF_TOPIC' },
        { text: '!ajuda', expected: 'COMANDO' }
    ];

    let falhas = 0;

    console.log('⏳ Testando via Ollama (certifique-se que o serviço está rodando)...');

    for (const caso of casos) {
        try {
            // Usamos classificarComResposta que agora é o entrypoint principal
            const resultado = await classificador.classificarComResposta(caso.text);

            if (resultado.tipo !== caso.expected) {
                console.log(`❌ FALHA: "${caso.text}" - Esperado: ${caso.expected}, Recebido: ${resultado.tipo}`);
                falhas++;
            } else {
                console.log(`✅ PASSOU: "${caso.text}" (${resultado.tipo})`);
            }
        } catch (e) {
            console.log(`❌ ERRO FATAL: "${caso.text}" - ${e.message}`);
            falhas++;
        }
    }

    if (falhas === 0) {
        console.log('\n🎉 Todos os testes de IntentionClassifier (AI-ONLY) passaram!');
    } else {
        console.log(`\n⚠️  ${falhas} teste(s) falhou/falharam.`);
    }
}

executarTestes().catch(console.error);
