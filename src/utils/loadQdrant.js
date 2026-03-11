const { QdrantClient } = require('@qdrant/js-client-rest');
const { pipeline } = require('@xenova/transformers');
const fs = require('fs');

async function popularQdrant() {
  // Configurações Iniciais
  const client = new QdrantClient({ url: 'http://localhost:6333' });
  const COLLECTION_NAME = 'solucoes_inovar';
  const DATA_FILE = 'solutions.json';

  console.log('🚀 Iniciando população otimizada com PESO DE CAMPO...');

  try {
    // 1. AUTO-SETUP: Garante que a coleção existe antes de inserir
    const collections = await client.getCollections();
    const existe = collections.collections.find(c => c.name === COLLECTION_NAME);

    if (!existe) {
      console.log(`🏗️ Criando coleção "${COLLECTION_NAME}" (384 dimensões)...`);
      await client.createCollection(COLLECTION_NAME, {
        vectors: { size: 384, distance: 'Cosine' }
      });
      console.log('✅ Coleção criada com sucesso!');
    }

    // 2. Carregar Modelo de IA (Cérebro do Sistema)
    console.log('🧠 Carregando modelo de IA (multilingual-e5-small)...');
    const extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');

    // 3. Carregar e Processar Dados
    console.log('📚 Carregando dados do arquivo...');
    const dados = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const pontos = [];

    console.log(`🔄 Gerando vetores para ${dados.solucoes.length} itens...`);

    for (const sol of dados.solucoes) {
      // TÉCNICA DE ENGENHARIA: Triplicamos o título para que a IA dê prioridade total a ele.
      // Isso resolve o problema de puxar informações aleatórias do corpo da solução.
      const textoParaVetor = `PROBLEMA: ${sol.problema}. PROBLEMA: ${sol.problema}. PROBLEMA: ${sol.problema}. CONTEÚDO: ${sol.solucao}`;

      const output = await extractor(textoParaVetor, {
        pooling: 'mean',
        normalize: true
      });

      const embedding = Array.from(output.data);

      // Monta o objeto do ponto com metadados para o Discord
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

      console.log(`   🎯 Indexado: ID ${sol.id} - ${sol.problema.substring(0, 30)}...`);
    }

    // 4. Upsert em Lote (Envia tudo de uma vez para o banco)
    console.log('\n📡 Enviando lote completo para o Qdrant...');
    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points: pontos
    });

    // 5. Validação Final
    const info = await client.getCollection(COLLECTION_NAME);
    console.log('\n✨ População concluída com sucesso!');
    console.log(`📊 Total na coleção: ${info.points_count} pontos indexados.`);
    console.log(`🔗 Dashboard: http://localhost:6333/dashboard\n`);

  } catch (erro) {
    console.error('\n❌ Erro fatal durante a população:');
    console.error(erro.message);
    process.exit(1);
  }
}

popularQdrant();