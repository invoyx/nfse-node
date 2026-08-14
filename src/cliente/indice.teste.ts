import assert from 'node:assert/strict';
import https from 'node:https';
import { test } from 'node:test';
import forge from 'node-forge';
import { compactarGZipBase64, descompactarGZipBase64 } from './compressao.js';
import { ErroComunicacaoSefin } from './erros.js';
import { criarClienteSefin } from './indice.js';

/**
 * Gera um par chave+certificado autoassinado (servidor ou cliente de teste).
 * 2048 bits porque, diferente dos testes de `certificado`/`assinatura` (que
 * só passam pelo node-forge), aqui a chave roda no TLS nativo do Node, e o
 * OpenSSL 3 rejeita RSA de 1024 bits como fraco demais pro handshake.
 */
function gerarParChaveCertificado(commonName: string) {
  const chaves = forge.pki.rsa.generateKeyPair(2048);
  const certificado = forge.pki.createCertificate();
  certificado.publicKey = chaves.publicKey;
  certificado.serialNumber = '01';
  certificado.validity.notBefore = new Date();
  certificado.validity.notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const atributos = [{ name: 'commonName', value: commonName }];
  certificado.setSubject(atributos);
  certificado.setIssuer(atributos);
  certificado.sign(chaves.privateKey, forge.md.sha256.create());
  return {
    chavePrivadaPem: forge.pki.privateKeyToPem(chaves.privateKey),
    certificadoPem: forge.pki.certificateToPem(certificado),
  };
}

/**
 * Sobe um servidor HTTPS local com mTLS (exige certificado de cliente, mas
 * não valida a cadeia - o interesse do teste é confirmar que o nosso cliente
 * de fato apresenta um certificado, e que fala o protocolo certo, não montar
 * uma cadeia de confiança completa).
 */
function subirServidorDeTeste(
  tratador: (req: import('node:http').IncomingMessage, corpo: string, res: import('node:http').ServerResponse) => void
) {
  const servidor = gerarParChaveCertificado('localhost');
  const http = https.createServer(
    { key: servidor.chavePrivadaPem, cert: servidor.certificadoPem, requestCert: true, rejectUnauthorized: false },
    (req, res) => {
      const pedacos: Buffer[] = [];
      req.on('data', (p: Buffer) => pedacos.push(p));
      req.on('end', () => tratador(req, Buffer.concat(pedacos).toString('utf8'), res));
    }
  );
  return new Promise<{ urlBase: string; fechar: () => Promise<void> }>((resolve) => {
    http.listen(0, '127.0.0.1', () => {
      const porta = (http.address() as import('node:net').AddressInfo).port;
      resolve({
        urlBase: `https://127.0.0.1:${porta}`,
        fechar: () => new Promise((r) => http.close(() => r())),
      });
    });
  });
}

const clienteDeTeste = gerarParChaveCertificado('EMPRESA TESTE LTDA:12345678000199');

test('emitirDps envia GZip/Base64 por mTLS e decodifica a NFS-e devolvida', async () => {
  const { urlBase, fechar } = await subirServidorDeTeste((req, corpo, res) => {
    const certificadoCliente = (req.socket as import('tls').TLSSocket).getPeerCertificate();
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/nfse');
    assert.match(certificadoCliente.subject?.CN ?? '', /EMPRESA TESTE LTDA/);

    const { dpsXmlGZipB64 } = JSON.parse(corpo);
    assert.equal(descompactarGZipBase64(dpsXmlGZipB64), '<DPS>conteudo de teste</DPS>');

    const nfseXml = `<NFSe><infNFSe Id="NFS${'0'.repeat(49)}1"></infNFSe></NFSe>`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ nfseXmlGZipB64: compactarGZipBase64(nfseXml) }));
  });

  try {
    const cliente = criarClienteSefin({
      ambiente: 'homologacao',
      certificado: clienteDeTeste,
      urlBase,
      agenteOpcoes: { rejectUnauthorized: false },
    });
    const resultado = await cliente.emitirDps('<DPS>conteudo de teste</DPS>');
    assert.equal(resultado.status, 200);
    assert.equal(resultado.chaveAcesso, `${'0'.repeat(49)}1`);
    assert.match(resultado.nfseXml, /<NFSe>/);
  } finally {
    await fechar();
  }
});

