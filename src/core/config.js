require('dotenv').config();
const path = require('path');

module.exports = {
  // App
  NODE_ENV: process.env.NODE_ENV || 'development',
  MIN_MESSAGE_LENGTH: 3,
  MAX_MESSAGE_LENGTH: 2000,

  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,

  // Ollama
  OLLAMA_URL: process.env.URL_OLLAMA || 'http://127.0.0.1:11434',
  OLLAMA_MODEL: process.env.MODELO_OLLAMA || 'qwen2.5:1.5b',

  // Qdrant
  QDRANT_URL: process.env.URL_QDRANT || 'http://127.0.0.1:6333',
  COLLECTION_NAME: 'solucoes_inovar',

  // Configurações de Busca e Thresholds
  THRESHOLD_BUSCA: parseFloat(process.env.THRESHOLD_BUSCA) || 0.65,
  THRESHOLD_MINIMO: parseFloat(process.env.THRESHOLD_MINIMO) || 0.50,
  THRESHOLD_HUMANIZACAO: parseFloat(process.env.THRESHOLD_HUMANIZACAO) || 0.60,
  THRESHOLD_CONFIANCA_ALTA: parseFloat(process.env.THRESHOLD_CONFIANCA_ALTA) || 0.75,
  THRESHOLD_RELACIONADAS: parseFloat(process.env.THRESHOLD_RELACIONADAS) || 0.40,

  // Paths
  JSON_FILE: path.join(__dirname, '../../data/solutions.json'),
  LOG_DIR: path.join(__dirname, '../../logs'),
  LOG_FILE: path.join(__dirname, '../../logs/log.txt')
};