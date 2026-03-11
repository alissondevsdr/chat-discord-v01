const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./core/config');
const { registrarLog } = require('./core/logger');
const embeddingService = require('./services/embeddingService');
const databaseService = require('./services/databaseService');
const SolutionHumanizer = require('./modules/support/generators/solutionHumanizer');
const messageHandler = require('./handlers/messageHandler');
const messageCreateEvent = require('./modules/events/messageCreate');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
  ],
  partials: [Partials.Channel, Partials.Message],
});

async function iniciarSistema() {
  registrarLog('INFO', '🚀 Iniciando sistema...');

  // 1. Inicializar Embeddings e Database
  await embeddingService.init();
  databaseService.init();

  // 2. Inicializar Humanizador
  registrarLog('INFO', '✨ Inicializando Humanizador (Ollama)...');
  const humanizador = new SolutionHumanizer();
  const ollamaOk = await humanizador.testarConexao();

  if (ollamaOk) {
    registrarLog('INFO', '✅ Ollama conectado! Humanização ativa.');
    messageHandler.setHumanizador(humanizador);
  } else {
    registrarLog('AVISO', '⚠️ Ollama não acessível. Humanização desativada.');
  }

  registrarLog('INFO', '✅ Serviços de IA Prontos!');

  // 3. Registrar Eventos do Discord
  client.once('clientReady', () => {
    registrarLog('INFO', `✅ Bot conectado como ${client.user.tag}`);
  });

  client.on(messageCreateEvent.name, (...args) => messageCreateEvent.execute(...args));

  // 4. Logar Discord
  client.login(config.DISCORD_TOKEN);
}

iniciarSistema().catch(err => {
  console.error("❌ Erro ao iniciar o sistema fatalzinho:", err);
});