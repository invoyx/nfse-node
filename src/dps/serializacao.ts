import { ErroValidacaoDps } from './erros.js';
import { escaparXml, formatarData, formatarDataHora, formatarDecimal } from './formatadores.js';
import { gerarIdDps } from './identificador.js';
import type {
  DadosDps,
  DestinatarioIbscbs,
  DiferimentoIbscbs,
  DocumentoReeRepRes,
  Endereco,
  EnderecoImovel,
  FornecedorReeRepRes,
  IdentificacaoDestinatarioIbscbs,
  ImovelIbscbs,
  InfoIbscbs,
  Pessoa,
  Prestador,
  Servico,
  SituacaoTributariaIbscbs,
  TributacaoRegularIbscbs,
  Valores,
} from './tipos.js';

const NAMESPACE_DPS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO_LEIAUTE = '1.01';

/** Resultado da montagem: XML ainda não assinado e o Id gerado para o elemento infDPS. */
export interface DpsMontada {
  id: string;
  xml: string;
}

/**
 * Monta o XML da DPS a partir dos dados informados, seguindo a ordem de
 * elementos exigida por tiposComplexos_v1.01.xsd (TCInfDPS). O XML retornado
 * ainda não está assinado - use o módulo `assinatura` com o `id` devolvido.
 */
export function montarXmlDps(dados: DadosDps): DpsMontada {
  const documentoEmitente = dados.prest.CNPJ ?? dados.prest.CPF;
  if (!documentoEmitente) {
    throw new ErroValidacaoDps('prest.CNPJ ou prest.CPF é obrigatório para gerar o Id da DPS.');
  }
  const id = gerarIdDps({
    documentoEmitente,
    codigoMunicipioEmissor: dados.cLocEmi,
    serie: dados.serie,
    numero: dados.nDPS,
  });

  const infDps = [
    tag('tpAmb', dados.tpAmb),
    tag('dhEmi', formatarDataHora(dados.dhEmi)),
    tag('verAplic', dados.verAplic),
    tag('serie', dados.serie),
    tag('nDPS', dados.nDPS),
    tag('dCompet', formatarData(dados.dCompet)),
    tag('tpEmit', dados.tpEmit),
    tag('cLocEmi', dados.cLocEmi),
    xmlPrestador(dados.prest),
    dados.toma ? xmlPessoa('toma', dados.toma) : '',
    dados.interm ? xmlPessoa('interm', dados.interm) : '',
    xmlServico(dados.serv),
    xmlValores(dados.valores),
    dados.IBSCBS ? xmlIbscbs(dados.IBSCBS) : '',
  ].join('');

  const xml =
    `<DPS xmlns="${NAMESPACE_DPS}" versao="${VERSAO_LEIAUTE}">` +
    `<infDPS Id="${id}">${infDps}</infDPS>` +
    `</DPS>`;

  return { id, xml };
}

function xmlDocumentoFiscal(doc: { CNPJ?: string; CPF?: string }): string {
  if (doc.CNPJ) return tag('CNPJ', doc.CNPJ);
  if (doc.CPF) return tag('CPF', doc.CPF);
  throw new ErroValidacaoDps('É necessário informar CNPJ ou CPF.');
}

function xmlEndereco(end: Endereco): string {
  return (
    `<endNac>${tag('cMun', end.cMun)}${tag('CEP', end.CEP)}</endNac>` +
    tag('xLgr', end.xLgr) +
    tag('nro', end.nro) +
    tag('xCpl', end.xCpl) +
    tag('xBairro', end.xBairro)
  );
}

function xmlPrestador(prest: Prestador): string {
  const corpo =
    xmlDocumentoFiscal(prest) +
    tag('IM', prest.IM) +
    tag('xNome', prest.xNome) +
    (prest.end ? `<end>${xmlEndereco(prest.end)}</end>` : '') +
    tag('fone', prest.fone) +
    tag('email', prest.email) +
    `<regTrib>${tag('opSimpNac', prest.regTrib.opSimpNac)}${tag('regApTribSN', prest.regTrib.regApTribSN)}${tag('regEspTrib', prest.regTrib.regEspTrib)}</regTrib>`;
  return `<prest>${corpo}</prest>`;
}

