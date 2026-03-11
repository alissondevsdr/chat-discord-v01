# TASKS — Correções e Melhorias do Bot Inovar

> **Status:** Pendente  
> **Origem:** Análise técnica sênior do código-fonte  
> **Arquivos principais afetados:** `src/index.js`, `src/modules/support/analyzers/messageAnalyzer.js`, `src/modules/support/generators/solutionHumanizer.js`, `src/modules/support/analyzers/intentionClassifier.js`, `.env.example`

---

## TASK 01 — Corrigir evento de inicialização do bot

**Problema:** O evento `clientReady` não existe no discord.js v14. O evento correto é `ready`. Como resultado, `prepararIA()` nunca é executada, `extractor` permanece `undefined` e toda busca vetorial falha silenciosamente.

**Arquivo:** `src/index.js`

**Antes:**
```javascript
client.once('clientReady', async () => {
  await prepararIA();
  registrarLog('INFO', `✅ Bot conectado como ${client.user.tag}`);
});
```

**Depois:**
```javascript
client.once('ready', async () => {
  await prepararIA();
  registrarLog('INFO', `✅ Bot conectado como ${client.user.tag}`);
});
```

---

## TASK 02 — Corrigir bug de `substring` com índice negativo

**Problema:** Em JavaScript, `String.prototype.substring(-n)` trata qualquer índice negativo como `0`, retornando a string inteira. O comportamento esperado (últimos N caracteres) exige `slice(-n)`. A detecção de rimas/poesia nunca funcionou por isso.

**Arquivo:** `src/modules/support/analyzers/messageAnalyzer.js`

**Antes:**
```javascript
_extrairRima(linha) {
  const palavras = linha.trim().toLowerCase().split(/\s+/);
  if (palavras.length === 0) return null;
  return palavras[palavras.length - 1].substring(-3);
}

_saoParecidas(palavra1, palavra2) {
  if (!palavra1 || !palavra2) return false;
  return palavra1.substring(-2) === palavra2.substring(-2);
}
```

**Depois:**
```javascript
_extrairRima(linha) {
  const palavras = linha.trim().toLowerCase().split(/\s+/);
  if (palavras.length === 0) return null;
  return palavras[palavras.length - 1].slice(-3);
}

_saoParecidas(palavra1, palavra2) {
  if (!palavra1 || !palavra2) return false;
  return palavra1.slice(-2) === palavra2.slice(-2);
}
```

---

## TASK 03 — Trocar modelo de embedding para multilingual

**Problema:** O modelo `Xenova/all-MiniLM-L6-v2` foi treinado predominantemente em inglês. Toda a base de conhecimento está em português, o que resulta em vetores de baixa qualidade e buscas imprecisas. É a causa raiz do bot "errar" nas buscas.

**Atenção:** Após trocar o modelo é **obrigatório** recriar a coleção no Qdrant e repopular com `node src/utils/loadQdrant.js`. O tamanho do vetor muda de 384 para 384 (multilingual-MiniLM) ou 768 (multilingual-L12) — confirme o tamanho certo antes de criar a coleção.

**Arquivos:** `src/index.js` e `src/utils/loadQdrant.js`

**Antes (nos dois arquivos):**
```javascript
extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
```

**Depois (nos dois arquivos):**
```javascript
// Opção A — mais leve, boa qualidade (recomendado para começar)
extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');

// Opção B — mais pesado, melhor qualidade
// extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
```

**Também atualizar** o `loadQdrant.js` na criação da coleção para o tamanho correto do vetor:
```javascript
// multilingual-e5-small usa 384 dimensões — mesmo tamanho, sem alterar
// paraphrase-multilingual-MiniLM-L12-v2 usa 384 dimensões — também sem alterar

await client.createCollection(COLLECTION_NAME, {
  vectors: { size: 384, distance: 'Cosine' }
});
```

> **Nota:** Ambas as opções mantêm 384 dimensões, então a coleção não precisa ser recriada do zero — mas os vetores precisam ser regenerados (repopular o Qdrant) pois os embeddings são diferentes.

---

## TASK 04 — Refatorar `index.js` (arquivo Deus)

**Problema:** O `index.js` tem 280 linhas misturando configuração do Discord, conexão com Qdrant, inicialização de IA, sistema de logs, leitura de banco de dados, processamento de mensagens e comandos. Existe uma estrutura modular criada (`src/modules/`, `src/services/`) que nunca é usada. Os arquivos abaixo são **código morto** e devem ser removidos ou aproveitados:

