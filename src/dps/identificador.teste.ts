import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErroValidacaoDps } from './erros.js';
import { gerarIdDps } from './identificador.js';

test('gera o id com CNPJ, municipio, serie e numero no formato fixo (45 caracteres)', () => {
  const id = gerarIdDps({
    documentoEmitente: '12.345.678/0001-99',
    codigoMunicipioEmissor: '3550308',
    serie: '1',
    numero: 1001,
  });

  assert.equal(id.length, 45);
  assert.equal(id, 'DPS' + '3550308' + '2' + '12345678000199' + '00001' + '000000000001001');
});

test('usa tipo de inscricao 1 para CPF, com zero a esquerda ate 14 digitos', () => {
  const id = gerarIdDps({
    documentoEmitente: '123.456.789-09',
    codigoMunicipioEmissor: '3550308',
    serie: 1,
    numero: 1,
  });

  assert.equal(id.slice(10, 11), '1'); // tipo de inscricao = CPF
  assert.equal(id.slice(11, 25), '00012345678909'); // CPF (11 digitos) com zero a esquerda ate 14
});

test('rejeita documento que nao e CPF nem CNPJ', () => {
  assert.throws(
    () => gerarIdDps({ documentoEmitente: '123', codigoMunicipioEmissor: '3550308', serie: 1, numero: 1 }),
    ErroValidacaoDps
  );
});

test('rejeita municipio com tamanho diferente de 7 digitos', () => {
  assert.throws(
    () => gerarIdDps({ documentoEmitente: '12345678000199', codigoMunicipioEmissor: '123', serie: 1, numero: 1 }),
    ErroValidacaoDps
  );
});

test('rejeita numero da dps com mais de 15 digitos', () => {
  assert.throws(
    () =>
      gerarIdDps({
        documentoEmitente: '12345678000199',
        codigoMunicipioEmissor: '3550308',
        serie: 1,
        numero: '1234567890123456',
      }),
    ErroValidacaoDps
  );
});
