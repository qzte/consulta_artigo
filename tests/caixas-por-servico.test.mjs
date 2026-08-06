// Agregação e filtragem das caixas por serviço (índice de Serviço).
// Corre contra o index.html publicado — ver harness.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex } from './harness.mjs';

const {
  aggregateCaixasPorServico,
  caixasDoServico,
  totaisPorSupermercado,
  maiorTotalSupermercado,
} = carregarDoIndex([
  'aggregateCaixasPorServico',
  'caixasDoServico',
  'totaisPorSupermercado',
  'maiorTotalSupermercado',
]);

const linha = (tipoCx, servNome, qtdTotal, superNome = 'Super A') => ({ tipoCx, servNome, qtdTotal, superNome });

// ── aggregateCaixasPorServico ───────────────────────────

test('linhas repetidas do mesmo par (tipo, serviço) colapsam numa só', () => {
  const saida = aggregateCaixasPorServico([
    linha('CX1', 'Bloco', 5),
    linha('CX1', 'Bloco', 9),
    linha('CX1', 'Bloco', 3),
  ]);
  assert.equal(saida.length, 1);
  assert.equal(saida[0].qtdTotal, 9, 'fica a de maior Quantidade Total');
});

test('o mesmo tipo de caixa em serviços diferentes não é colapsado', () => {
  const saida = aggregateCaixasPorServico([linha('CX1', 'Bloco', 5), linha('CX1', 'Cirurgia', 2)]);
  assert.equal(saida.length, 2);
});

test('tipos de caixa diferentes no mesmo serviço não são colapsados', () => {
  const saida = aggregateCaixasPorServico([linha('CX1', 'Bloco', 5), linha('CX2', 'Bloco', 2)]);
  assert.equal(saida.length, 2);
});

test('quantidades em falta ou não numéricas contam como zero', () => {
  const saida = aggregateCaixasPorServico([
    linha('CX1', 'Bloco', undefined),
    linha('CX1', 'Bloco', 'abc'),
    linha('CX1', 'Bloco', 4),
  ]);
  assert.equal(saida.length, 1);
  assert.equal(saida[0].qtdTotal, 4);
});

test('quantidades em texto são comparadas como número, não como texto', () => {
  // Como texto, '9' > '10'. Tem de ganhar o 10.
  const saida = aggregateCaixasPorServico([linha('CX1', 'Bloco', '9'), linha('CX1', 'Bloco', '10')]);
  assert.equal(saida[0].qtdTotal, '10');
});

test('lista vazia devolve lista vazia', () => {
  assert.deepEqual(aggregateCaixasPorServico([]), []);
});

// ── caixasDoServico ─────────────────────────────────────

test('só ficam as caixas do serviço pedido', () => {
  const agregadas = [linha('CX1', 'Bloco', 5), linha('CX2', 'Cirurgia', 3), linha('CX3', 'Bloco', 1)];
  assert.deepEqual(caixasDoServico(agregadas, 'Bloco').map(c => c.tipoCx), ['CX1', 'CX3']);
});

test('um serviço sem caixas devolve lista vazia', () => {
  assert.deepEqual(caixasDoServico([linha('CX1', 'Bloco', 5)], 'Anestesia'), []);
});

// ── totaisPorSupermercado / maiorTotalSupermercado ──────

test('os totais são somados por supermercado', () => {
  const totais = totaisPorSupermercado([
    linha('CX1', 'Bloco', 5, 'Super A'),
    linha('CX2', 'Bloco', 3, 'Super A'),
    linha('CX1', 'Bloco', 7, 'Super B'),
  ]);
  assert.deepEqual({ ...totais }, { 'Super A': 8, 'Super B': 7 });
});

test('o maior total é o do supermercado com mais caixas', () => {
  const maior = maiorTotalSupermercado({ 'Super A': 8, 'Super B': 12, 'Super C': 3 });
  assert.equal(maior.nome, 'Super B');
  assert.equal(maior.valor, 12);
});

test('sem totais nenhuns não há maior — devolve null em vez de um vazio', () => {
  assert.equal(maiorTotalSupermercado({}), null);
});

test('um total de zero conta como resultado válido', () => {
  const maior = maiorTotalSupermercado({ 'Super A': 0 });
  assert.notEqual(maior, null, 'zero é um total real, não a ausência de total');
  assert.equal(maior.valor, 0);
});
