// Correspondência de colunas e validação de cabeçalho.
//
// É aqui que mora a classe de erro mais cara desta app: uma coluna mal
// apanhada não rebenta nada — sai um valor errado, calado, em todas as
// fichas. Já aconteceu: até à v1.1.0 o "Artigo" apanhava o "Código Artigo"
// e o "Supermercado" apanhava o "Código Supermercado", porque col() procura
// por inclusão quando não encontra igual. A ordem em que essa procura é
// feita (primeiro tudo o que é igual, só depois o que contém) é o que
// corrige isso, e é o que estes testes prendem.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDoIndex } from './harness.mjs';

const { col, v, validarCabecalho, validarLinhas } = carregarDoIndex([
  'col',
  'v',
  'COLUNAS_OBRIGATORIAS',
  'NOME_TIPO',
  'validarCabecalho',
  'validarLinhas',
]);

// Cabeçalhos como saem mesmo dos dois exports, na ordem original.
const CAB_SUPER = [
  'Código Artigo', 'Artigo', 'Código Supermercado', 'Supermercado',
  'Código Serviço', 'Serviço', 'Área', 'Local', 'Posição',
  'Tipo Caixa', 'Nº Caixas', 'Quantidade Caixa', 'Quantidade Total',
];
const CAB_ARM = [
  'Código Artigo', 'Artigo', 'Código Armazém', 'Descrição Armazém',
  'Zona', 'Descrição Zona', 'UM', 'Observações', 'Stockável', 'Pedido SGCIM',
];

test('col() prefere a coluna com nome igual à que só o contém', () => {
  // O caso da v1.1.0: "Artigo" não pode ir parar ao "Código Artigo" só por
  // este vir primeiro na folha.
  assert.equal(col(CAB_SUPER, ['Artigo']), CAB_SUPER.indexOf('Artigo'));
  assert.equal(col(CAB_SUPER, ['Supermercado']), CAB_SUPER.indexOf('Supermercado'));
  assert.equal(col(CAB_SUPER, ['Serviço']), CAB_SUPER.indexOf('Serviço'));
});

test('col() apanha na mesma a coluna quando só existe a forma composta', () => {
  // A procura por inclusão continua a fazer falta: é ela que aguenta um
  // cabeçalho com sufixos ("Tipo Caixa Normalizado") ou espaços a mais.
  assert.equal(col(['Tipo Caixa Normalizado'], ['Tipo Caixa']), 0);
  assert.equal(col(['Descricao Armazem (texto)'], ['Descrição Armazém', 'Descricao Armazem']), 0);
});

test('ATENÇÃO: sem uma coluna de nome exacto, "Artigo" volta a cair no "Código Artigo"', () => {
  // Isto NÃO é o comportamento desejável — é o que a app faz hoje, e fica
  // aqui escrito para que se veja se alguém mexer em col(). A protecção
  // contra o erro da v1.1.0 é só a primeira passagem (nome igual): se o
  // export deixar de trazer uma coluna chamada exactamente "Artigo", a
  // segunda passagem (por inclusão) apanha o "Código Artigo" e a descrição
  // do artigo passa a ser o código, sem aviso nenhum.
  //
  // Corrigir isto a sério implica preferir, na passagem por inclusão, a
  // ocorrência mais curta ou a que não seja prefixada por "Código" — mexe
  // em todas as colunas e merece mudança própria, não um remendo de lado.
  assert.equal(col(['Código Artigo', 'Artigo (descrição)'], ['Artigo']), 0);
});

test('col() ignora maiúsculas/minúsculas', () => {
  assert.equal(col(['CÓDIGO ARTIGO', 'artigo'], ['Artigo']), 1);
  assert.equal(col(['supermercado'], ['Supermercado']), 0);
});

