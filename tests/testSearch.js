
// ===============================
// NORMALIZADOR PROFISSIONAL DE TEXTO
// ===============================
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return texto;

  let t = texto;

  // 1. Tenta corrigir latin1 -> utf8
  try {
    t = Buffer.from(t, 'latin1').toString('utf8');
  } catch {}

  // 2. Remove caracteres inválidos (�)
  t = t.replace(/\uFFFD/g, '');

  // 3. Normaliza espaços
  t = t.replace(/\s+/g, ' ').trim();

  return t;
}

// ===============================
// EMOJI DE FALLBACK POR CONTEXTO
// ===============================
function emojiPorTag(tag) {
  const t = tag.toLowerCase();

  if (t.includes('erro')) return '❌';
  if (t.includes('nfe')) return '🧾';
  if (t.includes('estoque')) return '📦';
  if (t.includes('produto')) return '📦';
  if (t.includes('financeiro')) return '💰';

  return '';
}

const { QdrantClient } = require('@qdrant/js-client-rest');
const { pipeline } = require('@xenova/transformers');

async function testar() {
  const QDRANT_URL = 'http://localhost:6333';
  const COLLECTION_NAME = 'solucoes_inovar';

  const client = new QdrantClient({ url: QDRANT_URL });

  console.log('🧠 Carregando modelo de embeddings...');
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2'
  );
  console.log('✅ Modelo carregado!\n');

  const pergunta = 'inscrição estadual';
  console.log(`🔍 Buscando: "${pergunta}"\n`);

  const output = await extractor(pergunta, {
    pooling: 'mean',
    normalize: true
  });

  const embedding = Array.from(output.data);

  const resultados = await client.search(COLLECTION_NAME, {
    vector: embedding,
    limit: 3
  });

  console.log('📊 Resultados:\n');

  if (resultados.length === 0) {
    console.log('⚠️  Nenhum resultado encontrado.');
    return;
  }

  resultados.forEach((r, i) => {
    const problema = normalizarTexto(r.payload.problema);

    const tags = Array.isArray(r.payload.tags)
      ? r.payload.tags.map(tag => {
          const limpa = normalizarTexto(tag);
          const emoji = emojiPorTag(limpa);
          return emoji ? `${emoji} ${limpa}` : limpa;
        }).join(', ')
      : '—';

    console.log(`${i + 1}. ${problema}`);
    console.log(`   Similaridade: ${r.score.toFixed(3)}`);
    console.log(`   Tags: ${tags}\n`);
  });
}

// ===============================
// EXECUÇÃO
// ===============================
testar().catch((erro) => {
  console.error('\n❌ Erro ao executar teste de busca');
  console.error(erro);
});
