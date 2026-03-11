const messageHandler = require('../../handlers/messageHandler');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    const isDM = message.channel.type === 1; // ChannelType.DM

    if (!isDM) {
      try {
        await message.author.send(
          '👋 Oi! Para dúvidas sobre o sistema, me manda uma mensagem aqui no privado. Estou pronto para ajudar!'
        );
      } catch {
        // Usuário pode ter DMs desabilitadas — ignora silenciosamente
      }
      return;
    }

    await messageHandler.processarMensagem(message);
  },
};