#!/usr/bin/env node
// Verifica que o <script> do index.html e o sw.js são JavaScript válido.
//
// Não é um teste de comportamento — é a rede de segurança por baixo de todos
// os outros. Os testes de funções puras extraem só as declarações de que
// precisam, por isso um erro de sintaxe noutro ponto qualquer do ficheiro
// passava-lhes ao lado inteiro, e o sintoma em produção é a app abrir em
// branco. Sendo um HTML editado à mão, com mais de 5000 linhas de script lá
// dentro, é uma falha barata de cometer.
//
// Só compila (`new Function`), não executa: o código mexe em document,
// window e indexedDB logo no arranque.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const problemas = [];

function verificar(nome, codigo) {
  try {
    new Function(codigo);
    console.log(`  ok   ${nome}`);
  } catch (err) {
    console.error(`  FALHA ${nome}: ${err.message}`);
    problemas.push(nome);
  }
}

const index = readFileSync(join(RAIZ, 'index.html'), 'utf8');

// Os comentários HTML saem primeiro. Sem isto, a palavra "<script>" escrita
// dentro de um comentário — como está no bloco que explica as bibliotecas
// vendorizadas — era apanhada como se fosse uma tag a sério, e o que ia
// parar ao verificador era um pedaço de texto que não é JavaScript nenhum.
// Deu um falso ALARME quando aconteceu; o que preocupa é o contrário, que o
// mesmo engano mais à frente no ficheiro juntasse dois blocos num só e
// deixasse passar um erro a sério.
const semComentarios = index.replace(/<!--[\s\S]*?-->/g, '');

// Só os <script> sem src (os embutidos); os que apontam para um ficheiro
// não têm corpo nenhum para verificar.
const blocos = [...semComentarios.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

if (blocos.length === 0) {
  console.error('Não encontrei nenhum <script> embutido no index.html — a app não pode funcionar assim.');
  process.exit(1);
}

// Os ficheiros .js locais que o index.html carrega por src. Desde a v1.53.0
// há quatro (xlsx, tesseract, zxing, qrcode) e o qrcode saiu de dentro deste
// HTML, recortado por número de linha — precisamente o tipo de operação que
// pode deixar um ficheiro truncado a meio de uma função. Um ficheiro
// vendorizado cortado não dá erro nenhum a copiar: dá uma app partida.
const locais = [...semComentarios.matchAll(/<script[^>]+src="\.\/([^"]+)"/g)].map(m => m[1]);

console.log(`A verificar ${blocos.length} bloco(s) embutido(s), ${locais.length} ficheiro(s) local(is) e o sw.js:`);
blocos.forEach((codigo, i) => verificar(`index.html <script> #${i + 1}`, codigo));
for (const nome of locais) {
  verificar(nome, readFileSync(join(RAIZ, nome), 'utf8'));
}
verificar('sw.js', readFileSync(join(RAIZ, 'sw.js'), 'utf8'));

if (problemas.length) {
  console.error(`\n${problemas.length} ficheiro(s) com erro de sintaxe.`);
  process.exit(1);
}
console.log('\nSintaxe válida.');
