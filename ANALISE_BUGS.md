# Análise Técnica — Bot Discord Inovar Sistemas

> **Origem:** Análise de código como desenvolvedor sênior especialista em IA  
> **Objetivo:** Identificar bugs, problemas e melhorias antes da entrega ao time de suporte  
> **Data:** Março/2026

---

## 🔴 Bugs Críticos — Quebram o bot em produção

### 1. Crash garantido no comando `!analise` — `commandHandler.js`

O comando `!analise` vai crashar sempre que for usado. O método `obterAnaliseCompleta` em `intentionClassifier.js` retorna um objeto com apenas três campos (`mensagem`, `classificacao`, `timestamp`), mas o `commandHandler` tenta acessar `analiseCompleta.validacao`, que simplesmente não existe.

**O objeto retornado por `obterAnaliseCompleta`:**
```javascript
return {
  mensagem,
  classificacao: resposta,  // ← só isso existe
  timestamp: new Date().toISOString()
  // "validacao" não existe aqui
};
```

**O `commandHandler` tenta usar:**
```javascript
const val = analiseCompleta.validacao; // → undefined

// Crash inevitável aqui:
resposta += `📈 **Relevância:** ${(val.scoreRelevancia * 100).toFixed(0)}%\n`;
// TypeError: Cannot read properties of undefined (reading 'scoreRelevancia')
```

**Impacto:** Qualquer membro do time que usar `!analise` vai receber erro ou silêncio do bot.  
**Esforço para corrigir:** 5 minutos — alinhar o objeto retornado com o que o handler espera, ou remover os campos que não existem da exibição.

---

## 🟠 Problemas Graves — Comportamento incorreto silencioso

### 3. Nenhum timeout nas chamadas ao Ollama — `intentionClassifier.js` e `queryOptimizer.js`

Nenhuma das chamadas `fetch` ao Ollama tem timeout configurado:

