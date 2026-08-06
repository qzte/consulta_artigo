// Regras de negócio da etiqueta impressa (cor, QR e preço).
// Corre contra o index.html publicado — ver harness.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex } from './harness.mjs';

const { corDaEtiqueta, dadosQrEtiqueta, formatarPreco } = carregarDoIndex([
  'corDaEtiqueta',
  'dadosQrEtiqueta',
  'formatarPreco',
]);

// ── corDaEtiqueta ───────────────────────────────────────
//   Stockável = S           → branco
//   Stockável = N + Zona ENC → rosa
//   Stockável = N            → amarelo

test('artigo de stock é branco, independentemente das zonas', () => {
  assert.equal(corDaEtiqueta('S', []), 'branco');
  assert.equal(corDaEtiqueta('S', ['ENC']), 'branco', 'o S manda, mesmo com zona ENC');
});

test('não-stockável com zona ENC é rosa (artigo a pedido)', () => {
  assert.equal(corDaEtiqueta('N', ['ENC']), 'rosa');
  assert.equal(corDaEtiqueta('N', ['ARM', 'ENC']), 'rosa', 'basta uma das zonas ser ENC');
});

test('não-stockável sem zona ENC é amarelo', () => {
  assert.equal(corDaEtiqueta('N', []), 'amarelo');
  assert.equal(corDaEtiqueta('N', ['ARM']), 'amarelo');
});

test('a ordem das regras importa: o rosa é testado antes do amarelo', () => {
  // Se o amarelo fosse testado primeiro, qualquer N caía logo em amarelo e o
  // rosa nunca aparecia.
  assert.equal(corDaEtiqueta('N', ['ENC']), 'rosa');
});

test('maiúsculas, minúsculas e espaços não mudam a decisão', () => {
  assert.equal(corDaEtiqueta(' s ', []), 'branco');
  assert.equal(corDaEtiqueta('n', [' enc ']), 'rosa');
});

test('valores em falta caem no caso não-stockável', () => {
  assert.equal(corDaEtiqueta('', []), 'amarelo');
  assert.equal(corDaEtiqueta(null, null), 'amarelo');
  assert.equal(corDaEtiqueta(undefined, undefined), 'amarelo');
});

test('zonas vazias ou nulas dentro da lista não são confundidas com ENC', () => {
  assert.equal(corDaEtiqueta('N', [null, '', undefined]), 'amarelo');
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
