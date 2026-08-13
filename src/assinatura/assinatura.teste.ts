import assert from 'node:assert/strict';
import { test } from 'node:test';
import forge from 'node-forge';
import { lerCertificado } from '../certificado/indice.js';
import { assinarXml, assinaturaValida } from './indice.js';
import { ErroAssinatura } from './erros.js';

const SENHA = 'senha-teste';

function gerarPfxDeTeste(): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair(1024);
  const certificado = forge.pki.createCertificate();
  certificado.publicKey = chaves.publicKey;
  certificado.serialNumber = '01';
  certificado.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  certificado.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  const atributos = [{ name: 'commonName', value: 'EMPRESA TESTE LTDA:12345678000199' }];
  certificado.setSubject(atributos);
  certificado.setIssuer(atributos);
  certificado.sign(chaves.privateKey, forge.md.sha256.create());

  const pfxAsn1 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, certificado, SENHA, {
    algorithm: '3des',
  });
  return Buffer.from(forge.asn1.toDer(pfxAsn1).getBytes(), 'binary');
}

const XML_DPS = (id: string) =>
  '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse">' +
  `<infDPS Id="${id}"><tpAmb>2</tpAmb><serie>1</serie><nDPS>1</nDPS></infDPS>` +
  '</DPS>';

test('assina um elemento por Id e a assinatura resultante e valida', () => {
  const certificado = lerCertificado(gerarPfxDeTeste(), SENHA);
  const idElemento = 'DPS12345678000199001000000001';

  const assinado = assinarXml(XML_DPS(idElemento), idElemento, certificado);

  assert.match(assinado, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(assinado, /<Signature/);
  assert.ok(assinaturaValida(assinado), 'assinatura deveria ser valida');
});

test('detecta violacao de integridade apos a assinatura', () => {
  const certificado = lerCertificado(gerarPfxDeTeste(), SENHA);
  const idElemento = 'DPS12345678000199001000000001';
  const assinado = assinarXml(XML_DPS(idElemento), idElemento, certificado);

  const adulterado = assinado.replace('<nDPS>1</nDPS>', '<nDPS>2</nDPS>');
  assert.equal(assinaturaValida(adulterado), false);
});

test('rejeita Id inexistente com erro especifico', () => {
  const certificado = lerCertificado(gerarPfxDeTeste(), SENHA);
  assert.throws(
    () => assinarXml(XML_DPS('outro-id'), 'id-que-nao-existe', certificado),
    ErroAssinatura
  );
});
