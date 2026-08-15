import assert from 'node:assert/strict';
import { test } from 'node:test';
import { limparTextoPdf } from './formatadores.js';

test('limparTextoPdf troca CRLF e CR solto por LF', () => {
  assert.equal(limparTextoPdf('linha1\r\nlinha2\rlinha3'), 'linha1\nlinha2\nlinha3');
});

test('limparTextoPdf troca tab por espaco', () => {
  assert.equal(limparTextoPdf('coluna1\tcoluna2'), 'coluna1 coluna2');
});

test('limparTextoPdf remove outros caracteres de controle sem apagar o texto ao redor', () => {
  assert.equal(limparTextoPdf('abc\x00\x01\x1fdef'), 'abcdef');
});

test('limparTextoPdf preserva LF (quebra de linha legitima)', () => {
  assert.equal(limparTextoPdf('linha1\nlinha2'), 'linha1\nlinha2');
});

test('limparTextoPdf devolve string vazia para undefined', () => {
  assert.equal(limparTextoPdf(undefined), '');
});
