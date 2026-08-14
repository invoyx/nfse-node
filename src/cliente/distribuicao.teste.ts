import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactarGZipBase64 } from './compressao.js';
import { normalizarLoteDistribuicao } from './distribuicao.js';

function loteExemplo(overrides: Record<string, unknown> = {}) {
  return {
    StatusProcessamento: 'DOCUMENTOS_LOCALIZADOS',
    LoteDFe: [
      {
        NSU: 1,
        ChaveAcesso: '1'.repeat(50),
        TipoDocumento: 'NFSE',
        TipoEvento: null,
        ArquivoXml: compactarGZipBase64('<NFSe>conteudo</NFSe>'),
        DataHoraGeracao: '2026-06-15T10:30:00-03:00',
      },
    ],
    Alertas: [],
    Erros: [],
    TipoAmbiente: 'HOMOLOGACAO',
    VersaoAplicativo: '1.0.0',
    DataHoraProcessamento: '2026-06-15T10:31:00-03:00',
    ...overrides,
  };
}

test('normaliza o lote de distribuicao, descompactando o XML de cada documento', () => {
  const resultado = normalizarLoteDistribuicao(loteExemplo());

  assert.equal(resultado.statusProcessamento, 'DOCUMENTOS_LOCALIZADOS');
  assert.equal(resultado.ambiente, 'HOMOLOGACAO');
  assert.equal(resultado.documentos.length, 1);
  assert.equal(resultado.documentos[0]?.nsu, 1);
  assert.equal(resultado.documentos[0]?.chaveAcesso, '1'.repeat(50));
  assert.equal(resultado.documentos[0]?.xml, '<NFSe>conteudo</NFSe>');
});

test('normaliza mensagens de alerta e erro (campos PascalCase)', () => {
  const resultado = normalizarLoteDistribuicao(
    loteExemplo({
      Erros: [{ Codigo: 'E001', Descricao: 'NSU invalido', Complemento: null, Parametros: [] }],
    })
  );

  assert.equal(resultado.erros[0]?.codigo, 'E001');
  assert.equal(resultado.erros[0]?.descricao, 'NSU invalido');
});

test('lida com lote vazio (nenhum documento localizado)', () => {
  const resultado = normalizarLoteDistribuicao(
    loteExemplo({ StatusProcessamento: 'NENHUM_DOCUMENTO_LOCALIZADO', LoteDFe: null })
  );

  assert.equal(resultado.statusProcessamento, 'NENHUM_DOCUMENTO_LOCALIZADO');
  assert.deepEqual(resultado.documentos, []);
});
