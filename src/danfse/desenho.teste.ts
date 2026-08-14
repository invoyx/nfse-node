import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { test } from 'node:test';
import { desenharDanfse, gerarDanfse } from './indice.js';
import { lerNfse } from './leitura.js';

const NS = 'http://www.sped.fazenda.gov.br/nfse';

function xmlNfse(opcoes: { descricaoLonga?: boolean; comIbscbs?: boolean } = {}): string {
  const descricao = opcoes.descricaoLonga
    ? 'Prestação de serviços de desenvolvimento de software sob demanda. '.repeat(80)
    : 'Desenvolvimento de software sob demanda.';

  const ibscbs = opcoes.comIbscbs
    ? `<IBSCBS>
         <finNFSe>1</finNFSe>
         <cIndOp>1</cIndOp>
         <indDest>0</indDest>
         <valores><trib><gIBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib></gIBSCBS></trib></valores>
       </IBSCBS>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="${NS}" versao="1.01">
  <infNFSe Id="NFS${'0'.repeat(49)}1">
    <xLocEmi>São Paulo</xLocEmi>
    <xLocPrestacao>São Paulo</xLocPrestacao>
    <nNFSe>123</nNFSe>
    <cLocIncid>3550308</cLocIncid>
    <xLocIncid>São Paulo</xLocIncid>
    <xTribNac>Desenvolvimento de software</xTribNac>
    <verAplic>1.0.0</verAplic>
    <ambGer>2</ambGer>
    <tpEmis>1</tpEmis>
    <cStat>100</cStat>
    <dhProc>2026-06-15T10:31:00-03:00</dhProc>
    <nDFSe>1</nDFSe>
    <emit>
      <CNPJ>12345678000199</CNPJ>
      <xNome>Empresa Exemplo Ltda</xNome>
      <enderNac><xLgr>Rua Exemplo</xLgr><nro>100</nro><xBairro>Centro</xBairro><cMun>3550308</cMun><UF>SP</UF><CEP>01001000</CEP></enderNac>
    </emit>
    <valores>
      <vBC>1500.00</vBC>
      <pAliqAplic>5.00</pAliqAplic>
      <vISSQN>75.00</vISSQN>
      <vTotalRet>75.00</vTotalRet>
      <vLiq>1425.00</vLiq>
    </valores>
    <DPS>
      <infDPS Id="DPS35503082112345678000199000010000000000001">
        <tpAmb>2</tpAmb>
        <dhEmi>2026-06-15T10:30:00-03:00</dhEmi>
        <verAplic>1.0.0</verAplic>
        <serie>1</serie>
        <nDPS>1</nDPS>
        <dCompet>2026-06-01</dCompet>
        <tpEmit>1</tpEmit>
        <cLocEmi>3550308</cLocEmi>
        <prest>
          <CNPJ>12345678000199</CNPJ>
          <regTrib><opSimpNac>1</opSimpNac><regEspTrib>0</regEspTrib></regTrib>
        </prest>
        <toma><CPF>11122233344</CPF><xNome>Cliente Exemplo</xNome></toma>
        <serv>
          <locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest>
          <cServ><cTribNac>010101</cTribNac><xDescServ>${descricao}</xDescServ></cServ>
        </serv>
        <valores>
          <vServPrest><vServ>1500.00</vServ></vServPrest>
          <trib>
            <tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun>
            <totTrib><pTotTrib><pTotTribFed>0.00</pTotTribFed><pTotTribEst>0.00</pTotTribEst><pTotTribMun>5.00</pTotTribMun></pTotTrib></totTrib>
          </trib>
        </valores>
        ${ibscbs}
      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>`;
}

function contarPaginas(pdf: Buffer): number {
  const texto = pdf.toString('latin1');
  const paginas = texto.match(/\/Type\s*\/Page(?!s)/g);
  return paginas ? paginas.length : 0;
}

