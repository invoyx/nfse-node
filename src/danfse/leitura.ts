import { DOMParser, type Element } from '@xmldom/xmldom';
import { atributo, filho, filhos, numero, texto, textos } from './dom.js';
import { ErroLeituraNfse } from './erros.js';
import type {
  DeducaoReducaoLegivel,
  DestinatarioIbscbsLegivel,
  DocumentoDeducaoLegivel,
  EnderecoLegivel,
  InformacoesComplementaresLegivel,
  NfseLegivel,
  PessoaLegivel,
  PrestadorLegivel,
  ServicoLegivel,
  TributacaoFederalLegivel,
  TributacaoIbscbsLegivel,
  TributacaoMunicipalLegivel,
  ValorTotalLegivel,
} from './tipos.js';

/**
 * Lê o XML da NFS-e (o documento devolvido pelo SEFIN Nacional, não a DPS)
 * e devolve os dados prontos para o desenho do DANFSe. Não formata nada
 * para exibição - isso é responsabilidade da camada de desenho.
 */
export function lerNfse(xml: string): NfseLegivel {
  const documento = new DOMParser().parseFromString(xml, 'text/xml');
  const raiz = documento.documentElement as Element | null;
  const infNFSe = raiz?.localName === 'infNFSe' ? raiz : filho(raiz, 'infNFSe');
  const dps = filho(infNFSe, 'DPS');
  const infDPS = filho(dps, 'infDPS');
  if (!infNFSe || !infDPS) {
    throw new ErroLeituraNfse('XML inválido: os grupos infNFSe e infNFSe/DPS/infDPS são obrigatórios.');
  }

  const chaveComPrefixo = atributo(infNFSe, 'Id') ?? '';
  const chaveAcesso = chaveComPrefixo.replace(/^NFS/, '');

  const emit = filho(infNFSe, 'emit');
  const valoresNfse = filho(infNFSe, 'valores');
  const ibscbsNfse = filho(infNFSe, 'IBSCBS');

  const prest = filho(infDPS, 'prest');
  const toma = filho(infDPS, 'toma');
  const interm = filho(infDPS, 'interm');
  const serv = filho(infDPS, 'serv');
  const valoresDps = filho(infDPS, 'valores');
  const tribDps = filho(valoresDps, 'trib');
  const tribMun = filho(tribDps, 'tribMun');
  const tribFed = filho(tribDps, 'tribFed');
  const ibscbsDps = filho(infDPS, 'IBSCBS');

  if (!prest || !serv || !valoresDps || !tribMun) {
    throw new ErroLeituraNfse(
      'XML inválido: os grupos prest, serv e valores/trib/tribMun são obrigatórios dentro de infDPS.'
    );
  }

  return {
    chaveAcesso,
    numero: texto(infNFSe, 'nNFSe') ?? '',
    competencia: dataObrigatoria(infDPS, 'dCompet'),
    dataHoraEmissaoNfse: dataHoraObrigatoria(infNFSe, 'dhProc'),
    numeroDps: texto(infDPS, 'nDPS') ?? '',
    serieDps: texto(infDPS, 'serie') ?? '',
    dataHoraEmissaoDps: dataHoraObrigatoria(infDPS, 'dhEmi'),
    tipoEmitente: texto(infDPS, 'tpEmit') ?? '',
    situacao: texto(infNFSe, 'cStat') ?? '',
    finalidade: texto(ibscbsDps, 'finNFSe'),
    municipioEmissor: texto(infNFSe, 'xLocEmi') ?? '',
    ambienteGerador: texto(infNFSe, 'ambGer') ?? '',
    tipoAmbiente: texto(infDPS, 'tpAmb') ?? '',

    prestador: lerPrestador(prest, emit),
    tomador: toma ? lerPessoa(toma) : undefined,
    ...lerDestinatario(ibscbsDps),
    intermediario: interm ? lerPessoa(interm) : undefined,

    servico: lerServico(infNFSe, serv),
    tributacaoMunicipal: lerTributacaoMunicipal(infNFSe, tribMun, valoresNfse, filho(prest, 'regTrib'), filho(valoresDps, 'vDescCondIncond')),
    tributacaoFederal: lerTributacaoFederal(tribFed),
    tributacaoIbscbs: lerTributacaoIbscbs(ibscbsDps, ibscbsNfse),
    valorTotal: lerValorTotal(valoresDps, valoresNfse, ibscbsNfse),
    deducaoReducao: lerDeducaoReducao(valoresDps),
    informacoesComplementares: lerInformacoesComplementares(infNFSe, infDPS, serv),
  };
}

