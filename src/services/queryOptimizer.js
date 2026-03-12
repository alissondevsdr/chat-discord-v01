const config = require('../core/config');
const { registrarLog } = require('../core/logger');
const databaseService = require('./databaseService');
const fetch = require('node-fetch');

class QueryOptimizer {
    constructor() {
        this.urlOllama = config.OLLAMA_URL;
        this.modeloLocal = config.OLLAMA_MODEL;
    }

    async reescreverPergunta(perguntaOriginal) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${this.urlOllama}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modeloLocal,
                    prompt: `Você é especialista em sistemas ERP de gestão comercial.\n\nReescreva a pergunta do usuário para melhorar a busca em uma base de conhecimento do sistema.\n\nREGRAS IMPORTANTES:\n- Preserve a intenção da pergunta.\n- Preserve o verbo de ação (ex: criar, emitir, cadastrar, alterar, consultar).\n- Preserve o contexto de uso dentro do sistema.\n- NÃO transforme a pergunta em definição conceitual.\n- NÃO deixe a pergunta genérica.\n- A pergunta deve continuar parecendo algo que um usuário perguntaria ao suporte do sistema.\n\nResponda com apenas 1 frase curta.\n\nExemplos:\n\nPergunta original: "Como criar SPED?"\nPergunta reescrita: "Como gerar o arquivo SPED no módulo fiscal do sistema?"\n\nPergunta original: "Não consigo emitir nota"\nPergunta reescrita: "Como emitir NF-e no sistema quando ocorre erro na emissão?"\n\nAgora reescreva:\n\nPergunta original: "${perguntaOriginal}"\nPergunta reescrita:`,
                    stream: false,
                    options: { temperature: 0.1, num_predict: 80 }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            const reformulada = (data.response || '').trim();
            if (!reformulada) throw new Error('Ollama retornou resposta vazia');

            registrarLog('INFO', `🔄 Pergunta reformulada: "${reformulada}"`);
            return reformulada;
        } catch (erro) {
            registrarLog('AVISO', `⚠️ Reescrita falhou, usando original: ${erro.message}`);
            return perguntaOriginal;
        }
    }

    async buscarComMultiQuery(pergunta) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${this.urlOllama}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modeloLocal,
                    prompt: `Você é especialista em suporte de sistemas ERP de gestão comercial.\n\nGere 3 variações de busca para a mesma pergunta do usuário.\n\nOBJETIVO:\nMelhorar a busca em uma base de conhecimento do sistema.\n\nREGRAS:\n- Preserve o significado da pergunta original.\n- Preserve o verbo principal da ação (ex: criar, emitir, gerar, cadastrar, importar).\n- Preserve os termos importantes do sistema (ex: NF-e, SPED, cliente, produto, estoque).\n- Não transforme em explicação conceitual.\n- Não responda a pergunta.\n- As variações devem parecer perguntas que um usuário faria ao suporte.\n\nFORMATO:\nRetorne apenas 3 perguntas, uma por linha, sem numeração.\n\nPergunta original: "${pergunta}"\n\nVariações de busca:`,
                    stream: false,
                    options: { temperature: 0.4, num_predict: 150 }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            const responseText = data.response || '';
            const variacoes = [
                pergunta,
                ...responseText.trim().split('\n').filter(l => l.trim()).slice(0, 3)
            ];

            const todosResultados = await Promise.all(
                variacoes.map(v => databaseService.buscarSolucaoIA(v))
            );

            const mapa = new Map();
            todosResultados.flat().forEach(r => {
                if (!mapa.has(r.id) || mapa.get(r.id).score < r.score) {
                    mapa.set(r.id, r);
                }
            });

            return Array.from(mapa.values()).sort((a, b) => b.score - a.score);
        } catch (erro) {
            registrarLog('AVISO', `⚠️ Multi-query falhou, usando busca simples: ${erro.message}`);
            return databaseService.buscarSolucaoIA(pergunta);
        }
    }
}

module.exports = new QueryOptimizer();
