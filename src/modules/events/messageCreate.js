const IntentionClassifier = require('../support/analyzers/intentionClassifier');
const config = require('../../core/config');

const intentionClassifier = new IntentionClassifier();

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;
    if (message.content.length < config.MIN_MESSAGE_LENGTH) return;

    try {
      const resultado = await intentionClassifier.classificarComResposta(
        message.content
      );

      if (resultado.resposta) {
        await message.reply(resultado.resposta);
      }
    } catch (erro) {
      console.error('❌ Erro ao processar mensagem:', erro);
      await message.reply('Desculpa, ocorreu um erro.');
    }
  },
};