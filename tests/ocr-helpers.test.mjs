// Testes das funções que preparam e interpretam a leitura do código pela
// câmara (OCR). Correm contra o index.html publicado — ver harness.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex } from './harness.mjs';

const {
  extrairDigitos,
  digitosValidos,
  calcularRetanguloRecorte,
  calcularLimiarOtsu,
  aplicarLimiarPB,
  processarLeituraConsecutiva,
  prepararFotogramaParaOcr,
  SCAN_WRAP_ASPECT,
  SCAN_FRAME_INSET,
  SCAN_AMPLIACAO,
} = carregarDoIndex([
  'OCR_CONFUSOES',
  'extrairDigitos',
  'digitosValidos',
  'SCAN_WRAP_ASPECT',
  'SCAN_FRAME_INSET',
  'calcularRetanguloRecorte',
  'calcularLimiarOtsu',
  'aplicarLimiarPB',
  'SCAN_AMPLIACAO',
  'processarLeituraConsecutiva',
  'prepararFotogramaParaOcr',
]);

// ── extrairDigitos / digitosValidos ─────────────────────

test('extrairDigitos corrige as letras que o OCR troca por dígitos', () => {
  assert.equal(extrairDigitos('OISB'), '0158');
  assert.equal(extrairDigitos('oIlsB'), '01158');
});

test('extrairDigitos descarta tudo o que não seja dígito', () => {
  assert.equal(extrairDigitos('482-751/6'), '4827516');
  assert.equal(extrairDigitos('  4827516  '), '4827516');
  assert.equal(extrairDigitos(''), '');
  assert.equal(extrairDigitos(null), '');
  assert.equal(extrairDigitos(undefined), '');
});

test('as letras confundíveis são convertidas mesmo fora do número', () => {
  // Efeito lateral conhecido e aceite: o "O" de "COD" vira 0. Na moldura só
  // entra a linha do número, e trocar letras por dígitos é preferível a
  // perder um dígito lido como letra — mas fica aqui escrito para não se
  // tomar isto por engano se um dia o recorte apanhar mais texto.
  assert.equal(extrairDigitos('COD 4827516'), '04827516');
});

test('digitosValidos rejeita leituras curtas de mais para serem um código', () => {
  assert.equal(digitosValidos('123'), '', '3 dígitos é ruído, não um código');
  assert.equal(digitosValidos('1234'), '1234', '4 dígitos é o mínimo aceite');
  assert.equal(digitosValidos('4827516'), '4827516');
});

test('digitosValidos aceita um mínimo à medida', () => {
  assert.equal(digitosValidos('12345', 6), '');
  assert.equal(digitosValidos('123456', 6), '123456');
});

// ── calcularRetanguloRecorte ────────────────────────────
// Tem de imitar o "object-fit: cover" do CSS: o vídeo é primeiro cortado
// para caber no rácio 3/4 do .scan-video-wrap, e só depois se aplica a
// percentagem da moldura tracejada.

test('recorte de um vídeo landscape corta a largura (o vídeo é mais largo que a moldura)', () => {
  const r = calcularRetanguloRecorte(1920, 1080, 3 / 4, { top: 0.40, bottom: 0.40, left: 0.08, right: 0.08 });
  // cover: altura inteira (1080), largura 1080*0.75 = 810, centrada → offsetX 555
  assert.equal(r.x, Math.round(555 + 810 * 0.08));
  assert.equal(r.y, Math.round(1080 * 0.40));
  assert.equal(r.width, Math.round(810 * 0.84));
  assert.equal(r.height, Math.round(1080 * 0.20));
});

test('recorte de um vídeo portrait corta a altura', () => {
  const r = calcularRetanguloRecorte(1080, 1920, 3 / 4, { top: 0.40, bottom: 0.40, left: 0.08, right: 0.08 });
  // cover: largura inteira (1080), altura 1080/0.75 = 1440, centrada → offsetY 240
  assert.equal(r.x, Math.round(1080 * 0.08));
  assert.equal(r.y, Math.round(240 + 1440 * 0.40));
  assert.equal(r.width, Math.round(1080 * 0.84));
  assert.equal(r.height, Math.round(1440 * 0.20));
});