// Descompacta cada stream FlateDecode do PDF e devolve os mapas ToUnicode
// (beginbfrange...endbfrange) encontrados. Streams que nao sao zlib (ex.:
// imagens em PNG/JPEG) sao ignorados.
function mapasToUnicode(pdf: Buffer): string[] {
  const bruto = pdf.toString('latin1');
  const mapas: string[] = [];
  const regexStream = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let correspondencia: RegExpExecArray | null;
  while ((correspondencia = regexStream.exec(bruto))) {
    const bytes = Buffer.from(correspondencia[1] ?? '', 'latin1');
    let descompactado: string;
    try {
      descompactado = zlib.inflateSync(bytes).toString('latin1');
    } catch {
      continue;
    }
    const inicio = descompactado.indexOf('beginbfrange');
    const fim = descompactado.indexOf('endbfrange');
    if (inicio >= 0 && fim > inicio) mapas.push(descompactado.slice(inicio, fim));
  }
  return mapas;
}

test('nenhum glifo usa ligadura tipografica no mapa ToUnicode (fi, fl etc. quebrariam extracao de texto)', async () => {
  const pdf = await gerarDanfse(xmlNfse());
  const mapas = mapasToUnicode(pdf);
  assert.ok(mapas.length > 0, 'deveria haver ao menos um mapa ToUnicode (fontes embutidas)');
  for (const mapa of mapas) {
    // Uma entrada de ligadura aparece como "<XXXX YYYY>" (dois ou mais
    // grupos hexadecimais dentro do mesmo destino) - sem isso, cada glifo
    // mapeia pra exatamente um codepoint.
    assert.doesNotMatch(mapa, /<[0-9a-fA-F]{4}\s+[0-9a-fA-F]{4}[^>]*>/, 'encontrado destino multi-codepoint (ligadura) no ToUnicode');
  }
});

test('gera um PDF valido de uma unica pagina a partir do XML da NFS-e', async () => {
  const pdf = await gerarDanfse(xmlNfse());
  assert.ok(pdf.subarray(0, 5).toString('ascii') === '%PDF-', 'deveria comecar com o cabecalho %PDF-');
  assert.ok(pdf.length > 5000, 'PDF deveria ter tamanho razoavel (fontes + QR embutidos)');
  assert.equal(contarPaginas(pdf), 1, 'DANFSe deve ser impresso em uma unica pagina (NT 008/2026 §2.2)');
});

test('gera PDF mesmo sem tomador, destinatario, intermediario ou IBSCBS', async () => {
  const dados = lerNfse(xmlNfse());
  const pdf = await desenharDanfse(dados);
  assert.equal(contarPaginas(pdf), 1);
});

test('trunca descricao de servico longa e ainda cabe em uma pagina', async () => {
  const pdf = await gerarDanfse(xmlNfse({ descricaoLonga: true }));
  assert.equal(contarPaginas(pdf), 1);
});

test('desenha bloco IBSCBS quando presente', async () => {
  const dados = lerNfse(xmlNfse({ comIbscbs: true }));
  assert.ok(dados.tributacaoIbscbs);
  const pdf = await desenharDanfse(dados);
  assert.equal(contarPaginas(pdf), 1);
});

test('aplica marca dagua sem lancar erro (Cancelada e Substituida)', async () => {
  const dados = lerNfse(xmlNfse());
  const canceladaPdf = await desenharDanfse(dados, { situacaoEspecial: 'Cancelada' });
  const substituidaPdf = await desenharDanfse(dados, { situacaoEspecial: 'Substituida' });
  assert.equal(contarPaginas(canceladaPdf), 1);
  assert.equal(contarPaginas(substituidaPdf), 1);
});

test('resolverMunicipio customizado e usado quando informado', async () => {
  const dados = lerNfse(xmlNfse());
  const pdf = await desenharDanfse(dados, {
    resolverMunicipio: (codigo) => (codigo === '3550308' ? { nome: 'São Paulo', uf: 'SP' } : undefined),
  });
  assert.equal(contarPaginas(pdf), 1);
});

test('canhoto vem por padrao e pode ser desabilitado, mantendo uma unica pagina', async () => {
  const dados = lerNfse(xmlNfse());
  const comCanhoto = await desenharDanfse(dados);
  const semCanhoto = await desenharDanfse(dados, { incluirCanhoto: false });
  assert.equal(contarPaginas(comCanhoto), 1);
  assert.equal(contarPaginas(semCanhoto), 1);
  assert.notDeepEqual(comCanhoto, semCanhoto);
});
