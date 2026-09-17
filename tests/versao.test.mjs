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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

test('a versão do package.json acompanha a do index.html', () => {
  const pkg = JSON.parse(lerFicheiro('package.json'));
  assert.equal(pkg.version, VERSAO, 'o package.json ficou numa versão anterior');
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

test('o index.html não carrega nenhum script de outro domínio', () => {
  // Desde a v1.53.0 não há bibliotecas de CDN nenhumas: o xlsx, o Tesseract,
  // o ZXing e o qrcode são todos ficheiros deste repositório. Este teste é o
  // que impede uma tag de CDN de voltar a entrar sem se dar por ela — e com
  // ela voltariam os três problemas que a mudança resolveu: um terceiro a
  // servir JavaScript com acesso aos ficheiros do armazém, uma rede que
  // bloqueia o domínio a tirar o scan, e a primeira abertura sem rede a
  // falhar.
  const externos = index.match(/<script[^>]+src="(?!\.\/)[^"]*"/g) || [];
  assert.deepEqual(externos, [], 'apareceu um <script> que não é deste repositório');
});

test('as bibliotecas vendorizadas estão embutidas em linha no index.html', () => {
  // Desde que o ficheiro passou a ser aberto também directamente (file://,
  // fora de um servidor), um <script src="./..."> deixa de resolver: o
  // browser bloqueia-o por CORS ou nem sequer o encontra se só o HTML foi
  // descarregado. Por isso as bibliotecas vão coladas dentro de um <script>
  // do próprio index.html, e não apenas referenciadas. Continuam também a
  // existir como ficheiros no repositório — para o VENDOR.md, o precache do
  // sw.js e para se confirmar aqui que a cópia embutida é exactamente igual
  // ao ficheiro vendorizado (senão a embutida podia ficar desactualizada
  // sem ninguém dar por isso).
  const bibliotecas = ['xlsx.full.min.js', 'tesseract.min.js', 'zxing-browser.min.js', 'qrcode.js'];
  for (const nome of bibliotecas) {
    assert.ok(existsSync(join(caminhoRaiz, nome)), `${nome} não existe no repositório`);
    const conteudo = readFileSync(join(caminhoRaiz, nome), 'utf8');
    assert.ok(index.includes(conteudo), `${nome} não está embutido tal e qual num <script> do index.html`);
    assert.ok(sw.includes(`'./${nome}'`), `${nome} não está no PRECACHE_LOCAL do sw.js`);
  }
  const comSrc = index.match(/<script[^>]+src="\.\/(?:xlsx\.full\.min\.js|tesseract\.min\.js|zxing-browser\.min\.js|qrcode\.js)"/);
  assert.equal(comSrc, null, 'uma biblioteca vendorizada continua a ser carregada por <script src="..."> em vez de embutida');
});

test('o worker do Tesseract está embutido em base64 e servido por um blob: URL', () => {
  // Não é carregado pelo index.html com um <script> — é o próprio Tesseract
  // que lhe vai buscar em runtime, pelo workerPath. Um caminho relativo
  // ('./worker.min.js') não é carregável como Worker quando a página é
  // aberta com file://, por isso o ficheiro vai embutido em base64 e é
  // transformado num blob: URL em runtime (ver getWorkerBlobUrl).
  assert.ok(existsSync(join(caminhoRaiz, 'worker.min.js')), 'falta o worker.min.js');
  const workerB64 = readFileSync(join(caminhoRaiz, 'worker.min.js')).toString('base64');
  assert.ok(index.includes(workerB64), 'o worker.min.js embutido no index.html não coincide, em base64, com o ficheiro do repositório');
  assert.ok(sw.includes("'./worker.min.js'"), 'o worker.min.js não está no PRECACHE_LOCAL do sw.js');
  assert.match(index, /workerPath:\s*getWorkerBlobUrl\(\)/, 'o index.html não aponta o Tesseract para o blob: URL do worker embutido');
});

test('as bibliotecas vendorizadas são as versões que os comentários dizem ser', () => {
  // O comentário do index.html diz quais são as versões e como verificá-las
  // com npm pack. Se alguém subir um ficheiro sem corrigir o texto, o
  // próximo a lá ir verifica a versão errada e conclui que está tudo bem.
  assert.match(index, /Tesseract\.js 5\.1\.1 \(Apache-2\.0\) e @zxing\/browser 0\.2\.1 \(MIT\)/);
  assert.match(index, /npm pack tesseract\.js@5\.1\.1/);
});

test('as licenças das bibliotecas vendorizadas acompanham os ficheiros', () => {
  // Vendorizar código de terceiros obriga a trazer a licença junto.
  for (const f of ['tesseract.js-LICENSE.md', 'zxing-browser-LICENSE.txt',
                   'tesseract.min.js.LICENSE.txt', 'worker.min.js.LICENSE.txt']) {
    assert.ok(existsSync(join(caminhoRaiz, f)), `falta ${f}`);
  }
});