function xmlPessoaConteudo(pessoa: Pessoa | DestinatarioIbscbs): string {
  return (
    xmlDocumentoFiscal(pessoa) +
    ('IM' in pessoa ? tag('IM', pessoa.IM) : '') +
    tag('xNome', pessoa.xNome) +
    (pessoa.end ? `<end>${xmlEndereco(pessoa.end)}</end>` : '') +
    tag('fone', pessoa.fone) +
    tag('email', pessoa.email)
  );
}

function xmlPessoa(elemento: 'toma' | 'interm', pessoa: Pessoa): string {
  return `<${elemento}>${xmlPessoaConteudo(pessoa)}</${elemento}>`;
}

function xmlServico(serv: Servico): string {
  const locPrest = serv.locPrest.cLocPrestacao
    ? tag('cLocPrestacao', serv.locPrest.cLocPrestacao)
    : tag('cPaisPrestacao', serv.locPrest.cPaisPrestacao);
  const cServ =
    tag('cTribNac', serv.cServ.cTribNac) +
    tag('cTribMun', serv.cServ.cTribMun) +
    tag('xDescServ', serv.cServ.xDescServ) +
    tag('cNBS', serv.cServ.cNBS);
  return `<serv><locPrest>${locPrest}</locPrest><cServ>${cServ}</cServ></serv>`;
}

function xmlValores(valores: Valores): string {
  const vServPrest =
    tagNum('vReceb', valores.vServPrest.vReceb) + tagNum('vServ', valores.vServPrest.vServ);
  const vDescCondIncond = valores.vDescCondIncond
    ? `<vDescCondIncond>${tagNum('vDescIncond', valores.vDescCondIncond.vDescIncond)}${tagNum('vDescCond', valores.vDescCondIncond.vDescCond)}</vDescCondIncond>`
    : '';

  const tribMun = valores.trib.tribMun;
  const xmlTribMun =
    `<tribMun>` +
    tag('tribISSQN', tribMun.tribISSQN) +
    tag('cPaisResult', tribMun.cPaisResult) +
    tag('tpImunidade', tribMun.tpImunidade) +
    tag('tpRetISSQN', tribMun.tpRetISSQN) +
    tagNum('pAliq', tribMun.pAliq) +
    `</tribMun>`;

  const tribFed = valores.trib.tribFed;
  const xmlTribFed = tribFed
    ? `<tribFed>${
        tribFed.piscofins
          ? `<piscofins>${tag('CST', tribFed.piscofins.CST)}${tagNum('vBCPisCofins', tribFed.piscofins.vBCPisCofins)}${tagNum('pAliqPis', tribFed.piscofins.pAliqPis)}${tagNum('pAliqCofins', tribFed.piscofins.pAliqCofins)}${tagNum('vPis', tribFed.piscofins.vPis)}${tagNum('vCofins', tribFed.piscofins.vCofins)}${tag('tpRetPisCofins', tribFed.piscofins.tpRetPisCofins)}</piscofins>`
          : ''
      }${tagNum('vRetCP', tribFed.vRetCP)}${tagNum('vRetIRRF', tribFed.vRetIRRF)}${tagNum('vRetCSLL', tribFed.vRetCSLL)}</tribFed>`
    : '';

  const totTrib = valores.trib.totTrib;
  const xmlTotTrib =
    'vTotTribFed' in totTrib && totTrib.vTotTribFed !== undefined
      ? `<vTotTrib>${tagNum('vTotTribFed', totTrib.vTotTribFed)}${tagNum('vTotTribEst', totTrib.vTotTribEst)}${tagNum('vTotTribMun', totTrib.vTotTribMun)}</vTotTrib>`
      : `<pTotTrib>${tagNum('pTotTribFed', totTrib.pTotTribFed)}${tagNum('pTotTribEst', totTrib.pTotTribEst)}${tagNum('pTotTribMun', totTrib.pTotTribMun)}</pTotTrib>`;

  return (
    `<valores>` +
    `<vServPrest>${vServPrest}</vServPrest>` +
    vDescCondIncond +
    `<trib>${xmlTribMun}${xmlTribFed}<totTrib>${xmlTotTrib}</totTrib></trib>` +
    `</valores>`
  );
}

