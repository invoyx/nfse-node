import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import libxmljs from 'libxmljs2';
import { ErroValidacaoDps } from './erros.js';
import { montarXmlDps } from './serializacao.js';
import type { DadosDps } from './tipos.js';

const CAMINHO_SCHEMAS = join(process.cwd(), 'schemas', 'nfse', 'v1.01');

// libxml2 trata ^ e $ como caracteres literais em xs:pattern (XSD nao define
// ancoras de regex), mas o XSD oficial usa esse estilo em TSSerieDPS, o que
// rejeitaria valores legitimos numa validacao estrita. Outros SDKs Node pra
// NFS-e Nacional relatam o mesmo ajuste ao validar contra xmllint/libxml2 -
// nao e uma particularidade deste projeto nem do nosso serializador.
function prepararXsdParaValidacao(): libxmljs.Document {
  const destino = mkdtempSync(join(tmpdir(), 'nfse-node-xsd-'));
  cpSync(CAMINHO_SCHEMAS, destino, { recursive: true });

  const caminhoTiposSimples = join(destino, 'tiposSimples_v1.01.xsd');
  const corrigido = readFileSync(caminhoTiposSimples, 'utf8').replace(
    /<xs:pattern value="\^0\{0,4\}\\d\{1,5\}\$"\/>/,
    '<xs:pattern value="0{0,4}\\d{1,5}"/>'
  );
  writeFileSync(caminhoTiposSimples, corrigido);

  const caminhoDps = join(destino, 'DPS_v1.01.xsd');
  return libxmljs.parseXml(readFileSync(caminhoDps, 'utf8'), { baseUrl: caminhoDps });
}

function dadosDpsExemplo(): DadosDps {
  return {
    tpAmb: '2',
    dhEmi: new Date('2026-06-15T10:30:00-03:00'),
    verAplic: '1.0.0',
    serie: '1',
    nDPS: '1',
    dCompet: new Date('2026-06-01T00:00:00Z'),
    tpEmit: '1',
    cLocEmi: '3550308',
    prest: {
      CNPJ: '12345678000199',
      xNome: 'Empresa Exemplo Ltda',
      regTrib: { opSimpNac: '1', regEspTrib: '0' },
    },
    toma: {
      CPF: '11122233344',
      xNome: 'Cliente Exemplo',
    },
    serv: {
      locPrest: { cLocPrestacao: '3550308' },
      cServ: { cTribNac: '010101', xDescServ: 'Desenvolvimento de software' },
    },
    valores: {
      vServPrest: { vServ: 1500 },
      trib: {
        tribMun: { tribISSQN: '1', tpRetISSQN: '1' },
        totTrib: { pTotTribFed: 0, pTotTribEst: 0, pTotTribMun: 5 },
      },
    },
  };
}

test('monta um XML de DPS valido contra o XSD oficial (DPS_v1.01.xsd)', () => {
  const xsd = prepararXsdParaValidacao();
  const { id, xml } = montarXmlDps(dadosDpsExemplo());

  assert.equal(id.length, 45);
  assert.match(xml, new RegExp(`Id="${id}"`));

  const doc = libxmljs.parseXml(xml);
  const valido = doc.validate(xsd);
  assert.ok(valido, `XML nao passou no XSD oficial: ${doc.validationErrors.join('; ')}`);
});

test('formata valores decimais com ponto e duas casas', () => {
  const { xml } = montarXmlDps(dadosDpsExemplo());
  assert.match(xml, /<vServ>1500\.00<\/vServ>/);
  assert.match(xml, /<pTotTribMun>5\.00<\/pTotTribMun>/);
});

test('escapa conteudo textual no XML', () => {
  const dados = dadosDpsExemplo();
  dados.serv.cServ.xDescServ = 'Consultoria "estratégica" & desenvolvimento <interno>';
  const { xml } = montarXmlDps(dados);
  assert.match(xml, /&quot;estrat.gica&quot; &amp; desenvolvimento &lt;interno&gt;/);
});

