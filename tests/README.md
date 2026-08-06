# Testes

```sh
npm test                        # todos os testes
node --test tests/ocr-helpers.test.mjs   # um ficheiro só
node tests/verificar-sintaxe.mjs         # só a verificação de sintaxe
```

Não há nada a instalar: a app não tem dependências e os testes usam só o
test runner que já vem com o Node (>= 20). O CI (`.github/workflows/ci.yml`)
corre o mesmo em cada push e pull request.

## Como estão montados

A app é um único `index.html` sem build nem módulos, por isso não há `import`
que se lhe faça. O `harness.mjs` extrai do ficheiro **publicado** as funções
pedidas, pelo nome, e avalia-as — os testes correm contra o código que vai
mesmo para o ar.

Isto é de propósito e não por falta de melhor. A prática anterior era manter
uma cópia das funções dentro do ficheiro de teste ("testado isoladamente
antes de ser copiado para aqui", como diziam os comentários do `index.html`),
e foi ela que deixou passar a avaria do OCR corrigida na v1.35.0: o cálculo
do limiar estava certo e testado, mas quem o chamava passava-lhe um valor
fixo que o anulava. Um teste sobre uma cópia nunca vê isso.

Se uma função for renomeada ou apagada, o `harness.mjs` rebenta com o nome em
falta em vez de deixar o teste passar sobre o vazio.

## O que está coberto

| Ficheiro | O quê |
|---|---|
| `ocr-helpers.test.mjs` | Leitura do código pela câmara: recorte da moldura, limiar de preto-e-branco (Otsu), extracção de dígitos, confirmação por duas leituras seguidas |
| `caixas-por-servico.test.mjs` | Agregação e filtragem das caixas por serviço, totais por supermercado |
| `etiqueta.test.mjs` | Regras da etiqueta impressa: cor por stockável/zona, conteúdo do QR, formato do preço |
| `sort-supermercados.test.mjs` | Ordenação alfabética dos supermercados |
| `versao.test.mjs` | Coerência de uma versão publicada (ver abaixo) |
| `verificar-sintaxe.mjs` | O `<script>` do `index.html` e o `sw.js` compilam |

O `versao.test.mjs` existe porque publicar uma versão significa mexer à mão em
sete sítios (cabeçalho, changelog, `<title>`, meta description, rodapé, nome
da cópia versionada e `CACHE_NAME` do `sw.js`). Esquecer um não parte nada de
forma visível — no pior caso, o do `CACHE_NAME`, quem tem a app instalada fica
preso à versão antiga e a correcção nunca lhe chega.

## O que **não** está coberto

- Tudo o que precisa de browser: câmara, IndexedDB, service worker, impressão
  e o render em si. Não há aqui browser nenhum.
- A leitura de OCR de ponta a ponta com o Tesseract. Os testes cobrem a
  preparação da imagem — que era onde estava a avaria — e não o motor.
- A leitura de códigos de barras (ZXing).
- O processamento dos ficheiros Excel.

Ao mexer nestas partes, contar com teste manual no telemóvel.

## Acrescentar um teste

Pedir as funções ao harness pelo nome e escrever o teste normalmente:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex } from './harness.mjs';

const { aFuncao } = carregarDoIndex(['aFuncao']);

test('descrição do que se espera', () => {
  assert.equal(aFuncao('entrada'), 'saída');
});
```

Só funciona com declarações de nível superior (`function x(` ou `const x =`
começados na coluna 0). Uma função enterrada dentro de outra tem de ser
puxada para fora primeiro.

Ao corrigir um defeito, vale a pena confirmar que o teste novo **falha**
contra o código avariado antes de o dar por feito — um teste que passa nas
duas versões não protege de nada.
