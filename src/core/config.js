module.exports = {
  // Ollama
  OLLAMA_URL: process.env.URL_OLLAMA || 'http://127.0.0.1:11435',
  OLLAMA_MODEL: process.env.MODELO_OLLAMA || 'qwen1.5b-safe:latest',

  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,

  // App
  NODE_ENV: process.env.NODE_ENV || 'development',
  MIN_MESSAGE_LENGTH: 3,
  MAX_MESSAGE_LENGTH: 2000,
};