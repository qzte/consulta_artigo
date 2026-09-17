# Bibliotecas de terceiros

Todas as bibliotecas que esta app usa estão **neste repositório**. Não há
nenhuma a ser carregada de uma CDN, e isso é de propósito — ver as três
razões no comentário das tags `<script>` do `index.html`.

| ficheiro | origem | versão | licença |
| --- | --- | --- | --- |
| `xlsx.full.min.js` | https://cdn.sheetjs.com | 0.20.3 | Apache-2.0 |
| `tesseract.min.js` | npm `tesseract.js` | 5.1.1 | Apache-2.0 |
| `worker.min.js` | npm `tesseract.js` (`dist/`) | 5.1.1 | Apache-2.0 |
| `tesseract-core-lstm.wasm.js` | npm `tesseract.js-core` | 5.1.1 | Apache-2.0 |
| `tesseract-core-simd-lstm.wasm.js` | npm `tesseract.js-core` | 5.1.1 | Apache-2.0 |
| `zxing-browser.min.js` | npm `@zxing/browser` (`umd/`) | 0.2.1 | MIT |
| `qrcode.js` | qrcode-generator, Kazuhiko Arase | 1.x | MIT |

Licenças: `tesseract.js-LICENSE.md`, `zxing-browser-LICENSE.txt`,
`tesseract.min.js.LICENSE.txt`, `worker.min.js.LICENSE.txt`, e o cabeçalho
do próprio `qrcode.js`.

## Verificar que um ficheiro não foi tocado

`tests/hash-bibliotecas.test.mjs` compara o SHA-256 dos cinco ficheiros
vendorizados contra hashes fixos, e corre em cada `npm test` — não é
preciso repetir isto à mão a cada revisão de código. O que esse teste NÃO
faz é confirmar que o hash fixo é mesmo o do pacote publicado no registo:
isso só se verifica assim, contra a fonte, e só é preciso ao **actualizar**
uma biblioteca (a seguir) ou se houver suspeita de que um ficheiro já
chegou alterado antes de ser commitado:

```sh
npm pack tesseract.js@5.1.1
tar -xzf tesseract.js-5.1.1.tgz
cmp package/dist/tesseract.min.js tesseract.min.js   # sem saída = idêntico
cmp package/dist/worker.min.js    worker.min.js

npm pack tesseract.js-core@5.1.1
tar -xzf tesseract.js-core-5.1.1.tgz
cmp package/tesseract-core-lstm.wasm.js      tesseract-core-lstm.wasm.js
cmp package/tesseract-core-simd-lstm.wasm.js tesseract-core-simd-lstm.wasm.js

npm pack @zxing/browser@0.2.1
tar -xzf zxing-browser-0.2.1.tgz
cmp package/umd/zxing-browser.min.js zxing-browser.min.js
```

Os ficheiros vindos do npm são **byte a byte** os do pacote publicado —
nada foi editado, justamente para poderem ser verificados assim.

O `xlsx.full.min.js` não tem este atalho: vem de `cdn.sheetjs.com`, não de
um pacote npm (a versão publicada no registo ficou desactualizada), por
isso não há um `npm pack` que o confirme — o hash fixo no teste é a única
protecção que tem, e só contra alteração depois de commitado.

O `qrcode.js` é outra excepção, mas sem alternativa nenhuma: esteve
embutido no `index.html` até à v1.52.0 e saiu de lá tal como estava, com o
cabeçalho de licença incluído — nunca teve uma fonte externa para comparar.

## Actualizar uma biblioteca

1. `npm pack <pacote>@<versão nova>` e copiar o ficheiro por cima.
2. Corrigir a versão **neste ficheiro e no comentário do `index.html`** —
   há um teste que compara os dois e falha se ficarem a divergir.
3. `sha256sum <ficheiro>` e substituir o hash correspondente em
   `tests/hash-bibliotecas.test.mjs` — sem isto, `npm test` falha por ter
   ficado a apontar para o hash da versão antiga.
4. `npm test`.
5. Abrir a app e usar mesmo a parte que depende da biblioteca (o scan, no
   caso do Tesseract e do ZXing; a etiqueta, no caso do qrcode). Os testes
   verificam sintaxe, coerência e integridade — não que a biblioteca faz o
   que deve.

## O motor OCR (desde a v1.58.0)

`tesseract-core-lstm.wasm.js` e `tesseract-core-simd-lstm.wasm.js` (o WASM
do motor, com e sem SIMD — a escolha entre os dois é feita no dispositivo,
por isso é preciso trazer as duas variantes) vão embutidos em base64 no
`index.html`, tal como o `worker.min.js`. Um caminho relativo não seria
carregável quando a página é aberta com `file://`, e o próprio Tesseract
não dá para lhe apontar um `corePath` que sirva um ficheiro exacto sem que
ele tente ainda assim ir buscá-lo por si — por isso o truque é diferente do
do `worker.min.js`: `getCoreImportScriptsShim()` (no `index.html`)
intercepta o `importScripts()` que o Tesseract faz para carregar o motor
dentro do seu próprio worker, e serve-o a partir do que já está embutido,
sem tocar em rede nenhuma. A deteção de SIMD continua a ser feita pelo
próprio Tesseract — só muda de onde o ficheiro escolhido vem.

## O que ainda vem de fora

Os dados de idioma (`eng.traineddata.gz`, modelo `4.0.0_best_int`, ~3 MB)
continuam a ser descarregados pelo Tesseract de `cdn.jsdelivr.net`, na
primeira vez que o OCR corre — ao contrário do motor, aqui não há como
interceptar de forma tão simples (o pedido é um `fetch()` normal para um
URL que o próprio Tesseract monta, não um `importScripts()` de um nome de
ficheiro fixo). Ficam guardados em cache a partir daí (`handleAsset`, no
`sw.js`), com o SHA-256 verificado contra `TESSERACT_CDN_HASHES` antes de
serem aceites.

Ou seja: **os dados de idioma são a única parte da app que ainda exige ter
havido rede uma vez**. Ler códigos de barras e o QR da etiqueta, e agora
também o motor OCR em si, já não exigem nada disso.

Trazer também os dados de idioma para cá acrescentaria mais uns ~3 MB ao
repositório e ao que cada telemóvel descarrega — menos do que o motor, mas
ainda uma escolha em aberto, não um esquecimento.