function xmlIdentificacaoDest(dest: IdentificacaoDestinatarioIbscbs, contexto: string): string {
  if (dest.CNPJ) return tag('CNPJ', dest.CNPJ);
  if (dest.CPF) return tag('CPF', dest.CPF);
  if (dest.NIF) return tag('NIF', dest.NIF);
  if (dest.cNaoNIF) return tag('cNaoNIF', dest.cNaoNIF);
  throw new ErroValidacaoDps(`${contexto} precisa informar CNPJ, CPF, NIF ou cNaoNIF.`);
}

function xmlDest(dest: DestinatarioIbscbs): string {
  return (
    `<dest>` +
    xmlIdentificacaoDest(dest, 'IBSCBS.dest') +
    tag('xNome', dest.xNome) +
    (dest.end ? `<end>${xmlEndereco(dest.end)}</end>` : '') +
    tag('fone', dest.fone) +
    tag('email', dest.email) +
    `</dest>`
  );
}

function xmlEnderecoImovel(end: EnderecoImovel): string {
  const escolha = end.CEP
    ? tag('CEP', end.CEP)
    : end.endExt
      ? `<endExt>${tag('cEndPost', end.endExt.cEndPost)}${tag('xCidade', end.endExt.xCidade)}${tag('xEstProvReg', end.endExt.xEstProvReg)}</endExt>`
      : '';
  if (!escolha) {
    throw new ErroValidacaoDps('IBSCBS.imovel.end precisa informar CEP ou endExt.');
  }
  return (
    escolha + tag('xLgr', end.xLgr) + tag('nro', end.nro) + tag('xCpl', end.xCpl) + tag('xBairro', end.xBairro)
  );
}

function xmlImovel(imovel: ImovelIbscbs): string {
  const inscImobFisc = tag('inscImobFisc', imovel.inscImobFisc);
  if (imovel.cCIB) {
    return `<imovel>${inscImobFisc}${tag('cCIB', imovel.cCIB)}</imovel>`;
  }
  if (imovel.end) {
    return `<imovel>${inscImobFisc}<end>${xmlEnderecoImovel(imovel.end)}</end></imovel>`;
  }
  throw new ErroValidacaoDps('IBSCBS.imovel precisa informar cCIB ou end.');
}

function xmlTributacaoRegularIbscbs(reg: TributacaoRegularIbscbs): string {
  return `<gTribRegular>${tag('CSTReg', reg.CSTReg)}${tag('cClassTribReg', reg.cClassTribReg)}</gTribRegular>`;
}

function xmlDiferimentoIbscbs(dif: DiferimentoIbscbs): string {
  return `<gDif>${tagNum('pDifUF', dif.pDifUF)}${tagNum('pDifMun', dif.pDifMun)}${tagNum('pDifCBS', dif.pDifCBS)}</gDif>`;
}

function xmlSituacaoTributariaIbscbs(sit: SituacaoTributariaIbscbs): string {
  return (
    `<gIBSCBS>` +
    tag('CST', sit.CST) +
    tag('cClassTrib', sit.cClassTrib) +
    tag('cCredPres', sit.cCredPres) +
    (sit.gTribRegular ? xmlTributacaoRegularIbscbs(sit.gTribRegular) : '') +
    (sit.gDif ? xmlDiferimentoIbscbs(sit.gDif) : '') +
    `</gIBSCBS>`
  );
}

function xmlRefNFSe(refs: string[]): string {
  return `<gRefNFSe>${refs.map((ref) => tag('refNFSe', ref)).join('')}</gRefNFSe>`;
}

