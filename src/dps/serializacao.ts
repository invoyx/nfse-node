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

function xmlEndereco(end: Endereco, contexto: string): string {
  return (
    `<endNac>${tag('cMun', end.cMun)}${tag('CEP', end.CEP)}</endNac>` +
    tagSemQuebra('xLgr', end.xLgr, contexto) +
    tagSemQuebra('nro', end.nro, contexto) +
    tagSemQuebra('xCpl', end.xCpl, contexto) +
    tagSemQuebra('xBairro', end.xBairro, contexto)
  );
}

function xmlPrestador(prest: Prestador): string {
  const corpo =
    xmlDocumentoFiscal(prest) +
    tag('IM', prest.IM) +
    tag('xNome', prest.xNome) +
    (prest.end ? `<end>${xmlEndereco(prest.end, 'prest.end')}</end>` : '') +
    tag('fone', prest.fone) +
    tagSemQuebra('email', prest.email, 'prest') +
    `<regTrib>${tag('opSimpNac', prest.regTrib.opSimpNac)}${tag('regApTribSN', prest.regTrib.regApTribSN)}${tag('regEspTrib', prest.regTrib.regEspTrib)}</regTrib>`;
  return `<prest>${corpo}</prest>`;
}

function xmlPessoaConteudo(pessoa: Pessoa | DestinatarioIbscbs, contexto: string): string {
  return (
    xmlDocumentoFiscal(pessoa) +
    ('IM' in pessoa ? tag('IM', pessoa.IM) : '') +
    tag('xNome', pessoa.xNome) +
    (pessoa.end ? `<end>${xmlEndereco(pessoa.end, `${contexto}.end`)}</end>` : '') +
    tag('fone', pessoa.fone) +
    tagSemQuebra('email', pessoa.email, contexto)
  );
}

function xmlPessoa(elemento: 'toma' | 'interm', pessoa: Pessoa): string {
  return `<${elemento}>${xmlPessoaConteudo(pessoa, elemento)}</${elemento}>`;
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
    tagSemQuebra('xNome', dest.xNome, 'IBSCBS.dest') +
    (dest.end ? `<end>${xmlEndereco(dest.end, 'IBSCBS.dest.end')}</end>` : '') +
    tag('fone', dest.fone) +
    tagSemQuebra('email', dest.email, 'IBSCBS.dest') +
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
    escolha +
    tagSemQuebra('xLgr', end.xLgr, 'IBSCBS.imovel.end') +
    tagSemQuebra('nro', end.nro, 'IBSCBS.imovel.end') +
    tagSemQuebra('xCpl', end.xCpl, 'IBSCBS.imovel.end') +
    tagSemQuebra('xBairro', end.xBairro, 'IBSCBS.imovel.end')
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

// RN 627 (SEFIN Nacional): o CST nunca e informado a parte, e sempre os 3
// primeiros digitos do cClassTrib - derivar aqui evita gerar um par
// CST/cClassTrib inconsistente.
function derivarCstDoClassTrib(cClassTrib: string): string {
  return cClassTrib.slice(0, 3);
}

function xmlTributacaoRegularIbscbs(reg: TributacaoRegularIbscbs): string {
  return `<gTribRegular>${tag('CSTReg', derivarCstDoClassTrib(reg.cClassTribReg))}${tag('cClassTribReg', reg.cClassTribReg)}</gTribRegular>`;
}

function xmlDiferimentoIbscbs(dif: DiferimentoIbscbs): string {
  return `<gDif>${tagNum('pDifUF', dif.pDifUF)}${tagNum('pDifMun', dif.pDifMun)}${tagNum('pDifCBS', dif.pDifCBS)}</gDif>`;
}

function xmlSituacaoTributariaIbscbs(sit: SituacaoTributariaIbscbs): string {
  return (
    `<gIBSCBS>` +
    tag('CST', derivarCstDoClassTrib(sit.cClassTrib)) +
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
    const contexto = 'IBSCBS.valores.gReeRepRes.dFeNacional';
    return `<dFeNacional>${tag('tipoChaveDFe', d.tipoChaveDFe)}${tagSemQuebra('xTipoChaveDFe', d.xTipoChaveDFe, contexto)}${tag('chaveDFe', d.chaveDFe)}</dFeNacional>`;
  }
  if (doc.docFiscalOutro) {
    const d = doc.docFiscalOutro;
    const contexto = 'IBSCBS.valores.gReeRepRes.docFiscalOutro';
    return `<docFiscalOutro>${tag('cMunDocFiscal', d.cMunDocFiscal)}${tag('nDocFiscal', d.nDocFiscal)}${tagSemQuebra('xDocFiscal', d.xDocFiscal, contexto)}</docFiscalOutro>`;
  }
  if (doc.docOutro) {
    const d = doc.docOutro;
    const contexto = 'IBSCBS.valores.gReeRepRes.docOutro';
    return `<docOutro>${tag('nDoc', d.nDoc)}${tagSemQuebra('xDoc', d.xDoc, contexto)}</docOutro>`;
  }
  throw new ErroValidacaoDps(
    'IBSCBS.valores.gReeRepRes: cada documento precisa informar dFeNacional, docFiscalOutro ou docOutro.'
  );
}

function xmlFornecedorReeRepRes(fornec: FornecedorReeRepRes): string {
  const contexto = 'IBSCBS.valores.gReeRepRes.fornec';
  return `<fornec>${xmlIdentificacaoDest(fornec, contexto)}${tagSemQuebra('xNome', fornec.xNome, contexto)}</fornec>`;
}

function xmlDocumentoReeRepRes(doc: DocumentoReeRepRes): string {
  return (
    `<documentos>` +
    xmlDocumentoReferenciadoReeRepRes(doc) +
    (doc.fornec ? xmlFornecedorReeRepRes(doc.fornec) : '') +
    tag('dtEmiDoc', formatarData(doc.dtEmiDoc)) +
    tag('dtCompDoc', formatarData(doc.dtCompDoc)) +
    tag('tpReeRepRes', doc.tpReeRepRes) +
    tagSemQuebra('xTpReeRepRes', doc.xTpReeRepRes, 'IBSCBS.valores.gReeRepRes') +
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

// A maioria dos campos de texto livre do schema (tipo TSString em
// tiposSimples_v1.01.xsd) rejeita quebra de linha, tabulacao ou qualquer
// outro caractere de controle - confirmado validando contra o XSD oficial.
// Submeter um deles faz a SEFIN Nacional recusar a DPS inteira (E1235) em
// vez de so o valor problematico. xDescServ e a unica excecao conhecida
// (tipo TSStringComQuebraDeLinha, permite quebra de linha de proposito) e
// por isso continua usando tag() direto. Validar aqui da um erro local e
// claro, em vez de deixar a rejeicao acontecer do lado do governo.
function tagSemQuebra(nome: string, valor: string | undefined, contexto: string): string {
  if (valor === undefined || valor === '') return '';
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(valor)) {
    throw new ErroValidacaoDps(
      `${contexto}.${nome} nao pode conter quebra de linha, tabulacao ou outro caractere de controle.`
    );
  }
  return tag(nome, valor);
}
