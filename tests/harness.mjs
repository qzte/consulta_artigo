// Carrega funções puras a partir do index.html PUBLICADO, para os testes
// correrem contra o código que vai mesmo para o ar.
//
// Porque não uma cópia das funções no ficheiro de teste: era essa a prática
// antiga ("testado isoladamente em X.test.mjs antes de ser copiado para
// aqui") e foi ela que deixou passar a avaria do OCR corrigida na v1.35.0 —
// o cálculo do limiar de Otsu estava certo e testado, mas quem o chamava
// passava-lhe um valor fixo que o anulava. Um teste sobre uma cópia nunca vê
// isso. Aqui não há cópia nenhuma: o que se testa é o ficheiro publicado.
//
// A app é um único HTML sem build nem módulos, por isso não há "import" que
// se lhe faça. Avaliar o <script> inteiro também não serve — ele mexe em
// document/window/indexedDB logo no topo. Extraem-se então só as declarações
// pedidas, pelo nome, e avaliam-se juntas num contexto isolado.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export function lerIndexHtml() {
  return readFileSync(join(RAIZ, 'index.html'), 'utf8');
}

export function lerFicheiro(nome) {
  return readFileSync(join(RAIZ, nome), 'utf8');
}

export const caminhoRaiz = RAIZ;

// Recorta uma declaração de nível superior a partir do índice do seu início.
// O ficheiro tem todas as funções de nível superior a começar na coluna 0 e a
// fechar com um "}" também na coluna 0, por isso basta procurar esse fecho —
// sem ter de perceber de chavetas dentro de strings ou expressões regulares,
// que é onde uma contagem ingénua se enganaria.
function recortarFuncao(src, inicio) {
  const fim = src.indexOf('\n}\n', inicio);
  if (fim === -1) throw new Error('não encontrei o fim da declaração a partir de ' + inicio);
  return src.slice(inicio, fim + 3);
}

// Uma const de nível superior pode ocupar várias linhas (ex.: SCAN_FRAME_INSET
// ou SCAN_CAMERA_CONSTRAINTS). Vai-se acrescentando linha a linha até o troço
// ser sintaticamente válido por si só — o que também serve de validação.
function recortarConst(src, inicio) {
  const linhas = src.slice(inicio).split('\n');
  for (let n = 1; n <= Math.min(linhas.length, 40); n++) {
    const troco = linhas.slice(0, n).join('\n');
    try {
      new Function(troco);
      return troco + '\n';
    } catch {
      // ainda incompleto — junta-se mais uma linha
    }
  }
  throw new Error('não encontrei o fim da const a partir de ' + inicio);
}

/**
 * Extrai as declarações indicadas do index.html e devolve-as já avaliadas.
 * Lança se alguma não existir — assim, se uma função for renomeada ou
 * apagada, o teste falha em vez de passar a testar o vazio.
 *
 * Avaliadas com `new Function` e não num contexto `vm` isolado de propósito:
 * o vm cria outro realm, e um array ou objecto devolvido de lá tem outro
 * prototype, o que faz um assert.deepEqual estrito falhar por causa do
 * mensageiro e não do valor. Aqui o que sai das funções são arrays e objectos
 * normais, comparáveis à vista desarmada.
 *
 * @param {string[]} nomes  nomes de funções e/ou consts de nível superior
 */
export function carregarDoIndex(nomes) {
  const src = lerIndexHtml();
  const partes = [];

  for (const nome of nomes) {
    const mFn = new RegExp('^function ' + nome + '\\(', 'm').exec(src);
    const mConst = new RegExp('^const ' + nome + ' =', 'm').exec(src);
    if (mFn) {
      partes.push(recortarFuncao(src, mFn.index));
    } else if (mConst) {
      partes.push(recortarConst(src, mConst.index));
    } else {
      throw new Error(
        `"${nome}" não foi encontrada como declaração de nível superior no index.html. ` +
        'Se foi renomeada, actualiza o teste; se foi apagada, apaga o teste.'
      );
    }
  }

  return new Function(`${partes.join('\n')}\nreturn { ${nomes.join(', ')} };`)();
}