test('o recorte fica sempre dentro do fotograma', () => {
  for (const [w, h] of [[640, 480], [1920, 1080], [1080, 1920], [1280, 720], [480, 640]]) {
    const r = calcularRetanguloRecorte(w, h, SCAN_WRAP_ASPECT, SCAN_FRAME_INSET);
    assert.ok(r.x >= 0 && r.y >= 0, `x/y negativos em ${w}x${h}`);
    assert.ok(r.x + r.width <= w + 1, `passa a largura em ${w}x${h}`);
    assert.ok(r.y + r.height <= h + 1, `passa a altura em ${w}x${h}`);
    assert.ok(r.width > 0 && r.height > 0, `recorte vazio em ${w}x${h}`);
  }
});

// ── calcularLimiarOtsu ──────────────────────────────────

// Os tons presentes na imagem, olhando SÓ para os canais de cor. O canal
// alfa fica de fora de propósito: está sempre a 255 e, incluído na conta,
// faria qualquer verificação de "há branco nesta imagem?" dar sempre que
// sim — inclusive numa imagem toda preta, que é justamente o caso que estes
// testes existem para apanhar.
function tons(data) {
  const vistos = new Set();
  for (let i = 0; i < data.length; i += 4) vistos.add(data[i]);
  return vistos;
}

function temPretoEBranco(data) {
  const t = tons(data);
  return t.has(0) && t.has(255);
}

// Imagem de teste: `nFundo` pixéis com o valor claro e `nTinta` com o valor
// escuro — o suficiente para haver duas modas bem separadas.
function imagemDuasModas(valorFundo, valorTinta, nFundo = 300, nTinta = 100) {
  const total = nFundo + nTinta;
  const d = new Uint8ClampedArray(total * 4);
  for (let i = 0; i < total; i++) {
    const v = i < nFundo ? valorFundo : valorTinta;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  return d;
}

test('o limiar cai entre as duas modas da imagem', () => {
  for (const [fundo, tinta] of [[235, 30], [105, 14], [255, 190], [200, 120]]) {
    const limiar = calcularLimiarOtsu(imagemDuasModas(fundo, tinta));
    assert.ok(limiar > tinta && limiar <= fundo, `limiar ${limiar} fora de ]${tinta}, ${fundo}] `);
  }
});

test('o limiar é o primeiro nível branco, não o último preto', () => {
  // Com a tinta a 30 e o fundo a 235 o planalto de empates vai de 31 a 235;
  // o corte fica a meio e o +1 garante que o nível devolvido já é branco
  // para quem compara com ">=".
  const dados = imagemDuasModas(235, 30);
  const limiar = calcularLimiarOtsu(dados);
  const saida = aplicarLimiarPB(dados.slice(), limiar);
  assert.equal(saida[0], 255, 'o fundo tem de ficar branco');
  assert.equal(saida[300 * 4], 0, 'a tinta tem de ficar preta');
});

test('imagem sem pixéis nenhuns devolve o meio-termo em vez de rebentar', () => {
  assert.equal(calcularLimiarOtsu(new Uint8ClampedArray(0)), 128);
});

test('imagem de um só tom não parte o cálculo', () => {
  const lisa = new Uint8ClampedArray(40 * 4).fill(200);
  assert.doesNotThrow(() => calcularLimiarOtsu(lisa));
});

// ── aplicarLimiarPB ─────────────────────────────────────

test('aplicarLimiarPB sem limiar explícito usa o calculado pela imagem', () => {
  // Etiqueta na sombra: TODOS os valores estão abaixo de 150, por isso um
  // limiar fixo de 150 punha isto tudo preto. O de Otsu separa à mesma.
  const sombra = imagemDuasModas(105, 14);
  const comOtsu = aplicarLimiarPB(sombra.slice());
  const com150 = aplicarLimiarPB(sombra.slice(), 150);

  assert.ok(temPretoEBranco(comOtsu), 'Otsu tem de separar fundo e tinta');
  assert.deepEqual([...tons(com150)], [0], 'o limiar fixo de 150 põe uma etiqueta na sombra toda preta');
});

test('aplicarLimiarPB deixa a imagem só com preto e branco e não mexe no alfa', () => {
  const d = imagemDuasModas(235, 30);
  d[3] = 128; // alfa fora do normal, para se ver que não é tocado
  const saida = aplicarLimiarPB(d.slice());
  for (let i = 0; i < saida.length; i += 4) {
    assert.ok(saida[i] === 0 || saida[i] === 255, `valor intermédio em ${i}`);
    assert.equal(saida[i], saida[i + 1]);
    assert.equal(saida[i], saida[i + 2]);
  }
  assert.equal(saida[3], 128, 'o canal alfa não deve ser alterado');
});

// ── processarLeituraConsecutiva ─────────────────────────

test('um candidato só é confirmado à segunda leitura igual seguida', () => {
  let e = { ultima: '', count: 0 };
  e = processarLeituraConsecutiva(e, '4827516');
  assert.equal(e.confirmado, false, 'a primeira leitura nunca confirma');
  e = processarLeituraConsecutiva(e, '4827516');
  assert.equal(e.confirmado, true);
  assert.equal(e.ultima, '4827516');
});

test('uma leitura diferente reinicia a contagem', () => {
  let e = { ultima: '', count: 0 };
  e = processarLeituraConsecutiva(e, '4827516');
  e = processarLeituraConsecutiva(e, '4827510');
  assert.equal(e.confirmado, false);
  assert.equal(e.count, 1);
  assert.equal(e.ultima, '4827510');
});

test('uma leitura vazia limpa o estado, não o faz avançar', () => {
  let e = { ultima: '4827516', count: 1 };
  e = processarLeituraConsecutiva(e, '');
  assert.equal(e.ultima, '');
  assert.equal(e.count, 0);
  assert.equal(e.confirmado, false);
});

// ── prepararFotogramaParaOcr ────────────────────────────
// Regressão da avaria corrigida na v1.35.0: entre a v1.28.0 e a v1.34.0 esta
// função passava um limiar FIXO de 150 ao aplicarLimiarPB, o que anulava por
// completo o cálculo de Otsu (um argumento explícito sobrepõe o valor por
// omissão). Cada função à parte estava certa; era a ligação entre as duas que
// estava avariada — por isso este teste é sobre a chamada, não sobre o
// cálculo.

// Canvas e vídeo de mentira, só com o que a função usa. O `pintar` decide os
// pixéis que o getImageData vai devolver, simulando o fotograma da câmara.
function canvasFalso(pintar) {
  let ultimoEscrito = null;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => {},
      getImageData: (x, y, w, h) => ({ data: pintar(w, h), width: w, height: h }),
      putImageData: img => { ultimoEscrito = img.data; },
    }),
  };
  return { canvas, escrito: () => ultimoEscrito };
}