function dataObrigatoria(elemento: Element | undefined, nomeLocal: string): Date {
  const bruto = texto(elemento, nomeLocal);
  if (!bruto) throw new ErroLeituraNfse(`Campo obrigatório ausente: ${nomeLocal}.`);
  return new Date(bruto);
}

function dataHoraObrigatoria(elemento: Element | undefined, nomeLocal: string): Date {
  return dataObrigatoria(elemento, nomeLocal);
}

function lerEndereco(end: Element | undefined): EnderecoLegivel | undefined {
  if (!end) return undefined;
  const endNac = filho(end, 'endNac');
  const endExt = filho(end, 'endExt');
  return {
    logradouro: texto(end, 'xLgr'),
    numero: texto(end, 'nro'),
    complemento: texto(end, 'xCpl'),
    bairro: texto(end, 'xBairro'),
    codigoMunicipio: texto(endNac, 'cMun'),
    cep: texto(endNac, 'CEP'),
    codigoPostalExterior: texto(endExt, 'cEndPost'),
    cidadeExterior: texto(endExt, 'xCidade'),
    estadoProvinciaExterior: texto(endExt, 'xEstProvReg'),
  };
}

function lerEnderecoEmitente(end: Element | undefined): EnderecoLegivel | undefined {
  if (!end) return undefined;
  return {
    logradouro: texto(end, 'xLgr'),
    numero: texto(end, 'nro'),
    complemento: texto(end, 'xCpl'),
    bairro: texto(end, 'xBairro'),
    codigoMunicipio: texto(end, 'cMun'),
    uf: texto(end, 'UF'),
    cep: texto(end, 'CEP'),
  };
}

function lerPessoa(pessoa: Element | undefined): PessoaLegivel {
  return {
    cnpj: texto(pessoa, 'CNPJ'),
    cpf: texto(pessoa, 'CPF'),
    nif: texto(pessoa, 'NIF'),
    inscricaoMunicipal: texto(pessoa, 'IM'),
    nome: texto(pessoa, 'xNome'),
    telefone: texto(pessoa, 'fone'),
    email: texto(pessoa, 'email'),
    endereco: lerEndereco(filho(pessoa, 'end')),
  };
}

function lerPrestador(prest: Element, emit: Element | undefined): PrestadorLegivel {
  const regTrib = filho(prest, 'regTrib');
  const base = lerPessoa(prest);
  // Alguns campos do prestador (nome, endereço) só são de preenchimento
  // obrigatório em `emit` quando a DPS é emitida pelo próprio prestador
  // (tpEmit = 1) - usamos `emit` como reforço quando `prest` vier incompleto.
  return {
    cnpj: base.cnpj ?? texto(emit, 'CNPJ'),
    cpf: base.cpf ?? texto(emit, 'CPF'),
    inscricaoMunicipal: base.inscricaoMunicipal ?? texto(emit, 'IM'),
    nome: base.nome ?? texto(emit, 'xNome'),
    telefone: base.telefone ?? texto(emit, 'fone'),
    email: base.email ?? texto(emit, 'email'),
    endereco: base.endereco ?? lerEnderecoEmitente(filho(emit, 'enderNac')),
    opcaoSimplesNacional: texto(regTrib, 'opSimpNac'),
    regimeApuracaoSimplesNacional: texto(regTrib, 'regApTribSN'),
  };
}

// indDest = "0": destinatário é o próprio tomador (TSRTCIndDest, tiposSimples).
// Só existe um sinal explícito pra isso dentro do bloco IBSCBS - não dá pra
// inferir com segurança pela simples ausência do bloco `dest` (heurística que
// a implementação de referência usava, e que essa nota técnica não confirma).
function lerDestinatario(
  ibscbsDps: Element | undefined
): { destinatario?: DestinatarioIbscbsLegivel; destinatarioEhTomador: boolean } {
  const indDest = texto(ibscbsDps, 'indDest');
  if (indDest === '0') return { destinatarioEhTomador: true };

  const dest = filho(ibscbsDps, 'dest');
  if (indDest === '1' && dest) return { destinatario: lerPessoa(dest), destinatarioEhTomador: false };

  // Sem IBSCBS (NFS-e anterior à reforma) ou sem indDest: não há sinal.
  return { destinatarioEhTomador: false };
}

