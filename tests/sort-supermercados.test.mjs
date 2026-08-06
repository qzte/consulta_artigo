// Ordenação alfabética dos supermercados na ficha de artigo.
// Corre contra o index.html publicado — ver harness.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex } from './harness.mjs';

const { ordenarSupermercadosAlfabeticamente } = carregarDoIndex([
  'ordenarSupermercadosAlfabeticamente',
]);

const nomes = lista => lista.map(s => s.nome);

test('ordena por nome', () => {
  const entrada = [{ nome: 'Cirurgia' }, { nome: 'Bloco' }, { nome: 'Anestesia' }];
  assert.deepEqual(nomes(ordenarSupermercadosAlfabeticamente(entrada)), ['Anestesia', 'Bloco', 'Cirurgia']);
});

test('ignora maiúsculas e acentos (localeCompare pt)', () => {
  const entrada = [{ nome: 'ática' }, { nome: 'Ala' }, { nome: 'ÁGUAS' }];
  assert.deepEqual(nomes(ordenarSupermercadosAlfabeticamente(entrada)), ['ÁGUAS', 'Ala', 'ática']);
});

test('não altera a lista recebida', () => {
  const entrada = [{ nome: 'Cirurgia' }, { nome: 'Bloco' }];
  const original = [...entrada];
  ordenarSupermercadosAlfabeticamente(entrada);
  assert.deepEqual(entrada, original, 'a lista de origem tem de ficar intacta');
});

test('listas vazias e de um só elemento não são caso especial', () => {
  assert.deepEqual(ordenarSupermercadosAlfabeticamente([]), []);
  assert.deepEqual(nomes(ordenarSupermercadosAlfabeticamente([{ nome: 'Bloco' }])), ['Bloco']);
});

test('números dentro do nome ordenam como texto, sem rebentar', () => {
  const entrada = [{ nome: 'Piso 10' }, { nome: 'Piso 2' }];
  assert.equal(ordenarSupermercadosAlfabeticamente(entrada).length, 2);
});
