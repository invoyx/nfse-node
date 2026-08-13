import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactarGZipBase64, descompactarGZipBase64 } from './compressao.js';

test('compacta e descompacta preservando o conteudo original', () => {
  const xml = '<DPS><infDPS Id="DPS123"><tpAmb>2</tpAmb></infDPS></DPS>';
  const compactado = compactarGZipBase64(xml);
  assert.notEqual(compactado, xml);
  assert.equal(descompactarGZipBase64(compactado), xml);
});

test('preserva acentuacao (UTF-8) no ciclo completo', () => {
  const xml = '<xDescServ>Prestação de serviço técnico especializado</xDescServ>';
  assert.equal(descompactarGZipBase64(compactarGZipBase64(xml)), xml);
});
