/**
 * ⚠️ ATENÇÃO — CÓDIGO NÃO REGISTRADO (MORTO)
 * Este handler de evento 'ready' NÃO está sendo registrado no index.js.
 * O evento clientReady é tratado diretamente no index.js via client.once('clientReady', ...).
 *
 * NÃO ative este arquivo sem remover o handler inline do index.js.
 * Ativar ambos causará dois handlers conflitantes sem erro explícito.
 *
 * Status: Rascunho / Planejamento futuro
 */
module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot logado como ${client.user.tag}`);
    client.user.setActivity('mensagens do suporte', { type: 'LISTENING' });
  },
};