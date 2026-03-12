const { EmbedBuilder } = require('discord.js');
const { registrarLog } = require('../core/logger');
const config = require('../core/config');
const IntentionClassifier = require('../modules/support/analyzers/intentionClassifier');
const commandHandler = require('./commandHandler');
const queryOptimizer = require('../services/queryOptimizer');

class MessageHandler {
    constructor() {
        this.classificador = new IntentionClassifier();
        this.humanizador = null;
        // Rate limiting: map de userId -> timestamp da última mensagem
        this.cooldowns = new Map();
        this.COOLDOWN_MS = 3000; // 3 segundos entre mensagens por usuário
    }

    setHumanizador(humanizador) {
        this.humanizador = humanizador;
    }

    async processarMensagem(message) {
        try {
            // Rate limiting por usuário
            const agora = Date.now();
            const ultimaMensagem = this.cooldowns.get(message.author.id) || 0;
            if (agora - ultimaMensagem < this.COOLDOWN_MS) {
                await message.reply('⏳ Aguarde um momento antes de enviar outra mensagem.');
                return;
            }
            this.cooldowns.set(message.author.id, agora);

            console.log(`\n📩 Mensagem recebida de ${message.author.username}: "${message.content}"`);
            await message.channel.sendTyping();

            const analise = await this.classificador.classificarComResposta(message.content);
            const info = this.classificador.obterInfo(analise.tipo);

            console.log(`[ANALYSIS] ${info.emoji} ${analise.tipo} (confiança: ${(analise.confianca * 100).toFixed(0)}%)`);

            // SAUDAÇÃO
            if (analise.tipo === 'SAUDACAO') {
                console.log(`[ACTION] 💬 Respondendo com mensagem coloquial...`);
                const embed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setDescription(analise.resposta)
                    .setFooter({ text: `Inovar Sistemas • ${analise.fonteFesposta || 'IA'}` });
                await message.reply({ embeds: [embed] });
                registrarLog('INFO', `💬 Saudação respondida (${analise.fonteFesposta || 'IA'})`);
                return;
            }

            // OFF-TOPIC
            if (analise.tipo === 'OFF_TOPIC') {
                console.log(`[ACTION] ❌ Mensagem detectada como off-topic`);
                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setDescription(analise.resposta)
                    .setFooter({ text: 'Inovar Sistemas • Foco: Suporte Técnico' });
                await message.reply({ embeds: [embed] });
                registrarLog('INFO', `❌ Off-topic rejeitado gentilmente`);
                return;
            }

            // VAGO
            if (analise.tipo === 'VAGO') {
                console.log(`[ACTION] ❓ Mensagem vaga - pedindo clarificação`);
                const embed = new EmbedBuilder()
                    .setColor(0xf39c12)
                    .setDescription(analise.resposta)
                    .setFooter({ text: 'Inovar Sistemas • Preciso de mais detalhes' });
                await message.reply({ embeds: [embed] });
                registrarLog('INFO', `❓ Pedido de clarificação enviado`);
                return;
            }

            // COMANDO
            if (analise.tipo === 'COMANDO') {
                return commandHandler.processarComando(message, this.humanizador);
            }

            // SUPORTE
            if (analise.tipo === 'SUPORTE') {
                console.log(`[ACTION] 🔍 Buscando solução na base...`);
                return this.processarSuporte(message);
            }

            // INDEFINIDO ou Fallback
            console.log(`[ACTION] ❓ Não foi possível determinar a intenção com clareza`);
            await message.reply("Hmm, não entendi bem. Como posso ajudar com o sistema Inovar?");

        } catch (erro) {
            registrarLog('ERRO', `Erro ao processar mensagem: ${erro.message}`);
            // Se o erro for do sistema de IA (Ollama offline), o bot apenas informa o erro fatal ou silencia dependendo da UX desejada.
            await message.reply('❌ Sistema de atendimento indisponível no momento.');
        }
    }

    async processarSuporte(message) {
        console.log(`[ACTION] 🧠 Otimizando pergunta...`);
        await message.channel.sendTyping();
        const perguntaOtimizada = await queryOptimizer.reescreverPergunta(message.content);

        console.log(`[ACTION] 🔍 Buscando solução na base (Multi-Query)...`);
        await message.channel.sendTyping();
        const resultados = await queryOptimizer.buscarComMultiQuery(perguntaOtimizada);

        if (resultados.length > 0) {
            console.log(`[ANALYSIS] 🔎 Pergunta: "${message.content}"`);
            console.log(`[ANALYSIS] 🎯 Match: "${resultados[0].payload.problema}"`);
            console.log(`[ANALYSIS] 📊 Score: ${resultados[0].score.toFixed(4)}`);
            console.log(`[ANALYSIS] 🚦 Status: ${resultados[0].score > config.THRESHOLD_MINIMO ? '✅ APROVADO' : '❌ REJEITADO'}\n`);
        }

        if (resultados.length > 0 && resultados[0].score > config.THRESHOLD_MINIMO) {
            const principal = resultados[0].payload;
            // Bug #6 corrigido: parseFloat garante que confianca é número, não string
            const confianca = parseFloat((resultados[0].score * 100).toFixed(1));

            let solucaoExibida = principal.solucao;
            let humanizada = false;

            if (this.humanizador && confianca >= (config.THRESHOLD_HUMANIZACAO * 100)) {
                registrarLog('INFO', `🎨 Humanizando solução #${principal.id}...`);
                try {
                    solucaoExibida = await this.humanizador.humanizar(principal, message.content);
                    humanizada = true;
                    registrarLog('INFO', `✅ Humanização bem-sucedida #${principal.id}`);
                } catch (erro) {
                    registrarLog('AVISO', `Erro ao humanizar: ${erro.message}`);
                    solucaoExibida = principal.solucao;
                }
            }

            registrarLog('INFO', `✅ Confiança: ${confianca}% | ID: #${principal.id} | Status: ${humanizada ? '🎨 Humanizada' : '📖 Original'}`);

            const respostaPronta = `**${principal.problema}**\n\n${solucaoExibida.replace(/@everyone/g, '')}`;
            await message.reply(respostaPronta);


        } else {
            await message.reply('❌ Nenhuma solução encontrada. Tente detalhar melhor.');
        }
    }
}

module.exports = new MessageHandler();
