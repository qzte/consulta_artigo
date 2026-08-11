// Destaque, na ficha de Serviço, do artigo selecionado na tab "Artigos".
// Corre contra o index.html publicado — ver harness.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex } from './harness.mjs';

const { destacarArtigoNaLista } = carregarDoIndex(['destacarArtigoNaLista']);

const cods = lista => lista.map(a => a.cod);

test('põe o artigo indicado em primeiro lugar', () => {
  const entrada = [{ cod: 'A' }, { cod: 'B' }, { cod: 'C' }];
  assert.deepEqual(cods(destacarArtigoNaLista(entrada, 'C')), ['C', 'A', 'B']);
});

test('mantém a ordem relativa dos restantes artigos', () => {
  const entrada = [{ cod: 'A' }, { cod: 'B' }, { cod: 'C' }, { cod: 'D' }];
  assert.deepEqual(cods(destacarArtigoNaLista(entrada, 'C')), ['C', 'A', 'B', 'D']);
});

test('já em primeiro lugar: devolve a lista tal como veio', () => {
  const entrada = [{ cod: 'A' }, { cod: 'B' }];
  assert.deepEqual(destacarArtigoNaLista(entrada, 'A'), entrada);
});

test('sem código (null): devolve a lista tal como veio', () => {
  const entrada = [{ cod: 'A' }, { cod: 'B' }];
  assert.deepEqual(destacarArtigoNaLista(entrada, null), entrada);
});

test('código que não existe na lista: devolve a lista tal como veio', () => {
  const entrada = [{ cod: 'A' }, { cod: 'B' }];
  assert.deepEqual(destacarArtigoNaLista(entrada, 'Z'), entrada);
});

test('lista vazia não é caso especial', () => {
  assert.deepEqual(destacarArtigoNaLista([], 'A'), []);
});

test('não altera a lista recebida', () => {
  const entrada = [{ cod: 'A' }, { cod: 'B' }, { cod: 'C' }];
  const original = [...entrada];
  destacarArtigoNaLista(entrada, 'C');
  assert.deepEqual(entrada, original, 'a lista de origem tem de ficar intacta');
});
