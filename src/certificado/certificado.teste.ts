import assert from 'node:assert/strict';
import { test } from 'node:test';
import forge from 'node-forge';
import { ErroSenhaCertificadoInvalida } from './erros.js';
import { lerCertificado } from './indice.js';

const SENHA = 'senha-teste';

/**
 * Monta um .pfx autoassinado equivalente a um e-CNPJ ICP-Brasil: CN no
 * formato "RAZAO SOCIAL:CNPJ" e um SubjectAlternativeName com o CNPJ
 * codificado no OID 2.16.76.1.3.3, como nos certificados reais.
 */
function gerarPfxDeTeste(cnpj: string, razaoSocial: string): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair(1024); // teste local, velocidade > força
  const certificado = forge.pki.createCertificate();
  certificado.publicKey = chaves.publicKey;
  certificado.serialNumber = '01';
  certificado.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  certificado.validity.notAfter = new Date('2027-01-01T00:00:00Z');

  const atributos = [{ name: 'commonName', value: `${razaoSocial}:${cnpj}` }];
  certificado.setSubject(atributos);
  certificado.setIssuer(atributos);

  const oidCnpjDer = forge.asn1.oidToDer('2.16.76.1.3.3').getBytes();
  const otherName = forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, oidCnpjDer),
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTF8, false, cnpj),
    ]),
  ]);
  const valorSan = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    otherName,
  ]);
  certificado.setExtensions([{ name: 'subjectAltName', value: valorSan } as forge.pki.CertificateExtension]);

  certificado.sign(chaves.privateKey, forge.md.sha256.create());

  const pfxAsn1 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, certificado, SENHA, {
    algorithm: '3des',
  });
  return Buffer.from(forge.asn1.toDer(pfxAsn1).getBytes(), 'binary');
}

test('le chave privada, certificado e titular (CN + SAN) de um pfx valido', () => {
  const pfx = gerarPfxDeTeste('12345678000199', 'EMPRESA TESTE LTDA');
  const resultado = lerCertificado(pfx, SENHA);

  assert.match(resultado.chavePrivadaPem, /BEGIN (RSA )?PRIVATE KEY/);
  assert.match(resultado.certificadoPem, /BEGIN CERTIFICATE/);
  assert.deepEqual(resultado.titular, {
    cnpj: '12345678000199',
    cpf: null,
    nome: 'EMPRESA TESTE LTDA',
  });
  assert.equal(resultado.validadeInicio.getUTCFullYear(), 2026);
  assert.equal(resultado.validadeFim.getUTCFullYear(), 2027);
});

test('rejeita senha incorreta com erro especifico', () => {
  const pfx = gerarPfxDeTeste('12345678000199', 'EMPRESA TESTE LTDA');
  assert.throws(() => lerCertificado(pfx, 'senha-errada'), ErroSenhaCertificadoInvalida);
});

test('extrai CPF quando o CN tem 11 digitos (padrao e-CPF)', () => {
  // O builder sempre grava o documento no SAN sob o OID de CNPJ, mas com
  // 11 digitos ele e descartado pelo filtro de tamanho em lerCnpjDoSan -
  // o CPF so pode vir do CN mesmo, como acontece com certificados reais.
  const pfx = gerarPfxDeTeste('12345678909', 'FULANO DE TAL');
  const resultado = lerCertificado(pfx, SENHA);
  assert.equal(resultado.titular.cpf, '12345678909');
  assert.equal(resultado.titular.cnpj, null);
});
