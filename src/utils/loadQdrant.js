const { QdrantClient } = require('@qdrant/js-client-rest');
const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const embeddingService = require('../services/embeddingService');

async function popularQdrant() {
  const COLLECTION_NAME = config.COLLECTION_NAME;
  const DATA_FILE = config.JSON_FILE;

  console.log('🚀 Iniciando população (Fase 1: Geração de Vetores)...');

  try {
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error(`Arquivo não encontrado: ${DATA_FILE}`);
    }

    const dados = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const pontos = [];

    // FASE 1: APENAS IA (Sem Rede)
    console.log(`🧠 Gerando embeddings para ${dados.solucoes.length} itens...`);
    for (let i = 0; i < dados.solucoes.length; i++) {
      const sol = dados.solucoes[i];
      const embedding = await embeddingService.extrairVetorDocumento(sol.problema, sol.solucao);

      pontos.push({
        id: sol.id,
        vector: embedding,
        payload: {
          id: sol.id,
          problema: sol.problema,
          solucao: sol.solucao,
          tags: sol.tags,
          canal_id: sol.metadata?.canal_id || null,
          canal_nome: sol.metadata?.canal_nome || 'Geral'
        }
      });

      if ((i + 1) % 10 === 0 || i === dados.solucoes.length - 1) {
        console.log(`   ✅ Processados: ${i + 1}/${dados.solucoes.length}`);
      }
    }

    // FASE 2: REDE (Apenas Qdrant)
    console.log('\n🚀 Iniciando população (Fase 2: Envio para Qdrant)...');

    const client = new QdrantClient({
      url: 'http://127.0.0.1:6333',
      checkCompatibility: false,
      timeout: 300000
    });

    const collections = await client.getCollections();
    if (collections.collections.find(c => c.name === COLLECTION_NAME)) {
      console.log(`🗑️ Limpando coleção antiga...`);
      await client.deleteCollection(COLLECTION_NAME);
    }

    console.log(`🏗️ Criando coleção...`);
    await client.createCollection(COLLECTION_NAME, {
      vectors: { size: 384, distance: 'Cosine' }
    });

    console.log(`📡 Enviando ${pontos.length} pontos em lotes...`);
    const chunkSize = 5;
    for (let i = 0; i < pontos.length; i += chunkSize) {
      const chunk = pontos.slice(i, i + chunkSize);
      await client.upsert(COLLECTION_NAME, {
        wait: true,
        points: chunk
      });
      console.log(`   📬 Lote ${Math.floor(i / chunkSize) + 1} enviado.`);
      await new Promise(r => setTimeout(r, 500));
    }

    const info = await client.getCollection(COLLECTION_NAME);
    console.log(`\n✨ SUCESSO! Total: ${info.points_count} pontos.`);

  } catch (erro) {
    console.error('\n❌ ERRO FATAL:', erro);
    process.exit(1);
  }
}

popularQdrant();