- `src/modules/events/messageCreate.js` — nunca registrado
- `src/modules/events/ready.js` — nunca registrado
- `src/services/ollamaService.js` — nunca importado
- `src/utils/validators/configValidator.js` — nunca importado

**Estrutura proposta após refatoração:**

```
src/
├── index.js                    ← apenas bootstrap (30 linhas)
├── core/
│   ├── config.js               ← já existe, expandir
│   └── logger.js               ← extrair registrarLog() de index.js
├── database/
│   └── solutionStore.js        ← extrair bancoDados + salvarNovaSolucao()
├── modules/
│   └── support/
│       ├── analyzers/
│       │   ├── intentionClassifier.js  ← já existe
│       │   └── messageAnalyzer.js      ← já existe
│       └── generators/
│           ├── responseGenerator.js    ← já existe
│           └── solutionHumanizer.js    ← já existe
├── services/
│   ├── qdrantService.js        ← extrair buscarSolucaoIA() de index.js
│   ├── ollamaService.js        ← já existe, conectar ao fluxo real
│   └── embeddingService.js     ← extrair prepararIA() + extractor
└── handlers/
    ├── commandHandler.js       ← extrair processarComando() de index.js
    └── supportHandler.js       ← extrair processarSuporte() de index.js
```

**`src/index.js` após refatoração (deve ficar assim):**
```javascript
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { prepararIA } = require('./services/embeddingService');
const { processarMensagem } = require('./handlers/supportHandler');
const logger = require('./core/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('ready', async () => {
  await prepararIA();
  logger.info(`✅ Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const isDM = message.channel.type === 1;
  if (!isDM) {
    try { await message.author.send('👋 Me manda sua dúvida aqui no privado!'); } catch {}
    return;
  }

  await processarMensagem(message, client);
});

client.login(process.env.DISCORD_TOKEN);
```

---

## TASK 05 — Corrigir `.env.example` com valor malformado

**Problema:** `THRESHOLD_RELACIONADAS=0.` resulta em `NaN` quando lido pelo `parseFloat()`. Comparações com `NaN` são sempre `false` em JavaScript — nenhuma solução relacionada é exibida nunca.

**Arquivo:** `.env.example`

**Antes:**
```env
THRESHOLD_RELACIONADAS=0.
```

**Depois:**
```env
THRESHOLD_RELACIONADAS=0.40
```

---

## TASK 06 — Implementar suporte a DM (conversa privada)

**Problema:** O bot hoje só responde dentro de um canal específico (`CANAL_SUPORTE_ID`). O objetivo é migrar para conversas privadas (DM), onde cada colaborador abre uma conversa individual com o bot.

**Arquivo:** `src/index.js`

**Passo 1 — Adicionar intents de DM no client:**
```javascript
// Antes
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Depois
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,       // ← novo
    GatewayIntentBits.DirectMessageTyping,  // ← novo
  ],
  partials: [Partials.Channel, Partials.Message], // ← obrigatório para DMs
});
```

**Passo 2 — Substituir o filtro do evento `messageCreate`:**
```javascript
// Antes
client.on('messageCreate', async (message) => {
  if (message.author.bot || message.channel.id !== process.env.CANAL_SUPORTE_ID) return;
  await processarMensagem(message);
});

