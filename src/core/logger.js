const fs = require('fs');
const config = require('./config');

if (!fs.existsSync(config.LOG_DIR)) {
    fs.mkdirSync(config.LOG_DIR, { recursive: true });
}

function registrarLog(tipo, mensagem) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const linha = `[${timestamp}] ${tipo}: ${mensagem}\n`;
    fs.appendFileSync(config.LOG_FILE, linha);
    console.log(linha.trim());
}

module.exports = { registrarLog };
