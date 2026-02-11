const fs = require('fs');

const INPUT_FILE = 'solucoes.json';
const OUTPUT_FILE = 'solucoes_limpas.json';

function corrigirEncoding(texto) {
    if (!texto || typeof texto !== 'string') return texto;
    
    // Tenta converter de Latin1 (ISO-8859-1) para UTF-8
    try {
        return Buffer.from(texto, 'latin1').toString('utf8');
    } catch (e) {
        return texto;
    }
}

try {
    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
    const banco = JSON.parse(rawData);

    console.log(`🧹 Iniciando limpeza de ${banco.solucoes.length} itens...`);

    banco.solucoes = banco.solucoes.map(sol => ({
        ...sol,
        problema: corrigirEncoding(sol.problema),
        solucao: corrigirEncoding(sol.solucao),
        palavras_chave: sol.palavras_chave.map(corrigirEncoding),
        tags: sol.tags.map(corrigirEncoding)
    }));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(banco, null, 2), 'utf8');
    console.log(`✅ Sucesso! Base limpa salva em: ${OUTPUT_FILE}`);
    console.log(`👉 Dica: Renomeie o arquivo para o nome usado no seu index.js.`);

} catch (erro) {
    console.error('❌ Erro ao processar arquivo:', erro.message);
}