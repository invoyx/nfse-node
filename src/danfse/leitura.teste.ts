import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErroLeituraNfse } from './erros.js';
import { lerNfse } from './leitura.js';

const NS = 'http://www.sped.fazenda.gov.br/nfse';

function xmlNfseBase(opcoes: {
  indDest?: string;
  destXml?: string;
  tpRetPisCofins?: string;
  vPis?: string;
  vCofins?: string;
  vRetCSLL?: string;
  regEspTrib?: string;
  tribMunExtra?: string;
  vDescIncond?: string;
} = {}): string {
  const ibscbsDeclarado = opcoes.indDest
    ? `<IBSCBS>
         <finNFSe>1</finNFSe>
         <cIndOp>1</cIndOp>
         <indDest>${opcoes.indDest}</indDest>
         ${opcoes.destXml ?? ''}
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
          <regTrib><opSimpNac>1</opSimpNac><regEspTrib>${opcoes.regEspTrib ?? '0'}</regEspTrib></regTrib>
        </prest>
        <toma><CPF>11122233344</CPF><xNome>Cliente Exemplo</xNome></toma>
        <serv>
          <locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest>
          <cServ><cTribNac>010101</cTribNac><xDescServ>Desenvolvimento de software sob demanda</xDescServ></cServ>
        </serv>
        <valores>
          <vServPrest><vServ>1500.00</vServ></vServPrest>
          ${opcoes.vDescIncond ? `<vDescCondIncond><vDescIncond>${opcoes.vDescIncond}</vDescIncond></vDescCondIncond>` : ''}
          <trib>
            <tribMun><tribISSQN>1</tribISSQN>${opcoes.tribMunExtra ?? ''}<tpRetISSQN>1</tpRetISSQN></tribMun>
            ${
              opcoes.tpRetPisCofins
                ? `<tribFed>
                     <piscofins><CST>01</CST><vPis>${opcoes.vPis ?? '0.00'}</vPis><vCofins>${opcoes.vCofins ?? '0.00'}</vCofins><tpRetPisCofins>${opcoes.tpRetPisCofins}</tpRetPisCofins></piscofins>
                     <vRetCSLL>${opcoes.vRetCSLL ?? '0.00'}</vRetCSLL>
                   </tribFed>`
                : ''
            }
            <totTrib><pTotTrib><pTotTribFed>0.00</pTotTribFed><pTotTribEst>0.00</pTotTribEst><pTotTribMun>5.00</pTotTribMun></pTotTrib></totTrib>
          </trib>
        </valores>
        ${ibscbsDeclarado}
      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>`;
}

test('le os campos principais da identificacao, prestador, tomador e servico', () => {
  const dados = lerNfse(xmlNfseBase());

  assert.equal(dados.chaveAcesso.length, 50);
  assert.equal(dados.numero, '123');
  assert.equal(dados.situacao, '100');
  assert.equal(dados.municipioEmissor, 'São Paulo');

  assert.equal(dados.prestador.cnpj, '12345678000199');
  assert.equal(dados.prestador.nome, 'Empresa Exemplo Ltda');
  assert.equal(dados.prestador.endereco?.uf, 'SP');

  assert.equal(dados.tomador?.cpf, '11122233344');
  assert.equal(dados.tomador?.nome, 'Cliente Exemplo');

  assert.equal(dados.servico.descricao, 'Desenvolvimento de software sob demanda');
  assert.equal(dados.servico.codigoTribNacional, '010101');

  assert.equal(dados.valorTotal.valorServico, 1500);
  assert.equal(dados.valorTotal.valorLiquido, 1425);
});

test('sem bloco IBSCBS: destinatario nao identificado, sem inferir pela ausencia de dest', () => {
  const dados = lerNfse(xmlNfseBase());
  assert.equal(dados.destinatario, undefined);
  assert.equal(dados.destinatarioEhTomador, false);
});

test('indDest = 0: destinatario e o proprio tomador (sinal explicito, nao heuristica)', () => {
  const dados = lerNfse(xmlNfseBase({ indDest: '0' }));
  assert.equal(dados.destinatarioEhTomador, true);
  assert.equal(dados.destinatario, undefined);
});

test('indDest = 1 com dest: le os dados do destinatario', () => {
  const destXml = '<dest><CNPJ>98765432000188</CNPJ><xNome>Destinatario Final Ltda</xNome></dest>';
  const dados = lerNfse(xmlNfseBase({ indDest: '1', destXml }));
  assert.equal(dados.destinatarioEhTomador, false);
  assert.equal(dados.destinatario?.cnpj, '98765432000188');
  assert.equal(dados.destinatario?.nome, 'Destinatario Final Ltda');
});

test('tpRetPisCofins = 1: soma vRetCSLL+vPis+vCofins e zera os debitos de apuracao propria', () => {
  const dados = lerNfse(
    xmlNfseBase({ tpRetPisCofins: '1', vPis: '10.00', vCofins: '20.00', vRetCSLL: '5.00' })
  );
  assert.equal(dados.tributacaoFederal.contribuicoesSociaisRetidas, 35);
  assert.equal(dados.tributacaoFederal.pisDebito, 0);
  assert.equal(dados.tributacaoFederal.cofinsDebito, 0);
});

test('tpRetPisCofins != 1: cada campo fica como veio, sem somar', () => {
  const dados = lerNfse(
    xmlNfseBase({ tpRetPisCofins: '0', vPis: '10.00', vCofins: '20.00', vRetCSLL: '5.00' })
  );
  assert.equal(dados.tributacaoFederal.contribuicoesSociaisRetidas, 5);
  assert.equal(dados.tributacaoFederal.pisDebito, 10);
  assert.equal(dados.tributacaoFederal.cofinsDebito, 20);
});

test('rejeita XML sem infNFSe/DPS/infDPS', () => {
  assert.throws(() => lerNfse('<NFSe xmlns="' + NS + '"></NFSe>'), ErroLeituraNfse);
});

test('le o regime especial de tributacao do ISSQN a partir de prest/regTrib (nao fica "-")', () => {
  const dados = lerNfse(xmlNfseBase({ regEspTrib: '5' }));
  assert.equal(dados.tributacaoMunicipal?.regimeEspecialTributacao, '5');
});

test('le o desconto incondicionado do bloco de tributacao municipal', () => {
  const dados = lerNfse(xmlNfseBase({ vDescIncond: '50.00' }));
  assert.equal(dados.tributacaoMunicipal?.descontoIncondicionado, 50);
});

test('le o percentual/valor declarados do beneficio municipal (BM/pRedBCBM e BM/vRedBCBM)', () => {
  const dados = lerNfse(xmlNfseBase({ tribMunExtra: '<BM><nBM>3550308010000000001</nBM><pRedBCBM>10.00</pRedBCBM></BM>' }));
  assert.equal(dados.tributacaoMunicipal?.beneficioMunicipalPercentualReducao, 10);
});
