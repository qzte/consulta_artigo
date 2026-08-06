// Coerência de uma versão publicada.
//
// Publicar uma versão nesta app significa mexer à mão em cinco sítios: o
// cabeçalho e o changelog do index.html, o <title>, a meta description, a
// versão no rodapé, o nome do ficheiro da cópia versionada e o CACHE_NAME do
// service worker. Esquecer um só deles não parte nada de forma visível — o
// pior caso é o CACHE_NAME, em que os dispositivos já instalados continuam a
// servir a versão antiga da cache indefinidamente e a correcção nunca chega a
// quem a precisa. É o tipo de erro que ninguém repara a rever um diff, por
// isso fica aqui.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { lerIndexHtml, lerFicheiro, caminhoRaiz } from './harness.mjs';

const index = lerIndexHtml();
const sw = lerFicheiro('sw.js');

// A versão "verdadeira" é a do cabeçalho do index.html; todo o resto é
// comparado contra ela.
const VERSAO = (() => {
  const m = index.match(/^\s*Consulta de Artigos — v(\d+\.\d+\.\d+)$/m);
  assert.ok(m, 'não encontrei a versão no cabeçalho do index.html');
  return m[1];
})();

test('a versão segue o formato do semver', () => {
  assert.match(VERSAO, /^\d+\.\d+\.\d+$/);
});

test('o changelog começa pela versão actual, marcada como "(atual)"', () => {
  assert.ok(
    index.includes(`  v${VERSAO} (atual)`),
    `o changelog devia ter "v${VERSAO} (atual)" — a entrada nova ou a marca ficaram para trás`
  );
  const atuais = index.match(/^  v\d+\.\d+\.\d+ \(atual\)$/gm) || [];
  assert.equal(atuais.length, 1, 'só uma versão pode estar marcada como "(atual)"');
});

test('o <title> traz a versão actual', () => {
  assert.ok(index.includes(`<title>Consulta de Artigos — v${VERSAO}</title>`), `<title> desalinhado da v${VERSAO}`);
});

test('a meta description traz a versão actual', () => {
  assert.ok(
    index.includes(`content="Consulta de Artigos v${VERSAO} —`),
    `a meta description ficou numa versão anterior à v${VERSAO}`
  );
});

test('o rodapé mostra a versão actual', () => {
  assert.ok(
    index.includes(`<span class="version">v${VERSAO}</span>`),
    `o rodapé ficou numa versão anterior à v${VERSAO}`
  );
});

test('o CACHE_NAME do service worker acompanha a versão', () => {
  // Se isto ficar para trás, quem já tem a app instalada nunca recebe a
  // versão nova: o activate só apaga caches com nome diferente do actual.
  assert.ok(
    sw.includes(`const CACHE_NAME = 'consulta-artigos-v${VERSAO}';`),
    `o CACHE_NAME do sw.js não é o da v${VERSAO} — os dispositivos já instalados ficam presos à versão antiga`
  );
});

test('existe uma só cópia versionada, e é a da versão actual', () => {
  const copias = readdirSync(caminhoRaiz).filter(f => /^consulta_artigos_v.*\.html$/.test(f));
  assert.deepEqual(copias, [`consulta_artigos_v${VERSAO}.html`],
    'a cópia versionada devia ser exactamente uma e corresponder à versão actual');
});

test('a cópia versionada é igual ao index.html', () => {
  // São o mesmo ficheiro com dois nomes. Se divergirem, quem abrir o link
  // versionado leva outra app — e foi uma divergência deste género (o Otsu
  // que nunca corria) que motivou estes testes.
  assert.equal(
    lerFicheiro(`consulta_artigos_v${VERSAO}.html`),
    index,
    `consulta_artigos_v${VERSAO}.html divergiu do index.html — volta a copiá-lo`
  );
});

test('as bibliotecas de CDN vêm em versão fixa, não em "@latest"', () => {
  // "@latest" já partiu o scan uma vez sem nada ter mudado neste repositório
  // (ver changelog da v1.27.0), e o unpkg responde-lhe com um redirect, que o
  // service worker não consegue guardar em cache.
  const tags = index.match(/<script src="https:\/\/[^"]+"/g) || [];
  for (const tag of tags) {
    assert.ok(!tag.includes('@latest'), `biblioteca sem versão fixa: ${tag}`);
    assert.match(tag, /@\d+\.\d+\.\d+/, `biblioteca sem versão fixa: ${tag}`);
  }
});

test('todas as bibliotecas de CDN do index.html estão no precache do service worker', () => {
  // Uma biblioteca que o index.html carrega mas o sw.js não conhece funciona
  // com rede e desaparece sem ela — e o modo offline é metade do sentido
  // desta app num armazém.
  const urls = [...index.matchAll(/<script src="(https:\/\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(urls.length > 0, 'não encontrei bibliotecas de CDN — o teste ficou a olhar para o sítio errado');
  for (const url of urls) {
    assert.ok(sw.includes(url), `${url} não está no PRECACHE_CDN do sw.js`);
  }
});
