// Testes das funções que preparam e interpretam a leitura do código pela
// câmara (OCR). Correm contra o index.html publicado — ver harness.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex, lerIndexHtml } from './harness.mjs';

const {
  extrairDigitos,
  codigoDeArtigoValido,
  campoCodigoDoTextoBarras,
  escolherCodigoDasLinhas,
  lerCodigoDaResposta,
  resumirLinhasOcr,
  explicarEscolhaOcr,
  candidatosDaLinha,
  CODIGO_DIGITOS,
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
  'codigoDeArtigoValido',
  'campoCodigoDoTextoBarras',
    'CODIGO_DIGITOS',
  'CAMPO_CODIGO',
  'candidatosDaLinha',
  'centroVertical',
  'linhasDoCampoCodigo',
  'escolherCodigoDasLinhas',
  'lerCodigoDaResposta',
  'resumirLinhasOcr',
  'explicarEscolhaOcr',
  'SCAN_WRAP_ASPECT',
  'SCAN_FRAME_INSET',
  'calcularRetanguloRecorte',
  'calcularLimiarOtsu',
  'aplicarLimiarPB',
  'SCAN_AMPLIACAO',
  'processarLeituraConsecutiva',
  'prepararFotogramaParaOcr',
]);

// Linha como o Tesseract a devolve: texto + caixa. `altura` é o que
// distingue o código do artigo do resto da etiqueta.
const linha = (text, altura, y0 = 0) => ({ text, bbox: { x0: 0, y0, x1: 100, y1: y0 + altura } });

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

test('um código de artigo tem exactamente 10 dígitos', () => {
  assert.equal(codigoDeArtigoValido('1260500100'), '1260500100');
  assert.equal(codigoDeArtigoValido('126050010'), '', '9 dígitos');
  assert.equal(codigoDeArtigoValido('12605001000'), '', '11 dígitos');
  assert.equal(codigoDeArtigoValido('08189271'), '', 'o falso positivo do código de barras');
  assert.equal(codigoDeArtigoValido(''), '');
  assert.equal(codigoDeArtigoValido(null), '');
  assert.equal(codigoDeArtigoValido(undefined), '');
});

// ── campoCodigoDoTextoBarras ─────────────────────────────
// O QR da etiqueta (dadosQrEtiqueta) traz código|posição|supermercado —
// só o primeiro campo é o código.

test('o QR da etiqueta desta app é reduzido ao primeiro campo', () => {
  assert.equal(campoCodigoDoTextoBarras('1111500053|0.03.01|Bloco Operatório'), '1111500053');
  assert.equal(campoCodigoDoTextoBarras('4827516||'), '4827516', 'posição e supermercado vazios');
});

test('um código de barras normal (sem "|") fica tal como veio', () => {
  assert.equal(campoCodigoDoTextoBarras('1260500100'), '1260500100');
});

test('entradas vazias não rebentam', () => {
  assert.equal(campoCodigoDoTextoBarras(''), '');
  assert.equal(campoCodigoDoTextoBarras(null), '');
  assert.equal(campoCodigoDoTextoBarras(undefined), '');
});

// ── configuração do motor ───────────────────────────────
// Não é um teste de comportamento: é uma tranca sobre a linha de
// configuração que causou a avaria da v1.36.0. Nenhum teste de função pura
// a apanha, porque a decisão está no arranque do scan e não numa função.

test('o motor de OCR não usa PSM.SINGLE_LINE', () => {
  const src = lerIndexHtml();
  assert.ok(
    !/tessedit_pageseg_mode:\s*Tesseract\.PSM\.SINGLE_LINE/.test(src),
    'SINGLE_LINE promete ao motor que a imagem tem UMA linha de texto. A faixa recortada ' +
    'apanha quase sempre a descrição em cima e a posição em baixo, e nesse caso o motor não ' +
    'devolve nada — o OCR deixa de ler etiquetas reais (v1.28.0 a v1.35.0).'
  );
});

