# Bibliotecas de terceiros

Todas as bibliotecas que esta app usa estão **neste repositório**. Não há
nenhuma a ser carregada de uma CDN, e isso é de propósito — ver as três
razões no comentário das tags `<script>` do `index.html`.

| ficheiro | origem | versão | licença |
| --- | --- | --- | --- |
| `xlsx.full.min.js` | https://cdn.sheetjs.com | 0.20.3 | Apache-2.0 |
| `zxing-browser.min.js` | npm `@zxing/browser` (`umd/`) | 0.2.1 | MIT |
| `qrcode.js` | qrcode-generator, Kazuhiko Arase | 1.x | MIT |

Licenças: `zxing-browser-LICENSE.txt` e o cabeçalho do próprio `qrcode.js`.

## Verificar que um ficheiro não foi tocado

`tests/hash-bibliotecas.test.mjs` compara o SHA-256 dos ficheiros
vendorizados contra hashes fixos, e corre em cada `npm test` — não é
preciso repetir isto à mão a cada revisão de código. O que esse teste NÃO
faz é confirmar que o hash fixo é mesmo o do pacote publicado no registo:
isso só se verifica assim, contra a fonte, e só é preciso ao **actualizar**
uma biblioteca (a seguir) ou se houver suspeita de que um ficheiro já
chegou alterado antes de ser commitado:

```sh
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
   caso do ZXing; a etiqueta, no caso do qrcode). Os testes verificam
   sintaxe, coerência e integridade — não que a biblioteca faz o que deve.

## OCR removido

Até à versão anterior a app trazia também o Tesseract.js (motor OCR,
worker e o WASM do motor, com e sem SIMD) como reserva para quando o
código de barras não lia. Essa funcionalidade foi removida: o scan agora
lê só código de barras e QR (ZXing), que já era a via principal e mais
fiável. Deixaram de existir `tesseract.min.js`, `worker.min.js`,
`tesseract-core-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js` e as
respectivas licenças, e com eles a única parte da app que ainda exigia
CDN (os dados de idioma "eng" que o Tesseract ia buscar a
`cdn.jsdelivr.net` na primeira utilização, com o SHA-256 verificado pelo
`sw.js` via `TESSERACT_CDN_HASHES`).
