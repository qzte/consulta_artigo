// Verifica o SHA-256 das bibliotecas vendorizadas contra hashes fixos, em
// vez de depender de alguém correr à mão os passos "Verificar que um
// ficheiro não foi tocado" do VENDOR.md antes de cada publicação.
//
// O que isto apanha: um ficheiro vendorizado editado por engano (à mão, por
// um merge, por um find-and-replace largo demais) sem que a versão no
// comentário do index.html ou no VENDOR.md mude — o teste
// "as bibliotecas vendorizadas são as versões que os comentários dizem ser"
// só confirma o número da versão, não o conteúdo do ficheiro. Não apanha um
// ficheiro que já tivesse vindo alterado da própria fonte (para isso é
// preciso repetir o "npm pack" do VENDOR.md contra o registo, o que este
// teste não faz — corre offline, contra os hashes já confirmados assim).
//
// Actualizar uma biblioteca (VENDOR.md tem os passos completos):
//   1. `npm pack <pacote>@<versão nova>` e copiar o ficheiro por cima.
//   2. `sha256sum <ficheiro>` e substituir o hash aqui em baixo.
//   3. Corrigir a versão no VENDOR.md e no comentário do index.html.
// O xlsx.full.min.js vem de cdn.sheetjs.com, não de um pacote npm (a versão
// publicada no registo ficou desactualizada) — actualizar o hash é o único
// passo possível para ele; o qrcode.js não tem fonte nenhuma para comparar
// desde sempre (ver VENDOR.md), o hash aqui só protege contra alteração
// depois de commitado.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lerFicheiro } from './harness.mjs';

const HASHES = {
  'xlsx.full.min.js': 'cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41',
  'tesseract.min.js': 'a8e29918d098b2b06e1012bdaeffb4aec0445c5d5654709023e0bd1f442a80e8',
  'worker.min.js': 'aca1229639fc9907d86f96e825955a2b7c5716d17f3bc3acd71f9c7ab66181fc',
  'tesseract-core-lstm.wasm.js': '8f04aa0cc81e7bde33f80e92fa01a7a665f0b4884d098acf5de9c7104a11dfaa',
  'tesseract-core-simd-lstm.wasm.js': 'ce20eda9533cbed1e6c2b4276fbae1e0adc61b6754b5513084be601787b457cf',
  'zxing-browser.min.js': '066bc34edfcdd4a33f0964aeec967752a0dea1ccaf36e58e319ac9fcb5070f6a',
  'qrcode.js': '980b98b438db6f5c58354fa9166e9371bce2c8ab053a0ca546e091f903011ec7',
};

for (const [ficheiro, hashEsperado] of Object.entries(HASHES)) {
  test(`${ficheiro} tem o SHA-256 esperado`, () => {
    const hashReal = createHash('sha256').update(lerFicheiro(ficheiro)).digest('hex');
    assert.equal(hashReal, hashEsperado,
      `${ficheiro} mudou de conteúdo sem o hash aqui ser actualizado — ` +
      'se a mudança for deliberada (actualização de versão), recalcula o hash com sha256sum e substitui-o neste ficheiro');
  });
}
