# Bibliotecas de terceiros

Todas as bibliotecas que esta app usa estão **neste repositório**. Não há
nenhuma a ser carregada de uma CDN, e isso é de propósito — ver as três
razões no comentário das tags `<script>` do `index.html`.

| ficheiro | origem | versão | licença |
| --- | --- | --- | --- |
| `xlsx.full.min.js` | https://cdn.sheetjs.com | 0.20.3 | Apache-2.0 |
| `tesseract.min.js` | npm `tesseract.js` | 5.1.1 | Apache-2.0 |
| `worker.min.js` | npm `tesseract.js` (`dist/`) | 5.1.1 | Apache-2.0 |
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

## O que ainda vem de fora

O motor de OCR (`tesseract-core[-simd]-lstm.wasm.js`, ~3,9 MB) e os dados de
idioma (`eng.traineddata.gz`, ~2,9 MB) continuam a ser descarregados pelo
Tesseract de `cdn.jsdelivr.net`, na primeira vez que o OCR corre. Ficam
guardados em cache a partir daí (`handleAsset`, no `sw.js`).

Ou seja: **o OCR é a única parte da app que ainda exige ter havido rede uma
vez**. Ler códigos de barras e o QR da etiqueta já não exige nada — o ZXing
é JavaScript puro e vem com a app.

Trazer também esses dois para cá acrescentaria ~11 MB ao repositório (são
precisas as duas variantes do motor, com e sem SIMD, porque a escolha é
feita no dispositivo) e ~7 MB ao que cada telemóvel descarrega. É uma
decisão em aberto, não um esquecimento.
