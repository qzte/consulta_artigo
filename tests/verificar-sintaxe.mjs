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

// Só os <script> sem src (os embutidos); os que apontam para uma CDN não têm
// corpo nenhum para verificar.
const blocos = [...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

if (blocos.length === 0) {
  console.error('Não encontrei nenhum <script> embutido no index.html — a app não pode funcionar assim.');
  process.exit(1);
}

console.log(`A verificar ${blocos.length} bloco(s) de script do index.html e o sw.js:`);
blocos.forEach((codigo, i) => verificar(`index.html <script> #${i + 1}`, codigo));
verificar('sw.js', readFileSync(join(RAIZ, 'sw.js'), 'utf8'));

if (problemas.length) {
  console.error(`\n${problemas.length} ficheiro(s) com erro de sintaxe.`);
  process.exit(1);
}
console.log('\nSintaxe válida.');
