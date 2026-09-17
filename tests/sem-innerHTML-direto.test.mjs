// Impede que volte a aparecer um "algo.innerHTML = ..." fora de setHTML().
//
// A app escapa tudo o que vem de dados com escHtml() antes de o meter em
// innerHTML — mas nada obrigava a isso: bastava alguém escrever um
// "container.innerHTML = ..." novo e esquecer-se do escHtml() numa das
// partes para abrir um XSS. setHTML() não resolve isso sozinho (quem lhe
// chama continua responsável por escapar os dados), mas dá um sítio único
// a rever sempre que se mexe em quem escreve HTML na página. Este teste é o
// que impede um innerHTML direto de voltar a aparecer sem se dar por isso.

import test from 'node:test';
import assert from 'node:assert/strict';
import { lerIndexHtml } from './harness.mjs';

const index = lerIndexHtml();

// Código próprio da app: o último <script> do ficheiro (os anteriores são
// bibliotecas de terceiros embutidas — xlsx, Tesseract, ZXing, qrcode).
const inicioScript = index.lastIndexOf('<script>');
assert.ok(inicioScript !== -1, 'não encontrei nenhum <script> no index.html');
const fimScript = index.indexOf('</script>', inicioScript);
assert.ok(fimScript !== -1, 'não encontrei o fecho do último <script>');
const appJs = index.slice(inicioScript, fimScript);

test('setHTML() existe e é a única função que escreve em innerHTML', () => {
  assert.match(appJs, /^function setHTML\(el, html\) \{\n {2}el\.innerHTML = html;\n\}$/m,
    'setHTML(el, html) não existe, ou já não é só "el.innerHTML = html;" — actualiza este teste se a mudança for deliberada');
});

test('nenhum outro código da app escreve directamente em innerHTML', () => {
  // Remove a própria definição de setHTML antes de procurar — o que sobra
  // não pode conter mais nenhum ".innerHTML =".
  const semSetHTML = appJs.replace(/^function setHTML\(el, html\) \{\n {2}el\.innerHTML = html;\n\}$/m, '');
  const ocorrencias = semSetHTML.match(/\.innerHTML\s*=(?!=)/g) || [];
  assert.deepEqual(ocorrencias, [],
    `apareceu innerHTML fora de setHTML() (${ocorrencias.length}x) — usa setHTML(el, html) em vez de "el.innerHTML = html"`);
});