// Depois
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const isDM = message.channel.type === 1; // ChannelType.DM = 1

  if (!isDM) {
    // Se o usuário escrever em algum canal do servidor, instrui a usar DM
    try {
      await message.author.send(
        '👋 Oi! Para dúvidas sobre o sistema, me manda uma mensagem aqui no privado. Estou pronto para ajudar!'
      );
    } catch {
      // Usuário pode ter DMs desabilitadas — ignora silenciosamente
    }
    return;
  }

  await processarMensagem(message);
});
```

**Passo 3 — Remover do `.env` e `.env.example`:**
```env
# Remover esta linha — não é mais utilizada
CANAL_SUPORTE_ID=
```

**Como o usuário inicia a conversa:**
No Discord, basta clicar no nome do bot e selecionar "Enviar Mensagem". A partir daí toda a conversa acontece no privado, igual a um chat 1:1.

---

## TASK 07 — Usar Ollama para análise de categorias e reescrita de pergunta

**Problema:** O Ollama hoje só atua no final do fluxo para humanizar a resposta já encontrada. A classificação de intenções usa apenas regex e listas de palavras-chave hard-coded — frágil e limitado. A busca vetorial recebe a pergunta exatamente como o usuário digitou, sem nenhuma otimização semântica.

**Objetivo desta task:** Usar Ollama em dois pontos críticos do fluxo:
1. **Classificação de intenção** — substituir regex por IA
2. **Reescrita da pergunta** — reformular antes de buscar no Qdrant

---

### Parte A — Classificação de intenção via Ollama

**Arquivo:** `src/modules/support/analyzers/intentionClassifier.js`

Criar método `classificarComOllama()` que substitui a lógica de regex:

```javascript
async classificarComOllama(mensagem) {
  const prompt = `Você é um classificador de mensagens para suporte técnico de um sistema ERP chamado Inovar Sistemas.

Classifique a mensagem abaixo em UMA das categorias:
- SAUDACAO: cumprimentos, agradecimentos, despedidas
- SUPORTE: dúvidas, problemas, erros sobre o sistema Inovar
- OFF_TOPIC: assuntos sem relação com o sistema (política, esportes, entretenimento, etc)
- VAGO: mensagem muito curta ou sem contexto suficiente para entender
- COMANDO: começa com "!" (ex: !ajuda, !listar)

Responda APENAS com um JSON no formato:
{"tipo": "CATEGORIA", "confianca": 0.0, "motivo": "explicação curta"}

Mensagem: "${mensagem}"`;

  try {
    const response = await fetch(`${this.urlOllama}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelo,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 100 }
      })
    });

    const data = await response.json();
    const texto = data.response.trim();

    // Remove possíveis blocos de código markdown
    const jsonLimpo = texto.replace(/```json|```/g, '').trim();
    const resultado = JSON.parse(jsonLimpo);

    return {
      tipo: resultado.tipo || 'INDEFINIDO',
      confianca: resultado.confianca || 0.7,
      descricao: resultado.motivo || '',
      fonte: 'OLLAMA'
    };
  } catch (erro) {
    // Fallback para classificação por regex se Ollama falhar
    console.warn(`⚠️ Ollama indisponível para classificação: ${erro.message}`);
    return this.classificar(mensagem); // método existente com regex
  }
}
```

**Atualizar `classificarComResposta()` para usar o novo método quando Ollama estiver disponível:**
```javascript
async classificarComResposta(mensagem) {
  const validacao = this.validadorContexto.validar(mensagem);
  const acao = this.validadorContexto.sugerirAcao(validacao);

  // Usa Ollama se disponível, senão cai no regex
  const classificacao = this.ollamaDisponivel
    ? await this.classificarComOllama(mensagem)
    : this.classificar(mensagem);

  // ... resto do método igual ao atual
}
```

---

### Parte B — Reescrita da pergunta antes da busca

**Arquivo:** `src/index.js` (ou `src/handlers/supportHandler.js` após refatoração)

Criar função `reescreverPergunta()` e integrá-la ao fluxo de suporte:

```javascript
async function reescreverPergunta(perguntaOriginal) {
  try {
    const response = await fetch(`${process.env.URL_OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.MODELO_OLLAMA,
        prompt: `Você é especialista em sistemas ERP de gestão comercial.
Reformule a pergunta abaixo em linguagem técnica, em 1-2 frases objetivas.
Não responda a pergunta, apenas reformule-a.

Pergunta original: "${perguntaOriginal}"
Pergunta reformulada:`,
        stream: false,
        options: { temperature: 0.1, num_predict: 80 }
      })
    });

    const data = await response.json();
    const reformulada = data.response.trim();

    registrarLog('INFO', `🔄 Pergunta reformulada: "${reformulada}"`);
    return reformulada;
  } catch (erro) {
    registrarLog('AVISO', `⚠️ Reescrita falhou, usando original: ${erro.message}`);
    return perguntaOriginal; // fallback seguro
  }
}
```

**Integrar no fluxo `processarSuporte()`:**
```javascript
async function processarSuporte(message) {
  // Reescrever antes de buscar
  const perguntaOtimizada = await reescreverPergunta(message.content);

  // Busca com a pergunta otimizada (mantém fallback para original)
  const resultados = await buscarSolucaoIA(perguntaOtimizada);

  // ... resto do fluxo igual ao atual
}
```

---

### Parte C — Multi-query (opcional, melhora significativa)

Busca com 3 variações da pergunta e retorna o resultado com maior score:

```javascript
async function buscarComMultiQuery(pergunta) {
  try {
    const response = await fetch(`${process.env.URL_OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.MODELO_OLLAMA,
        prompt: `Gere 3 formas diferentes de perguntar sobre o mesmo problema de sistema ERP.
Responda apenas com as 3 perguntas, uma por linha, sem numeração.

Pergunta original: "${pergunta}"`,
        stream: false,
        options: { temperature: 0.4, num_predict: 150 }
      })
    });

    const data = await response.json();
    const variacoes = [
      pergunta,
      ...data.response.trim().split('\n').filter(l => l.trim()).slice(0, 3)
    ];

    // Busca paralela com todas as variações
    const todosResultados = await Promise.all(
      variacoes.map(v => buscarSolucaoIA(v))
    );

    // Junta, remove duplicatas por ID e ordena por score
    const mapa = new Map();
    todosResultados.flat().forEach(r => {
      if (!mapa.has(r.id) || mapa.get(r.id).score < r.score) {
        mapa.set(r.id, r);
      }
    });

    return Array.from(mapa.values()).sort((a, b) => b.score - a.score);
  } catch {
    return buscarSolucaoIA(pergunta); // fallback
  }
}
```

**Fluxo completo com todas as melhorias:**
```
Mensagem do usuário
       ↓
classificarComOllama()    ← TASK 07A
       ↓ (se SUPORTE)
reescreverPergunta()      ← TASK 07B
       ↓
buscarComMultiQuery()     ← TASK 07C (opcional)
       ↓
humanizar()               ← já existe
       ↓
Resposta ao usuário
```

---

## TASK 08 — Corrigir cache do humanizador sem limite automático

**Problema:** O método `limparCache()` existe mas nunca é chamado automaticamente. O cache cresce indefinidamente em memória durante toda a execução do bot.

**Arquivo:** `src/modules/support/generators/solutionHumanizer.js`

**Antes:**
```javascript
async humanizar(solucaoOriginal, perguntaUsuario) {
  const tempoInicio = Date.now();
  const chave = this._gerarChave(solucaoOriginal.id, perguntaUsuario);

  if (this.cache.has(chave)) {
    console.log(`📄 Cache hit para solução #${solucaoOriginal.id}`);
    return this.cache.get(chave);
  }
  // ...
}
```

**Depois — adicionar verificação de limite no início do método:**
```javascript
async humanizar(solucaoOriginal, perguntaUsuario) {
  const tempoInicio = Date.now();

  // Limpeza automática antes de verificar cache
  const limiteCache = parseInt(process.env.LIMITE_CACHE) || 1000;
  if (this.cache.size >= limiteCache) {
    this.limparCache(Math.floor(limiteCache * 0.8)); // mantém 80% ao limpar
    console.log(`🧹 Cache auto-limpado. Novo tamanho: ${this.cache.size}`);
  }

  const chave = this._gerarChave(solucaoOriginal.id, perguntaUsuario);

  if (this.cache.has(chave)) {
    console.log(`📄 Cache hit para solução #${solucaoOriginal.id}`);
    return this.cache.get(chave);
  }
  // ... resto do método igual
}
```

**Verificar que `LIMITE_CACHE` está no `.env.example` (já está):**
```env
LIMITE_CACHE=1000
```

---

## Ordem de execução recomendada

| Prioridade | Task | Impacto | Esforço |
|------------|------|---------|---------|
| 🔴 1 | TASK 01 — Evento `ready` | Bot não funciona sem isso | 1 linha |
| 🔴 2 | TASK 05 — `.env` malformado | Soluções relacionadas nunca aparecem | 1 linha |
| 🔴 3 | TASK 02 — `substring` → `slice` | Detecção de spam nunca funcionou | 2 linhas |
| 🟠 4 | TASK 03 — Modelo multilingual | Qualidade da busca melhora muito | Repopular Qdrant |
| 🟠 5 | TASK 06 — Suporte a DM | Funcionalidade nova solicitada | ~20 linhas |
| 🟠 6 | TASK 07 — Ollama no fluxo | Inteligência real na busca | ~80 linhas |
| 🟡 7 | TASK 08 — Cache com limite | Estabilidade em produção | ~5 linhas |
| 🟡 8 | TASK 04 — Refatorar index.js | Manutenibilidade | Sprint separada |