function lerServico(infNFSe: Element, serv: Element): ServicoLegivel {
  const cServ = filho(serv, 'cServ');
  const locPrest = filho(serv, 'locPrest');
  return {
    codigoTribNacional: texto(cServ, 'cTribNac'),
    codigoTribMunicipal: texto(cServ, 'cTribMun'),
    descricaoTribNacional: texto(infNFSe, 'xTribNac'),
    descricaoTribMunicipal: texto(infNFSe, 'xTribMun'),
    codigoNbs: texto(cServ, 'cNBS'),
    codigoMunicipioPrestacao: texto(locPrest, 'cLocPrestacao'),
    codigoPaisPrestacao: texto(locPrest, 'cPaisPrestacao'),
    descricao: texto(cServ, 'xDescServ') ?? '',
  };
}

function lerTributacaoMunicipal(
  infNFSe: Element,
  tribMun: Element,
  valoresNfse: Element | undefined,
  regTrib: Element | undefined,
  vDescCondIncond: Element | undefined
): TributacaoMunicipalLegivel | undefined {
  const tribISSQN = texto(tribMun, 'tribISSQN');
  if (!tribISSQN) return undefined;

  const exigSusp = filho(tribMun, 'exigSusp');
  const bm = filho(tribMun, 'BM');
  return {
    tribISSQN,
    // cLocIncid/xLocIncid ficam em infNFSe, não em tribMun - o governo já
    // devolve a descrição do município pronta, sem precisar de tabela IBGE.
    codigoMunicipioIncidencia: texto(infNFSe, 'cLocIncid'),
    descricaoMunicipioIncidencia: texto(infNFSe, 'xLocIncid'),
    codigoPaisIncidencia: texto(tribMun, 'cPaisResult'),
    // regEspTrib fica em prest/regTrib no XSD, não em tribMun - mas a
    // NT-008 exibe esse campo dentro do bloco Tributação Municipal.
    regimeEspecialTributacao: texto(regTrib, 'regEspTrib'),
    tipoImunidade: texto(tribMun, 'tpImunidade'),
    suspensaoTipo: texto(exigSusp, 'tpSusp'),
    suspensaoNumeroProcesso: texto(exigSusp, 'nProcesso'),
    beneficioMunicipalTipo: texto(valoresNfse, 'tpBM'),
    beneficioMunicipalValor: numero(valoresNfse, 'vCalcBM'),
    beneficioMunicipalPercentualReducao: numero(bm, 'pRedBCBM'),
    beneficioMunicipalValorReducao: numero(bm, 'vRedBCBM'),
    totalDeducoesReducoes: numero(valoresNfse, 'vCalcDR'),
    descontoIncondicionado: numero(vDescCondIncond, 'vDescIncond'),
    baseCalculo: numero(valoresNfse, 'vBC'),
    aliquotaAplicada: numero(valoresNfse, 'pAliqAplic'),
    retencaoIssqn: texto(tribMun, 'tpRetISSQN'),
    issqnApurado: numero(valoresNfse, 'vISSQN'),
  };
}

// A NT-008 v1.02 mudou a regra: quando tpRetPisCofins = "1" (PIS/COFINS
// retidos), "Contribuições Sociais - Retidas" soma vRetCSLL+vPis+vCofins, e
// PIS/COFINS - Débito Apuração Própria voltam 0 (o débito foi retido, não é
// mais apuração própria). Nos demais casos cada campo é exibido como veio.
function lerTributacaoFederal(tribFed: Element | undefined): TributacaoFederalLegivel {
  const piscofins = filho(tribFed, 'piscofins');
  const tipoRetencaoPisCofins = texto(piscofins, 'tpRetPisCofins');
  const vRetCSLL = numero(tribFed, 'vRetCSLL');
  const vPis = numero(piscofins, 'vPis');
  const vCofins = numero(piscofins, 'vCofins');
  const pisCofinsRetidos = tipoRetencaoPisCofins === '1';

  return {
    irrf: numero(tribFed, 'vRetIRRF'),
    contribuicaoPrevidenciaria: numero(tribFed, 'vRetCP'),
    contribuicoesSociaisRetidas: pisCofinsRetidos
      ? (vRetCSLL ?? 0) + (vPis ?? 0) + (vCofins ?? 0)
      : vRetCSLL,
    pisDebito: pisCofinsRetidos ? 0 : vPis,
    cofinsDebito: pisCofinsRetidos ? 0 : vCofins,
    tipoRetencaoPisCofins,
  };
}