test('col() percorre todos os termos alternativos antes de desistir', () => {
  // A versão sem acentos é a alternativa que o export às vezes traz.
  assert.equal(col(['Codigo Artigo'], ['Código Artigo', 'Codigo Artigo']), 0);
  assert.equal(col(CAB_ARM, ['Descrição Armazém', 'Descricao Armazem', 'Armazém']),
    CAB_ARM.indexOf('Descrição Armazém'));
});

test('col() dá -1 quando a coluna não existe de todo', () => {
  assert.equal(col(CAB_ARM, ['Supermercado']), -1);
  assert.equal(col([], ['Artigo']), -1);
});

test('validarCabecalho() aceita cada ficheiro no cartão certo', () => {
  assert.equal(validarCabecalho(CAB_SUPER, 'super'), '');
  assert.equal(validarCabecalho(CAB_ARM, 'arm'), '');
});

test('validarCabecalho() diz que os ficheiros estão trocados', () => {
  // O sintoma sem esta mensagem era "0 artigos" sem explicação nenhuma.
  const msgSuper = validarCabecalho(CAB_ARM, 'super');
  assert.match(msgSuper, /parece ser o de "Artigos"/);
  assert.match(msgSuper, /Carrega-o no outro cartão/);

  const msgArm = validarCabecalho(CAB_SUPER, 'arm');
  assert.match(msgArm, /parece ser o de "Supermercados"/);
});

test('validarCabecalho() nomeia as colunas em falta num ficheiro que não é nenhum dos dois', () => {
  const msg = validarCabecalho(['Data', 'Utilizador', 'Total'], 'super');
  assert.doesNotMatch(msg, /parece ser o de/, 'não é o outro ficheiro, é um ficheiro qualquer');
  assert.match(msg, /"Código Artigo"/);
  assert.match(msg, /"Supermercado"/);
});

test('validarCabecalho() não deixa passar um ficheiro a que falte só uma coluna', () => {
  const semSupermercado = CAB_SUPER.filter(h => h !== 'Supermercado' && h !== 'Código Supermercado');
  assert.match(validarCabecalho(semSupermercado, 'super'), /"Supermercado"/);
});

test('validarLinhas() aceita linhas normais', () => {
  const linhas = [['A1', 'Artigo 1', '', 'Super A'], ['A2', 'Artigo 2', '', 'Super B']];
  assert.equal(validarLinhas(CAB_SUPER.slice(0, 4), linhas, 'super', 'ficheiro.xlsx'), '');
});

test('validarLinhas() rejeita um ficheiro sem nenhuma linha de dados', () => {
  // O caso do export truncado ou filtrado por engano: o cabeçalho está
  // certo, mas não há nada a seguir. Sem isto, superMap/armMap ficavam
  // vazios em silêncio — só "0 artigos" no rodapé, sem dizer porquê.
  const msg = validarLinhas(CAB_SUPER, [], 'super', 'ficheiro.xlsx');
  assert.match(msg, /nenhuma linha de dados/);
  assert.match(msg, /ficheiro\.xlsx/);
  assert.match(msg, /dados já carregados foram mantidos/);
});

test('validarLinhas() rejeita linhas em que nenhuma tem código de artigo', () => {
  // Há linhas, mas processSuperFile/processArmFile ignoram uma a uma as
  // que não têm código — o mesmo "0 artigos" silencioso, só que só se via
  // depois de processar o ficheiro todo.
  const linhas = [['', 'Artigo 1', '', 'Super A'], ['', 'Artigo 2', '', 'Super B']];
  const msg = validarLinhas(CAB_SUPER.slice(0, 4), linhas, 'super', 'ficheiro.xlsx');
  assert.match(msg, /nenhuma com "Código Artigo" preenchido/);
});

test('validarLinhas() basta uma linha com código para aceitar o ficheiro', () => {
  const linhas = [['', 'Artigo 1', '', 'Super A'], ['A2', 'Artigo 2', '', 'Super B']];
  assert.equal(validarLinhas(CAB_SUPER.slice(0, 4), linhas, 'super', 'ficheiro.xlsx'), '');
});
