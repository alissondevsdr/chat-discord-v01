const { registrarLog } = require('../core/logger');
const databaseService = require('../services/databaseService');
const IntentionClassifier = require('../modules/support/analyzers/intentionClassifier');

// Criar instância apenas para analisar pelo comando !analise
const classificador = new IntentionClassifier();

class CommandHandler {
    async processarComando(message, humanizador) {
        const partes = message.content.split('|').map(p => p.trim());
        const comando = partes[0].toLowerCase();

        if (comando === '!ajuda') {
            const ajuda = `**🤖 Suporte IA Inovar (v0.5.0 - Smart Context)**\n\n` +
                `**Conversar:** Digite uma saudação ou pergunta normalmente.\n` +
                `**Perguntar:** Dúvida sobre o sistema - busca automática.\n` +
                `**Salvar:** \`!salvar | título | solução | palavras | tags\`\n` +
                `**Listar:** \`!listar\`\n` +
                `**Debug:** \`!debug <pergunta>\` - análise de busca\n` +
                `**Análise:** \`!analise <mensagem>\` - análise completa de intenção`;
            await message.reply(ajuda);
            return;
        }

        if (comando === '!listar') {
            await message.reply(`**📚 Base:** ${databaseService.getTotalSolucoes()} soluções indexadas.`);
            return;
        }

        if (comando === '!salvar') {
            if (partes.length !== 5) {
                await message.reply('❌ Use: `!salvar | título | solução | palavras | tags`');
                return;
            }

            const [, problema, solucao, palavrasTexto, tagsTexto] = partes;
            const idSalvo = await databaseService.salvarNovaSolucao(
                problema,
                solucao,
                palavrasTexto.split(','),
                tagsTexto.split(','),
                message.channel.id,
                message.channel.name
            );
            await message.reply(idSalvo ? `✅ Solução #${idSalvo} salva!` : '❌ Erro ao salvar.');
            return;
        }

        if (comando === '!debug') {
            if (partes.length < 2) {
                await message.reply('Use: `!debug <sua pergunta>`');
                return;
            }

            const pergunta = partes.slice(1).join(' ');
            const resultados = await databaseService.buscarSolucaoIA(pergunta);

            let debug = `**🔍 Debug: "${pergunta}"**\n\n`;
            debug += `Resultados: ${resultados.length}\n\n`;

            resultados.forEach((r, i) => {
                debug += `${i + 1}. ${r.payload.problema} (${r.score.toFixed(4)})\n`;
            });

            if (humanizador) {
                const metricas = humanizador.obterMetricas();
                debug += `\n**Humanizador:** ${metricas.sucessos} sucessos`;
            }

            await message.reply(debug);
            return;
        }

        if (comando === '!analise') {
            if (partes.length < 2) {
                await message.reply('Use: `!analise <sua mensagem>`');
                return;
            }

            const textoPraAnalisar = partes.slice(1).join(' ');
            const analiseCompleta = await classificador.obterAnaliseCompleta(textoPraAnalisar);
            const val = analiseCompleta.validacao;

            let resposta = `**📊 ANÁLISE COMPLETA: "${textoPraAnalisar}"**\n\n`;
            resposta += `🎯 **Classificação:** ${analiseCompleta.classificacao.tipo} (${(analiseCompleta.classificacao.confianca * 100).toFixed(0)}%)\n`;
            resposta += `📈 **Relevância ao Sistema:** ${(val.scoreRelevancia * 100).toFixed(0)}%\n`;
            resposta += `🚨 **Off-Topic Score:** ${(val.scoreOffTopic * 100).toFixed(0)}%\n`;
            resposta += `🔧 **Estrutura:** ${val.categorias.estrutura}\n`;
            resposta += `✅ **Coerência:** ${(val.scoreCoerencia * 100).toFixed(0)}%\n`;
            resposta += `\n💡 **Motivo:** ${val.motivo}\n`;
            resposta += `🎬 **Ação Recomendada:** ${analiseCompleta.classificacao.acaoRecomendada}\n`;

            if (analiseCompleta.classificacao.resposta) {
                resposta += `\n📝 **Resposta Gerada:** ${analiseCompleta.classificacao.resposta.substring(0, 200)}...\n`;
            }

            resposta += `\n📌 **Detalhes da Validação:**\n`;
            resposta += `• Poesia/Rimas: ${val.categorias.temPoesiasOuRimas ? 'SIM ⚠️' : 'não'}\n`;
            resposta += `• Maiúsculas: ${val.scoreCoerencia > 0.5 ? 'Normal ✅' : 'Suspeito 🚩'}\n`;
            resposta += `• Valido: ${val.valido ? 'SIM ✅' : 'NÃO ❌'}\n` + '```';

            await message.reply(resposta);
            return;
        }
    }
}

module.exports = new CommandHandler();