function lerTributacaoIbscbs(
  ibscbsDps: Element | undefined,
  ibscbsNfse: Element | undefined
): TributacaoIbscbsLegivel | undefined {
  if (!ibscbsDps && !ibscbsNfse) return undefined;

  const valoresDeclarados = filho(ibscbsDps, 'valores');
  const tribDeclarado = filho(valoresDeclarados, 'trib');
  const gIbscbs = filho(tribDeclarado, 'gIBSCBS');

  const valoresApurados = filho(ibscbsNfse, 'valores');
  const uf = filho(valoresApurados, 'uf');
  const mun = filho(valoresApurados, 'mun');
  const fed = filho(valoresApurados, 'fed');
  const totCIBS = filho(ibscbsNfse, 'totCIBS');
  const gIBS = filho(totCIBS, 'gIBS');
  const gCBS = filho(totCIBS, 'gCBS');
  const gIBSUFTot = filho(gIBS, 'gIBSUFTot');
  const gIBSMunTot = filho(gIBS, 'gIBSMunTot');

  return {
    cst: texto(gIbscbs, 'CST'),
    cClassTrib: texto(gIbscbs, 'cClassTrib'),
    indicadorOperacao: texto(ibscbsDps, 'cIndOp'),
    codigoMunicipioIncidencia: texto(ibscbsNfse, 'cLocalidadeIncid'),
    descricaoMunicipioIncidencia: texto(ibscbsNfse, 'xLocalidadeIncid'),
    // TODO: soma vDescIncond + vCalcReeRepRes + vISSQN + vPIS + vCOFINS (NT-008,
    // bloco Tributação IBS/CBS) - vCalcReeRepRes ainda não foi localizado com
    // segurança no XSD, deixado de fora por ora em vez de arriscar um valor errado.
    exclusoesReducoesBaseCalculo: undefined,
    baseCalculoAposExclusoes: numero(valoresApurados, 'vBC'),
    reducaoAliquotaUf: numero(uf, 'pRedAliqUF'),
    reducaoAliquotaMun: numero(mun, 'pRedAliqMun'),
    reducaoAliquotaCbs: numero(fed, 'pRedAliqCBS'),
    aliquotaIbsUf: numero(uf, 'pIBSUF'),
    aliquotaIbsMun: numero(mun, 'pIBSMun'),
    aliquotaEfetivaMun: numero(mun, 'pAliqEfetMun'),
    valorApuradoMun: numero(gIBSMunTot, 'vIBSMun'),
    aliquotaEfetivaUf: numero(uf, 'pAliqEfetUF'),
    valorApuradoUf: numero(gIBSUFTot, 'vIBSUF'),
    valorTotalApuradoIbs: numero(gIBS, 'vIBSTot'),
    aliquotaCbs: numero(fed, 'pCBS'),
    aliquotaEfetivaCbs: numero(fed, 'pAliqEfetCBS'),
    valorTotalApuradoCbs: numero(gCBS, 'vCBS'),
  };
}

function lerValorTotal(
  valoresDps: Element,
  valoresNfse: Element | undefined,
  ibscbsNfse: Element | undefined
): ValorTotalLegivel {
  const vServPrest = filho(valoresDps, 'vServPrest');
  const vDescCondIncond = filho(valoresDps, 'vDescCondIncond');
  const totCIBS = filho(ibscbsNfse, 'totCIBS');
  const gIBS = filho(totCIBS, 'gIBS');
  const gCBS = filho(totCIBS, 'gCBS');

  const vIBSTot = numero(gIBS, 'vIBSTot');
  const vCBS = numero(gCBS, 'vCBS');
  const totalIbsCbs = vIBSTot !== undefined || vCBS !== undefined ? (vIBSTot ?? 0) + (vCBS ?? 0) : undefined;

  return {
    valorServico: numero(vServPrest, 'vServ') ?? 0,
    descontoIncondicionado: numero(vDescCondIncond, 'vDescIncond'),
    descontoCondicionado: numero(vDescCondIncond, 'vDescCond'),
    totalRetencoes: numero(valoresNfse, 'vTotalRet'),
    valorLiquido: numero(valoresNfse, 'vLiq') ?? 0,
    totalIbsCbs,
    valorLiquidoComIbsCbs: numero(totCIBS, 'vTotNF'),
  };
}

