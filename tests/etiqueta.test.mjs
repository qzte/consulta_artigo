// Regras de negócio da etiqueta impressa (cor, QR e preço).
// Corre contra o index.html publicado — ver harness.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex } from './harness.mjs';

const { corDaEtiqueta, dadosQrEtiqueta, formatarPreco, sgcimDaEtiqueta } = carregarDoIndex([
  'corDaEtiqueta',
  'dadosQrEtiqueta',
  'formatarPreco',
  'sgcimDaEtiqueta',
]);

// ── corDaEtiqueta ───────────────────────────────────────
//   Stockável = S                    → branco
//   Stockável = N + Pedido SGCIM = S → rosa
//   Stockável = N                    → amarelo

test('artigo de stock é branco, independentemente do Pedido SGCIM', () => {
  assert.equal(corDaEtiqueta('S', ''), 'branco');
  assert.equal(corDaEtiqueta('S', 'S'), 'branco', 'o S do Stockável manda, mesmo com Pedido SGCIM = S');
});

test('não-stockável com Pedido SGCIM = S é rosa (artigo a pedido)', () => {
  assert.equal(corDaEtiqueta('N', 'S'), 'rosa');
});

test('não-stockável sem Pedido SGCIM é amarelo', () => {
  assert.equal(corDaEtiqueta('N', ''), 'amarelo');
  assert.equal(corDaEtiqueta('N', 'N'), 'amarelo');
});

test('a ordem das regras importa: o rosa é testado antes do amarelo', () => {
  // Se o amarelo fosse testado primeiro, qualquer N caía logo em amarelo e o
  // rosa nunca aparecia.
  assert.equal(corDaEtiqueta('N', 'S'), 'rosa');
});

test('maiúsculas, minúsculas e espaços não mudam a decisão', () => {
  assert.equal(corDaEtiqueta(' s ', ''), 'branco');
  assert.equal(corDaEtiqueta('n', ' s '), 'rosa');
});

test('valores em falta caem no caso não-stockável', () => {
  assert.equal(corDaEtiqueta('', ''), 'amarelo');
  assert.equal(corDaEtiqueta(null, null), 'amarelo');
  assert.equal(corDaEtiqueta(undefined, undefined), 'amarelo');
});

// ── sgcimDaEtiqueta ─────────────────────────────────────
//   Só o artigo a pedido (cor rosa) leva a inscrição "SGCIM"

test('só a etiqueta rosa (artigo a pedido) traz a inscrição SGCIM', () => {
  assert.equal(sgcimDaEtiqueta('rosa'), 'SGCIM');
});

test('as etiquetas branca e amarela não trazem SGCIM', () => {
  assert.equal(sgcimDaEtiqueta('branco'), '');
  assert.equal(sgcimDaEtiqueta('amarelo'), '');
});

// ── dadosQrEtiqueta ─────────────────────────────────────

test('o QR leva código, posição e supermercado separados por "|"', () => {
  assert.equal(dadosQrEtiqueta('4827516', 'A-12', 'Bloco'), '4827516|A-12|Bloco');
});

test('os campos em falta ficam vazios mas os separadores mantêm-se', () => {
  // A posição dos campos tem de ser estável para quem lê o QR do outro lado.
  assert.equal(dadosQrEtiqueta('4827516', '', 'Bloco'), '4827516||Bloco');
  assert.equal(dadosQrEtiqueta(null, undefined, null), '||');
});

// ── formatarPreco ───────────────────────────────────────

test('o preço sai com vírgula decimal, duas casas e símbolo do euro', () => {
  assert.equal(formatarPreco(1.5), '1,50 €');
  assert.equal(formatarPreco(12), '12,00 €');
  assert.equal(formatarPreco('3.456'), '3,46 €', 'arredonda às duas casas');
  assert.equal(formatarPreco(0), '0,00 €', 'zero é um preço real');
});

test('sem preço mostra-se um travessão, não "NaN"', () => {
  for (const vazio of ['', null, undefined, 'abc', Infinity]) {
    assert.equal(formatarPreco(vazio), '—', `falhou com ${String(vazio)}`);
  }
});
