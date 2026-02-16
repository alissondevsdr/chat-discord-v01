module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot logado como ${client.user.tag}`);
    client.user.setActivity('mensagens do suporte', { type: 'LISTENING' });
  },
};