function xmlDocumentoReferenciadoReeRepRes(doc: DocumentoReeRepRes): string {
  if (doc.dFeNacional) {
    const d = doc.dFeNacional;
    return `<dFeNacional>${tag('tipoChaveDFe', d.tipoChaveDFe)}${tag('xTipoChaveDFe', d.xTipoChaveDFe)}${tag('chaveDFe', d.chaveDFe)}</dFeNacional>`;
  }
  if (doc.docFiscalOutro) {
    const d = doc.docFiscalOutro;
    return `<docFiscalOutro>${tag('cMunDocFiscal', d.cMunDocFiscal)}${tag('nDocFiscal', d.nDocFiscal)}${tag('xDocFiscal', d.xDocFiscal)}</docFiscalOutro>`;
  }
  if (doc.docOutro) {
    const d = doc.docOutro;
    return `<docOutro>${tag('nDoc', d.nDoc)}${tag('xDoc', d.xDoc)}</docOutro>`;
  }
  throw new ErroValidacaoDps(
    'IBSCBS.valores.gReeRepRes: cada documento precisa informar dFeNacional, docFiscalOutro ou docOutro.'
  );
}

function xmlFornecedorReeRepRes(fornec: FornecedorReeRepRes): string {
  return `<fornec>${xmlIdentificacaoDest(fornec, 'IBSCBS.valores.gReeRepRes.fornec')}${tag('xNome', fornec.xNome)}</fornec>`;
}

function xmlDocumentoReeRepRes(doc: DocumentoReeRepRes): string {
  return (
    `<documentos>` +
    xmlDocumentoReferenciadoReeRepRes(doc) +
    (doc.fornec ? xmlFornecedorReeRepRes(doc.fornec) : '') +
    tag('dtEmiDoc', formatarData(doc.dtEmiDoc)) +
    tag('dtCompDoc', formatarData(doc.dtCompDoc)) +
    tag('tpReeRepRes', doc.tpReeRepRes) +
    tag('xTpReeRepRes', doc.xTpReeRepRes) +
    tagNum('vlrReeRepRes', doc.vlrReeRepRes) +
    `</documentos>`
  );
}

function xmlGReeRepRes(documentos: DocumentoReeRepRes[]): string {
  return `<gReeRepRes>${documentos.map(xmlDocumentoReeRepRes).join('')}</gReeRepRes>`;
}

function xmlIbscbs(ibscbs: InfoIbscbs): string {
  const gReeRepRes =
    ibscbs.valores.gReeRepRes && ibscbs.valores.gReeRepRes.length > 0
      ? xmlGReeRepRes(ibscbs.valores.gReeRepRes)
      : '';

  return (
    `<IBSCBS>` +
    tag('finNFSe', ibscbs.finNFSe) +
    tag('indFinal', ibscbs.indFinal) +
    tag('cIndOp', ibscbs.cIndOp) +
    tag('tpOper', ibscbs.tpOper) +
    (ibscbs.refNFSe && ibscbs.refNFSe.length > 0 ? xmlRefNFSe(ibscbs.refNFSe) : '') +
    tag('tpEnteGov', ibscbs.tpEnteGov) +
    tag('indDest', ibscbs.indDest) +
    (ibscbs.dest ? xmlDest(ibscbs.dest) : '') +
    (ibscbs.imovel ? xmlImovel(ibscbs.imovel) : '') +
    `<valores>${gReeRepRes}<trib>${xmlSituacaoTributariaIbscbs(ibscbs.valores.trib.gIBSCBS)}</trib></valores>` +
    `</IBSCBS>`
  );
}

function tag(nome: string, valor: string | undefined): string {
  return valor === undefined || valor === '' ? '' : `<${nome}>${escaparXml(valor)}</${nome}>`;
}

function tagNum(nome: string, valor: number | undefined): string {
  return valor === undefined ? '' : `<${nome}>${formatarDecimal(valor)}</${nome}>`;
}