test('propaga os erros do SEFIN Nacional em rejeicoes (HTTP 4xx/5xx)', async () => {
  const { urlBase, fechar } = await subirServidorDeTeste((_req, _corpo, res) => {
    res.writeHead(422, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ erros: [{ codigo: 'E0001', descricao: 'DPS invalida' }] }));
  });

  try {
    const cliente = criarClienteSefin({
      ambiente: 'homologacao',
      certificado: clienteDeTeste,
      urlBase,
      agenteOpcoes: { rejectUnauthorized: false },
    });
    await assert.rejects(cliente.emitirDps('<DPS/>'), (erro: unknown) => {
      assert.ok(erro instanceof ErroComunicacaoSefin);
      assert.equal(erro.status, 422);
      assert.equal(erro.erros[0]?.codigo, 'E0001');
      assert.equal(erro.erros[0]?.descricao, 'DPS invalida');
      return true;
    });
  } finally {
    await fechar();
  }
});

test('consultarNfse monta o caminho com a chave de acesso', async () => {
  const { urlBase, fechar } = await subirServidorDeTeste((req, _corpo, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/nfse/12345678901234567890123456789012345678901234567890');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  try {
    const cliente = criarClienteSefin({
      ambiente: 'homologacao',
      certificado: clienteDeTeste,
      urlBase,
      agenteOpcoes: { rejectUnauthorized: false },
    });
    const resultado = await cliente.consultarNfse('12345678901234567890123456789012345678901234567890');
    assert.deepEqual(resultado.corpo, { ok: true });
  } finally {
    await fechar();
  }
});

test('baixarDfe monta o caminho e a query string, e descompacta os XMLs do lote', async () => {
  const { urlBase, fechar } = await subirServidorDeTeste((req, _corpo, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/contribuintes/DFe/10?cnpjConsulta=12345678000199&lote=false');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        StatusProcessamento: 'DOCUMENTOS_LOCALIZADOS',
        LoteDFe: [
          {
            NSU: 11,
            ChaveAcesso: '1'.repeat(50),
            TipoDocumento: 'NFSE',
            ArquivoXml: compactarGZipBase64('<NFSe>doc</NFSe>'),
            DataHoraGeracao: '2026-06-15T10:30:00-03:00',
          },
        ],
        Alertas: [],
        Erros: [],
        TipoAmbiente: 'HOMOLOGACAO',
        DataHoraProcessamento: '2026-06-15T10:31:00-03:00',
      })
    );
  });

  try {
    const cliente = criarClienteSefin({
      ambiente: 'homologacao',
      certificado: clienteDeTeste,
      urlBaseAdn: urlBase,
      agenteOpcoes: { rejectUnauthorized: false },
    });
    const resultado = await cliente.baixarDfe(10, { cnpjConsulta: '12345678000199', lote: false });
    assert.equal(resultado.statusProcessamento, 'DOCUMENTOS_LOCALIZADOS');
    assert.equal(resultado.documentos[0]?.xml, '<NFSe>doc</NFSe>');
  } finally {
    await fechar();
  }
});

test('consultarConvenio monta o caminho com o codigo do municipio', async () => {
  const { urlBase, fechar } = await subirServidorDeTeste((req, _corpo, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/parametrizacao/3550308/convenio');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        mensagem: null,
        parametrosConvenio: { tipoConvenioDeserializationSetter: 1, aderenteAmbienteNacional: 1 },
      })
    );
  });

  try {
    const cliente = criarClienteSefin({
      ambiente: 'homologacao',
      certificado: clienteDeTeste,
      urlBaseAdn: urlBase,
      agenteOpcoes: { rejectUnauthorized: false },
    });
    const resultado = await cliente.consultarConvenio('3550308');
    assert.equal(resultado.parametros.tipoConvenio, 1);
  } finally {
    await fechar();
  }
});