test('o motor de OCR usa SPARSE_TEXT', () => {
  assert.match(lerIndexHtml(), /tessedit_pageseg_mode:\s*Tesseract\.PSM\.SPARSE_TEXT/);
});

test('o motor de OCR NÃO tem lista branca só de dígitos', () => {
  // A lista de dígitos apagava os nomes dos campos ("Produto:"), que são o
  // que diz qual dos números é o código, e apagava o "B" de "B1240001940",
  // deixando o Tag com os mesmos 10 dígitos do código do produto.
  assert.ok(
    !/tessedit_char_whitelist:\s*'0123456789'/.test(lerIndexHtml()),
    'com a lista branca de dígitos o Tag fica indistinguível do Produto'
  );
});

test('o código de barras passa pela mesma validação de formato que o OCR', () => {
  // tentarLerCodigoBarras depende do leitor ZXing e da câmara, por isso não
  // dá para o chamar aqui. Mas a ligação que interessa é visível no
  // ficheiro: sem ela, um falso positivo de 8 dígitos como o "08189271"
  // volta a ser apresentado como código encontrado.
  const src = lerIndexHtml();
  const corpo = src.slice(src.indexOf('async function tentarLerCodigoBarras'));
  assert.match(
    corpo.slice(0, corpo.indexOf('\n}')),
    /codigoDeArtigoValido\(/,
    'tentarLerCodigoBarras tem de validar o formato antes de devolver o código'
  );
});

test('as duas vias usam a MESMA função de validação', () => {
  // Uma validação copiada para cada via divergiria — foi assim que o limiar
  // de Otsu ficou a ser calculado num sítio e ignorado no outro.
  const src = lerIndexHtml();
  const chamadas = (src.match(/codigoDeArtigoValido\(/g) || []).length;
  const definicoes = (src.match(/function codigoDeArtigoValido\(/g) || []).length;
  assert.equal(definicoes, 1, 'só pode haver uma definição da validação');
  assert.ok(chamadas >= 4, `esperava a validação usada nas duas vias, encontrei ${chamadas} chamada(s)`);
});

test('o OCR pede as linhas ao Tesseract, não só o texto corrido', () => {
  // Sem o pedido das linhas não há caixas, e sem caixas não há como saber
  // qual é a letra maior — a escolha do código voltaria a ser às cegas.
  const src = lerIndexHtml();
  assert.match(
    src,
    /scanWorker\.recognize\([^)]*\{\s*blocks:\s*true/,
    'o recognize tem de pedir os blocos/linhas para escolherCodigoDasLinhas ter caixas'
  );
});

// ── escolherCodigoDasLinhas ─────────────────────────────
// A etiqueta é uma lista de campos, TODOS do mesmo tamanho de letra:
//   Servico / Tag: B1240001940 / Produto: 1260500100 / Localizacao: P.04.00
// O código é o do campo "Produto", e tem sempre 10 dígitos.

// A linha do campo e a do valor ficam à mesma altura na imagem, ainda que
// o motor as devolva separadas.
const mesmaFaixa = (y, altura = 40) => [y, altura];

test('leitura REAL da etiqueta do armazém (v1.36/37 não escolhiam nada aqui)', () => {
  // Copiada do painel de diagnóstico, no telemóvel, sobre a etiqueta a
  // sério. As três linhas têm 122, 126 e 116px — quase iguais, e por isso
  // a regra da "letra maior" recusava-se a escolher.
  const lidas = [
    linha('81240001940', 122, 0),    // Tag: B1240001940 (o B saiu como 8)
    linha('1260500100', 126, 200),   // Produto  ← o que se procura
    linha('11 0400', 116, 400),      // Localizacao: P.04.00
  ];
  assert.equal(escolherCodigoDasLinhas(lidas), '1260500100');
});

test('havendo o campo "Produto", é a faixa dele que decide', () => {
  const lidas = [
    linha('Tag:', 40, 0), linha('B1240001940', 40, 0),
    linha('Produto:', 40, 100), linha('1260500100', 40, 100),
    linha('Localizacao: P.04.00', 40, 200),
  ];
  assert.equal(escolherCodigoDasLinhas(lidas), '1260500100');
});

test('o campo e o valor podem vir na mesma linha', () => {
  // Aqui a correcção de confusões transforma os "o" de "Produto" em zeros,
  // e a linha inteira daria 12 dígitos — daí a avaliação palavra a palavra.
  assert.equal(escolherCodigoDasLinhas([linha('Produto: 1260500100', 40, 0)]), '1260500100');
});

test('um Tag de 10 dígitos ao lado do Produto não é escolhido', () => {
  // O campo manda: mesmo havendo outro número de 10 dígitos na imagem, só
  // conta o que está na faixa do "Produto".
  const lidas = [
    linha('Tag:', 40, 0), linha('1240001940', 40, 0),
    linha('Produto:', 40, 100), linha('1260500100', 40, 100),
  ];
  assert.equal(escolherCodigoDasLinhas(lidas), '1260500100');
});

test('sem o campo "Produto", vale o único número de 10 dígitos', () => {
  const lidas = [linha('81240001940', 40, 0), linha('1260500100', 40, 100), linha('110400', 40, 200)];
  assert.equal(escolherCodigoDasLinhas(lidas), '1260500100');
});

test('sem o campo e com dois números de 10 dígitos, não se escolhe nada', () => {
  // O caso que a lista branca de dígitos provocava: apagava o "B" do Tag e
  // deixava dois números indistinguíveis. Não havendo como decidir, não se
  // decide — mais vale nada do que o número errado.
  const lidas = [linha('1240001940', 40, 0), linha('1260500100', 40, 100)];
  assert.equal(escolherCodigoDasLinhas(lidas), '');
});

test('números que não tenham 10 dígitos não são candidatos', () => {
  assert.equal(escolherCodigoDasLinhas([linha('12605001', 40, 0)]), '', '8 dígitos');
  assert.equal(escolherCodigoDasLinhas([linha('126050010012', 40, 0)]), '', '12 dígitos');
  assert.equal(escolherCodigoDasLinhas([linha('P.04.00', 40, 0)]), '');
  assert.equal(escolherCodigoDasLinhas([]), '');
  assert.equal(escolherCodigoDasLinhas(null), '');
});

test('linhas sem caixa são ignoradas em vez de rebentarem', () => {
  assert.doesNotThrow(() => escolherCodigoDasLinhas([{ text: '1260500100' }, null]));
  assert.equal(escolherCodigoDasLinhas([{ text: '1260500100' }, null]), '');
});

test('o código tem 10 dígitos — a constante e a regra dizem o mesmo', () => {
  assert.equal(CODIGO_DIGITOS, 10);
  const dez = '1'.repeat(CODIGO_DIGITOS);
  assert.deepEqual(candidatosDaLinha(dez), [dez]);
  assert.deepEqual(candidatosDaLinha('1'.repeat(CODIGO_DIGITOS - 1)), []);
});

// ── candidatosDaLinha ───────────────────────────────────

test('a palavra do valor é isolada do nome do campo', () => {
  assert.deepEqual(candidatosDaLinha('Produto: 1260500100'), ['1260500100']);
  assert.deepEqual(candidatosDaLinha('Tag: B1240001940'), []);
});

test('as letras confundíveis dentro do número são corrigidas', () => {
  assert.deepEqual(candidatosDaLinha('126O5OO1OO'), ['1260500100']);
});

test('uma palavra com letras a sério não passa por número', () => {
  // "B1240001940" tem 11 caracteres; o B vira 8 e ficam 11 dígitos.
  assert.deepEqual(candidatosDaLinha('B1240001940'), []);
});

// ── lerCodigoDaResposta ─────────────────────────────────

test('havendo linhas, é por elas que se decide', () => {
  const data = {
    text: '81240001940\n1260500100\n11 0400',
    lines: [linha('81240001940', 122, 0), linha('1260500100', 126, 200), linha('11 0400', 116, 400)],
  };
  assert.equal(lerCodigoDaResposta(data), '1260500100');
});

test('sem linhas, recorre-se ao texto corrido em vez de desistir', () => {
  // Reserva para uma versão do Tesseract que não devolva as linhas nesta
  // forma: perde-se a escolha pelo campo, mas continua a ler as etiquetas
  // em que a faixa apanha só o número. Os 10 dígitos continuam a ser
  // exigidos — a reserva é mais fraca, não é sem regras.
  assert.equal(lerCodigoDaResposta({ text: '1260500100' }), '1260500100');
  assert.equal(lerCodigoDaResposta({ text: '1260500100', lines: [] }), '1260500100');
  assert.equal(lerCodigoDaResposta({ text: '08189271' }), '', 'sem 10 dígitos, não passa');
});

test('uma resposta vazia não dá candidato nenhum', () => {
  assert.equal(lerCodigoDaResposta({}), '');
  assert.equal(lerCodigoDaResposta(null), '');
});

// ── diagnóstico ─────────────────────────────────────────
// Estas funções não decidem nada — só explicam a escolha. O que importa é
// que a explicação corresponda mesmo ao que foi decidido: um diagnóstico
// que mente é pior do que não ter diagnóstico nenhum.

test('o resumo traz o texto, os dígitos e a altura de cada linha', () => {
  const resumo = resumirLinhasOcr({ lines: [linha(' 4827516 ', 65), linha('10 10', 20)] });
  assert.equal(resumo.length, 2);
  assert.deepEqual(resumo[0], { texto: '4827516', digitos: '4827516', altura: 65 });
  assert.deepEqual(resumo[1], { texto: '10 10', digitos: '1010', altura: 20 });
});

test('o resumo aguenta linhas mal formadas sem rebentar', () => {
  assert.deepEqual(resumirLinhasOcr({}), []);
  assert.deepEqual(resumirLinhasOcr(null), []);
  assert.doesNotThrow(() => resumirLinhasOcr({ lines: [null, {}, { text: 'x' }] }));
});

test('a explicação da escolha diz o mesmo que a escolha', () => {
  // A garantia que interessa: o que o painel mostra é o que a app usou.
  const casos = [
    { lines: [linha('1010', 20), linha('4827516', 65), linha('12', 20)] },
    { lines: [linha('20240115998', 20), linha('4821', 65)] },
    { lines: [linha('4827516', 60), linha('1234567', 58)] },
    { lines: [linha('12', 65), linha('7', 20)] },
    { lines: [linha('4827516', 65)] },
    { lines: [] , text: '4827516' },
    {},
  ];
  for (const data of casos) {
    assert.equal(
      explicarEscolhaOcr(data).escolhido,
      lerCodigoDaResposta(data),
      `a explicação divergiu da decisão em ${JSON.stringify(data)}`
    );
  }
});

test('cada situação tem o seu motivo, e nunca vem vazio', () => {
  const motivo = data => explicarEscolhaOcr(data).motivo;
  assert.match(motivo({ lines: [linha('Produto:', 40, 0), linha('1260500100', 40, 0)] }), /campo "Produto"/);
  assert.match(motivo({ lines: [linha('1260500100', 40, 0)] }), /único número de 10 dígitos/);
  assert.match(motivo({ lines: [linha('1240001940', 40, 0), linha('1260500100', 40, 100)] }), /ambíguo/);
  assert.match(motivo({ lines: [linha('12', 40, 0)] }), /nenhum número de 10 dígitos/);
  assert.match(motivo({ text: '1260500100' }), /texto corrido/);
  assert.match(motivo({}), /não devolveu linhas/);
});

test('o motivo do caso ambíguo mostra os candidatos em conflito', () => {
  // Sem os números, o painel diz "ambíguo" e deixa quem lê na mesma.
  const m = explicarEscolhaOcr({ lines: [linha('1240001940', 40, 0), linha('1260500100', 40, 100)] }).motivo;
  assert.match(m, /1240001940/);
  assert.match(m, /1260500100/);
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