```javascript
// Sem AbortController, sem timeout — pode ficar pendurado para sempre
const response = await fetch(`${this.urlOllama}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
  // ← nenhum timeout aqui
});
```

O `node-fetch` v2 aceita a opção `timeout` nativamente. Se o Ollama travar processando um prompt longo, a requisição fica suspensa indefinidamente, bloqueando aquele usuário até o processo ser reiniciado.

**Correção sugerida:**
```javascript
const response = await fetch(`${this.urlOllama}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
  timeout: 30000 // 30 segundos
});
```

Aplicar em todos os locais que fazem chamadas ao Ollama: `intentionClassifier.js`, `queryOptimizer.js`, `responseGenerator.js` e `solutionHumanizer.js`.

---

### 4. Catch silencioso no `queryOptimizer.js`

```javascript
} catch {
  // Zero log — falhas no multi-query são completamente invisíveis
  return databaseService.buscarSolucaoIA(pergunta);
}
```

Se o Ollama retornar uma resposta malformada, ou qualquer outro erro ocorrer durante a geração das variações de busca, o sistema cai silenciosamente no fallback sem nenhum registro em log. Em produção, você nunca vai saber que o multi-query está falhando e que as buscas estão sendo feitas sem otimização.

**Correção sugerida:**
```javascript
} catch (erro) {
  registrarLog('AVISO', `⚠️ Multi-query falhou, usando busca simples: ${erro.message}`);
  return databaseService.buscarSolucaoIA(pergunta);
}
```

---

### 5. `!salvar` pode dessincronizar JSON e Qdrant — `databaseService.js`

Existe uma condição de corrida silenciosa no método `salvarNovaSolucao`. Se o `upsert` no Qdrant falhar por qualquer razão (timeout, conexão perdida, etc.), o código captura o erro e retorna `null` — mas antes disso **o JSON já foi salvo com o novo item**:

```javascript
try {
  const embedding = await embeddingService.extrairVetorDocumento(...);
  await this.qdrant.upsert(...); // ← se isso falhar...

  const novaSolucao = { ... };
  this.bancoDados.solucoes.push(novaSolucao);
  fs.writeFileSync(...); // ← ...isso NÃO deveria executar, mas executa
  
  return novoId;
} catch (erro) {
  registrarLog('ERRO', `Falha ao salvar: ${erro.message}`);
  return null; // ← usuário vê "erro", mas JSON foi modificado
}
```

**Resultado:** O JSON fica com um item a mais que não existe no Qdrant. A solução salva nunca aparecerá nas buscas, e a base de dados fica inconsistente.

**Correção:** Mover o `push` e o `writeFileSync` para dentro do bloco `try`, após o `upsert` confirmar sucesso.

---

## 🟡 Problemas Médios — Dívida técnica e estabilidade

### 6. Comparação de string com número no threshold — `messageHandler.js`

```javascript
// toFixed(1) retorna STRING — ex: "87.3", não 87.3
const confianca = (resultados[0].score * 100).toFixed(1);

// JavaScript faz coerção implícita e "funciona por acaso"
// mas é comportamento não intencional
if (this.humanizador && confianca >= (config.THRESHOLD_HUMANIZACAO * 100)) {
```

Funciona hoje por causa da coerção implícita do JavaScript, mas é um bug latente que pode mascarar comportamentos inesperados em edge cases (ex: `"100.0" >= 100` é `true`, mas `"100.0" === 100` é `false`).

**Correção — 1 linha:**
```javascript
const confianca = parseFloat((resultados[0].score * 100).toFixed(1));
```

---

### 7. Sem validação das variáveis de ambiente na inicialização — `index.js`

Se `DISCORD_TOKEN` ou `MODELO_OLLAMA` não estiverem definidos no `.env`, o sistema falha com erros crípticos em pontos aleatórios do código, sem indicar qual variável está faltando.

**Correção sugerida — adicionar no início de `iniciarSistema()`:**
```javascript
const required = ['DISCORD_TOKEN', 'MODELO_OLLAMA'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Variável de ambiente obrigatória não definida: ${key}`);
    process.exit(1);
  }
}
```

---

### 8. Triplicação do problema no embedding — `embeddingService.js`

```javascript
const textoParaVetor = `passage: PROBLEMA: ${problema}. PROBLEMA: ${problema}. PROBLEMA: ${problema}. CONTEÚDO: ${solucao}`;
```

Essa abordagem tenta dar mais peso ao título repetindo-o três vezes, mas o modelo `multilingual-e5-small` opera sobre representação semântica — não sobre frequência de tokens. O efeito pode ser uma distorção no espaço vetorial, especialmente em soluções com texto longo, onde a repetição pode "comprimir" o vetor em uma direção não desejada.

**Alternativa mais efetiva para o modelo E5:**
```javascript
const textoParaVetor = `passage: ${problema}. Solução: ${solucao}`;
```

O prefixo `passage:` já sinaliza ao modelo que é um documento para indexação. A repetição é redundante e potencialmente prejudicial.

---

### 9. Código morto que pode confundir manutenção futura

Três arquivos existem no projeto mas nunca são utilizados:

| Arquivo | Situação |
|---|---|
| `src/modules/events/ready.js` | Nunca registrado como evento |
| `src/services/ollamaService.js` | Nunca importado em nenhum módulo |
| `src/utils/validators/configValidator.js` | Mencionado no TASKS.md mas nunca implementado |

O `ready.js` é o mais perigoso: se alguém tentar "ativar" esse evento no futuro sem entender a arquitetura atual, vai ter dois handlers conflitando sem erro explícito.

**Sugestão:** Ou remover os arquivos, ou adicionar um comentário claro indicando que são rascunhos/planejamento futuro.

---

### 10. Sem rate limiting por usuário — `messageHandler.js`

Cada mensagem recebida pode acionar até 5 chamadas ao Ollama em sequência:

1. Classificação de intenção
2. Reescrita da pergunta
3. Geração de 3 variações (multi-query)
4. 4 buscas no Qdrant (em paralelo)
5. Humanização da resposta

Se dois ou três membros do time enviarem mensagens ao mesmo tempo, o Ollama local pode ficar sobrecarregado, aumentando a latência para todos. Em modelos maiores (7B+), cada chamada pode levar vários segundos.

**Sugestão simples para MVP:**
```javascript
// Map de usuário → timestamp da última mensagem
const cooldowns = new Map();
const COOLDOWN_MS = 3000; // 3 segundos entre mensagens

const agora = Date.now();
const ultimo = cooldowns.get(message.author.id) || 0;
if (agora - ultimo < COOLDOWN_MS) {
  await message.reply('⏳ Aguarde um momento antes de enviar outra mensagem.');
  return;
}
cooldowns.set(message.author.id, agora);
```

---

## 📋 Resumo — Ordem de execução recomendada

| Prioridade | Problema | Esforço | Arquivo |
|---|---|---|---|
| 🔴 Urgente | Crash no `!analise` (val undefined) | 5 min | `commandHandler.js` |
| 🟠 Alta | Todas as chamadas Ollama sem timeout | 15 min | múltiplos arquivos |
| 🟠 Alta | Catch silencioso no multi-query | 2 min | `queryOptimizer.js` |
| 🟠 Alta | `!salvar` dessincroniza JSON/Qdrant | 10 min | `databaseService.js` |
| 🟡 Média | `confianca` como string na comparação | 1 linha | `messageHandler.js` |
| 🟡 Média | Validação de variáveis de ambiente | 10 min | `index.js` |
| 🟡 Média | Triplicação no embedding | 1 linha | `embeddingService.js` |
| 🟡 Baixa | Remover arquivos de código morto | 5 min | `ready.js`, `ollamaService.js` |
| 🔵 Backlog | Rate limiting por usuário | 30 min | `messageHandler.js` |

---

> **Nota:** O bug mais crítico para corrigir **antes de entregar ao time** é o crash do `!analise`, pois é um comando de demonstração e vai quebrar na frente de todos. O segundo passo é adicionar timeouts no Ollama para que uma lentidão pontual não trave o bot inteiro para todos os usuários.
