const { QdrantClient } = require('@qdrant/js-client-rest');
const fs = require('fs');
const config = require('../core/config');
const { registrarLog } = require('../core/logger');
const embeddingService = require('./embeddingService');

class DatabaseService {
    constructor() {
        this.qdrant = new QdrantClient({
            url: config.QDRANT_URL,
            checkCompatibility: false,
            timeout: 30000
        });
        this.bancoDados = { solucoes: [] };
    }

    init() {
        try {
            const dados = fs.readFileSync(config.JSON_FILE, 'utf8');
            this.bancoDados = JSON.parse(dados);
            console.log(`✅ Banco de dados carregado: ${this.bancoDados.solucoes.length} soluções`);
        } catch (erro) {
            console.error(`❌ Erro ao carregar ${config.JSON_FILE}:`, erro.message);
            process.exit(1);
        }
    }

    async buscarSolucaoIA(pergunta, limit = 3) {
        const embedding = await embeddingService.extrairVetorPesquisa(pergunta);
        return await this.qdrant.search(config.COLLECTION_NAME, {
            vector: embedding,
            limit: limit,
            with_payload: true
        });
    }

    async salvarNovaSolucao(problema, solucao, palavrasChave, tags, canalId, canalNome) {
        const novoId = this.bancoDados.solucoes.length > 0
            ? Math.max(...this.bancoDados.solucoes.map(s => s.id)) + 1
            : 1;

        try {
            const embedding = await embeddingService.extrairVetorDocumento(problema, solucao);

            await this.qdrant.upsert(config.COLLECTION_NAME, {
                points: [{
                    id: novoId,
                    vector: embedding,
                    payload: {
                        id: novoId,
                        problema,
                        solucao,
                        tags,
                        canal_id: canalId,
                        canal_nome: canalNome
                    }
                }]
            });

            // ✅ Qdrant confirmou sucesso — agora é seguro persistir no JSON
            const novaSolucao = {
                id: novoId,
                palavras_chave: palavrasChave,
                problema,
                solucao,
                tags,
                metadata: {
                    canal_id: canalId,
                    canal_nome: canalNome,
                    total_mensagens: 1,
                    data_export: new Date().toISOString()
                }
            };

            this.bancoDados.solucoes.push(novaSolucao);
            fs.writeFileSync(config.JSON_FILE, JSON.stringify(this.bancoDados, null, 2), 'utf8');

            return novoId;
        } catch (erro) {
            // JSON não foi modificado pois push/writeFileSync estão após o upsert
            registrarLog('ERRO', `Falha ao salvar (JSON e Qdrant permanecem sincronizados): ${erro.message}`);
            return null;
        }
    }

    getTotalSolucoes() {
        return this.bancoDados.solucoes.length;
    }
}

module.exports = new DatabaseService();