test('rejeita quando prest nao informa CNPJ nem CPF', () => {
  const dados = dadosDpsExemplo();
  // @ts-expect-error -- teste propositalmente remove os dois campos de documento
  dados.prest.CNPJ = undefined;
  assert.throws(() => montarXmlDps(dados), ErroValidacaoDps);
});

test('monta um XML de DPS com bloco IBSCBS valido contra o XSD oficial', () => {
  const xsd = prepararXsdParaValidacao();
  const dados = dadosDpsExemplo();
  dados.IBSCBS = {
    finNFSe: '0',
    indFinal: '0',
    cIndOp: '000001',
    tpOper: '5',
    refNFSe: ['35202511222222000199550010000000011234567890123456'.slice(0, 50)],
    tpEnteGov: '4',
    indDest: '1',
    dest: {
      CNPJ: '98765432000155',
      xNome: 'Destinatario Exemplo',
    },
    imovel: { cCIB: 'AB123456' },
    valores: {
      gReeRepRes: [
        {
          dFeNacional: { tipoChaveDFe: '1', chaveDFe: '1'.repeat(50) },
          fornec: { CNPJ: '11222333000181', xNome: 'Fornecedor Exemplo' },
          dtEmiDoc: new Date('2026-06-01T00:00:00Z'),
          dtCompDoc: new Date('2026-06-01T00:00:00Z'),
          tpReeRepRes: '04',
          vlrReeRepRes: 100,
        },
        {
          docOutro: { nDoc: '123', xDoc: 'Recibo de despesa' },
          dtEmiDoc: new Date('2026-06-02T00:00:00Z'),
          dtCompDoc: new Date('2026-06-02T00:00:00Z'),
          tpReeRepRes: '99',
          xTpReeRepRes: 'Reembolso diverso',
          vlrReeRepRes: 50,
        },
      ],
      trib: {
        gIBSCBS: {
          CST: '000',
          cClassTrib: '000001',
          cCredPres: '01',
          gTribRegular: { CSTReg: '000', cClassTribReg: '000001' },
          gDif: { pDifUF: 0, pDifMun: 0, pDifCBS: 0 },
        },
      },
    },
  };

  const { xml } = montarXmlDps(dados);
  const doc = libxmljs.parseXml(xml);
  const valido = doc.validate(xsd);
  assert.ok(valido, `XML nao passou no XSD oficial: ${doc.validationErrors.join('; ')}`);
});

test('rejeita IBSCBS.dest sem CNPJ, CPF, NIF ou cNaoNIF', () => {
  const dados = dadosDpsExemplo();
  dados.IBSCBS = {
    finNFSe: '0',
    cIndOp: '000001',
    indDest: '1',
    // @ts-expect-error -- teste propositalmente nao informa nenhuma identificacao
    dest: { xNome: 'Destinatario Exemplo' },
    valores: { trib: { gIBSCBS: { CST: '000', cClassTrib: '000001' } } },
  };
  assert.throws(() => montarXmlDps(dados), ErroValidacaoDps);
});

test('rejeita IBSCBS.imovel sem cCIB nem end', () => {
  const dados = dadosDpsExemplo();
  dados.IBSCBS = {
    finNFSe: '0',
    cIndOp: '000001',
    indDest: '0',
    imovel: {},
    valores: { trib: { gIBSCBS: { CST: '000', cClassTrib: '000001' } } },
  };
  assert.throws(() => montarXmlDps(dados), ErroValidacaoDps);
});

test('rejeita documento de gReeRepRes sem dFeNacional, docFiscalOutro ou docOutro', () => {
  const dados = dadosDpsExemplo();
  dados.IBSCBS = {
    finNFSe: '0',
    cIndOp: '000001',
    indDest: '0',
    valores: {
      // @ts-expect-error -- teste propositalmente nao informa nenhuma referencia de documento
      gReeRepRes: [{ dtEmiDoc: new Date(), dtCompDoc: new Date(), tpReeRepRes: '01', vlrReeRepRes: 10 }],
      trib: { gIBSCBS: { CST: '000', cClassTrib: '000001' } },
    },
  };
  assert.throws(() => montarXmlDps(dados), ErroValidacaoDps);
});