const videoFalso = { videoWidth: 1920, videoHeight: 1080 };

// Fotograma escuro: fundo a 105 e tinta a 14 — uma etiqueta na sombra do
// armazém. Todos os valores ficam ABAIXO de 150.
function fotogramaNaSombra(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = i % 4 === 0 ? 14 : 105; // um quarto de "tinta"
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  return d;
}

test('uma etiqueta na sombra continua a ter texto legível depois de preparada', () => {
  const { canvas, escrito } = canvasFalso(fotogramaNaSombra);
  prepararFotogramaParaOcr(videoFalso, canvas);

  const saida = escrito();
  assert.ok(saida, 'a imagem preparada tem de ser escrita de volta no canvas');
  assert.ok(
    temPretoEBranco(saida),
    'a imagem entregue ao OCR ficou de um só tom — o motor não tem nada para ler. ' +
    'Foi esta a avaria da v1.28.0-v1.34.0: prepararFotogramaParaOcr passava um limiar fixo ' +
    'de 150 e anulava o cálculo de Otsu. Não voltes a passar limiar nenhum a aplicarLimiarPB.'
  );
});

test('um fotograma sobre-exposto também continua legível', () => {
  // Debaixo do foco: fundo encostado ao branco, tinta a 190 — desta vez tudo
  // ACIMA de 150, o outro extremo da mesma avaria.
  const { canvas, escrito } = canvasFalso((w, h) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = i % 4 === 0 ? 190 : 255;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    return d;
  });
  prepararFotogramaParaOcr(videoFalso, canvas);
  const saida = escrito();
  assert.ok(temPretoEBranco(saida), 'imagem sobre-exposta ficou de um só tom');
});

test('o canvas do OCR fica com o tamanho do recorte já ampliado', () => {
  const { canvas } = canvasFalso(fotogramaNaSombra);
  prepararFotogramaParaOcr(videoFalso, canvas);
  const r = calcularRetanguloRecorte(1920, 1080, SCAN_WRAP_ASPECT, SCAN_FRAME_INSET);
  assert.equal(canvas.width, r.width * SCAN_AMPLIACAO);
  assert.equal(canvas.height, r.height * SCAN_AMPLIACAO);
  assert.ok(SCAN_AMPLIACAO > 1, 'a ampliação existe para o texto pequeno ser legível');
});