// A referencia ao documento dedutivel/redutivel e um xs:choice de 6 opcoes
// (TCDocDedRed) - normalizamos pra uma unica string de exibicao, ja que nao
// existe um bloco no DANFSe que precise dos campos separados.
function lerDocumentoReferenciadoDedRed(doc: Element): string | undefined {
  const chNFSe = texto(doc, 'chNFSe');
  if (chNFSe) return chNFSe;
  const chNFe = texto(doc, 'chNFe');
  if (chNFe) return chNFe;

  const nfseMun = filho(doc, 'NFSeMun');
  if (nfseMun) {
    return [texto(nfseMun, 'cMunNFSeMun'), texto(nfseMun, 'nNFSeMun'), texto(nfseMun, 'cVerifNFSeMun')]
      .filter(Boolean)
      .join('/');
  }

  const nfnfs = filho(doc, 'NFNFS');
  if (nfnfs) {
    return [texto(nfnfs, 'nNFS'), texto(nfnfs, 'modNFS'), texto(nfnfs, 'serieNFS')].filter(Boolean).join('/');
  }

  return texto(doc, 'nDocFisc') ?? texto(doc, 'nDoc');
}

function lerDocumentosDeducao(documentos: Element | undefined): DocumentoDeducaoLegivel[] {
  return filhos(documentos, 'docDedRed').map((doc) => {
    const dtEmiDoc = texto(doc, 'dtEmiDoc');
    return {
      documento: lerDocumentoReferenciadoDedRed(doc),
      tipoDeducao: texto(doc, 'tpDedRed'),
      descricaoOutraDeducao: texto(doc, 'xDescOutDed'),
      dataEmissaoDocumento: dtEmiDoc ? new Date(dtEmiDoc) : undefined,
      valorDedutivelRedutivel: numero(doc, 'vDedutivelRedutivel'),
      valorDeducaoReducao: numero(doc, 'vDeducaoReducao'),
      fornecedor: filho(doc, 'fornec') ? lerPessoa(filho(doc, 'fornec')) : undefined,
    };
  });
}

function lerDeducaoReducao(valoresDps: Element): DeducaoReducaoLegivel | undefined {
  const vDedRed = filho(valoresDps, 'vDedRed');
  if (!vDedRed) return undefined;

  const documentosEl = filho(vDedRed, 'documentos');
  return {
    percentual: numero(vDedRed, 'pDR'),
    valor: numero(vDedRed, 'vDR'),
    documentos: documentosEl ? lerDocumentosDeducao(documentosEl) : undefined,
  };
}

function lerInformacoesComplementares(
  infNFSe: Element,
  infDPS: Element,
  serv: Element
): InformacoesComplementaresLegivel {
  const infoCompl = filho(serv, 'infoCompl');
  const ibscbsDps = filho(infDPS, 'IBSCBS');
  const obra = filho(serv, 'obra');

  const totTrib = filho(filho(filho(infDPS, 'valores'), 'trib'), 'totTrib');
  const vTotTrib = filho(totTrib, 'vTotTrib');
  const pTotTrib = filho(totTrib, 'pTotTrib');

  return {
    informacoesContribuinte: texto(infoCompl, 'xInfComp'),
    chaveNfseSubstituida: texto(infDPS, 'chSubstda'),
    documentoReferenciado: texto(infoCompl, 'docRef'),
    codigoObra: texto(obra, 'cObra'),
    inscricaoImobiliariaFiscal: texto(ibscbsDps, 'inscImobFisc') ?? texto(obra, 'inscImobFisc'),
    codigoEvento: texto(filho(serv, 'atvEvento'), 'idAtvEvt'),
    documentoTecnico: texto(infoCompl, 'idDocTec'),
    numeroPedido: texto(infoCompl, 'xPed'),
    itensPedido: textos(infoCompl, 'xItemPed'),
    informacoesAdministracaoTributariaMunicipal: texto(infNFSe, 'xOutInf'),
    totalAproximadoTributosFederais: {
      valor: numero(vTotTrib, 'vTotTribFed'),
      percentual: numero(pTotTrib, 'pTotTribFed'),
    },
    totalAproximadoTributosEstaduais: {
      valor: numero(vTotTrib, 'vTotTribEst'),
      percentual: numero(pTotTrib, 'pTotTribEst'),
    },
    totalAproximadoTributosMunicipais: {
      valor: numero(vTotTrib, 'vTotTribMun'),
      percentual: numero(pTotTrib, 'pTotTribMun'),
    },
  };
}
