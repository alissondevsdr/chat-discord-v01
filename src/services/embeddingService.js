const { pipeline } = require('@xenova/transformers');
const { registrarLog } = require('../core/logger');

class EmbeddingService {
    constructor() {
        this.extractor = null;
    }

    async init() {
        registrarLog('INFO', '🧠 Carregando modelo de IA (multilingual-e5-small)...');
        this.extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
        registrarLog('INFO', '✅ Modelo carregado.');
    }

    async extrairVetorPesquisa(texto) {
        if (!this.extractor) await this.init();
        const buscaComPeso = `query: ${texto}`;
        const output = await this.extractor(buscaComPeso, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    async extrairVetorDocumento(problema, solucao) {
        if (!this.extractor) await this.init();
        const textoParaVetor = `passage: ${problema}. Solução: ${solucao}`;
        const output = await this.extractor(textoParaVetor, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }
}

module.exports = new EmbeddingService();
