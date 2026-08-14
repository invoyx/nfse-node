// Tipos fieis a tiposComplexos_v1.01.xsd (schemas/nfse/v1.01). Os nomes dos
// campos seguem exatamente a tag XML oficial (cLocEmi, xDescServ etc.) em vez
// de traduzidos, para casar 1:1 com o manual e o XSD do governo.
//
// Cobertura desta primeira versao: prestador, tomador/intermediario, servico
// (sem obra, evento, comercio exterior ou dedução por documentos), valores,
// tributacao municipal e federal, e o bloco IBSCBS declarado pelo emitente
// (TCRTCInfoIBSCBS: finalidade, destinatario, imovel, situacao/classificacao
// tributaria, tributacao regular, diferimento e reembolso/repasse/ressarcimento
// de terceiros via gReeRepRes).

export type TipoAmbiente = '1' | '2';
export type TipoEmitenteDps = '1' | '2' | '3';
export type OpcaoSimplesNacional = '1' | '2' | '3';
export type RegimeApuracaoSimplesNacional = '1' | '2' | '3';
export type RegimeEspecialTributacao = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '9';
export type TributacaoIssqn = '1' | '2' | '3' | '4';
export type RetencaoIssqn = '1' | '2' | '3';

export interface DocumentoFiscal {
  CNPJ?: string;
  CPF?: string;
}

export interface Endereco {
  cMun: string;
  CEP: string;
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
}

export interface RegimeTributario {
  opSimpNac: OpcaoSimplesNacional;
  regApTribSN?: RegimeApuracaoSimplesNacional;
  regEspTrib: RegimeEspecialTributacao;
}

export interface Prestador extends DocumentoFiscal {
  IM?: string;
  xNome?: string;
  end?: Endereco;
  fone?: string;
  email?: string;
  regTrib: RegimeTributario;
}

export interface Pessoa extends DocumentoFiscal {
  IM?: string;
  xNome: string;
  end?: Endereco;
  fone?: string;
  email?: string;
}

export interface LocalPrestacao {
  cLocPrestacao?: string;
  cPaisPrestacao?: string;
}

export interface CodigoServico {
  cTribNac: string;
  cTribMun?: string;
  xDescServ: string;
  cNBS?: string;
}

export interface Servico {
  locPrest: LocalPrestacao;
  cServ: CodigoServico;
}

export interface ValoresServico {
  vReceb?: number;
  vServ: number;
}

export interface DescontosValores {
  vDescIncond?: number;
  vDescCond?: number;
}

export interface TributacaoMunicipal {
  tribISSQN: TributacaoIssqn;
  cPaisResult?: string;
  tpImunidade?: string;
  tpRetISSQN: RetencaoIssqn;
  pAliq?: number;
}

export interface PisCofins {
  CST: string;
  vBCPisCofins?: number;
  pAliqPis?: number;
  pAliqCofins?: number;
  vPis?: number;
  vCofins?: number;
  tpRetPisCofins?: string;
}

export interface TributacaoFederal {
  piscofins?: PisCofins;
  vRetCP?: number;
  vRetIRRF?: number;
  vRetCSLL?: number;
}

/** Escolha exigida pelo XSD (xs:choice): total em valor monetário ou percentual. */
export type TotalTributos =
  | { vTotTribFed: number; vTotTribEst: number; vTotTribMun: number; pTotTribFed?: never }
  | { pTotTribFed: number; pTotTribEst: number; pTotTribMun: number; vTotTribFed?: never };

export interface Tributacao {
  tribMun: TributacaoMunicipal;
  tribFed?: TributacaoFederal;
  totTrib: TotalTributos;
}

export interface Valores {
  vServPrest: ValoresServico;
  vDescCondIncond?: DescontosValores;
  trib: Tributacao;
}

export type MotivoNaoInformacaoNif = '0' | '1' | '2';

export interface IdentificacaoDestinatarioIbscbs {
  CNPJ?: string;
  CPF?: string;
  /** Número de Identificação Fiscal emitido por administração tributária no exterior. */
  NIF?: string;
  cNaoNIF?: MotivoNaoInformacaoNif;
}

export interface DestinatarioIbscbs extends IdentificacaoDestinatarioIbscbs {
  xNome: string;
  end?: Endereco;
  fone?: string;
  email?: string;
}

export interface EnderecoExteriorSimples {
  cEndPost: string;
  xCidade: string;
  xEstProvReg: string;
}

/** Endereço do imóvel (TCEnderObraEvento): exige CEP (nacional) ou endExt (exterior). */
export interface EnderecoImovel {
  CEP?: string;
  endExt?: EnderecoExteriorSimples;
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
}

/** Grupo de bens imóveis do IBSCBS: exige cCIB (Cadastro Imobiliário Brasileiro) ou end. */
export interface ImovelIbscbs {
  inscImobFisc?: string;
  cCIB?: string;
  end?: EnderecoImovel;
}

export interface TributacaoRegularIbscbs {
  /** Código de Situação Tributária (CST) aplicável na tributação regular. */
  CSTReg: string;
  /** Código de Classificação Tributária aplicável na tributação regular. */
  cClassTribReg: string;
}

export interface DiferimentoIbscbs {
  pDifUF: number;
  pDifMun: number;
  pDifCBS: number;
}

export interface SituacaoTributariaIbscbs {
  /** Código de Situação Tributária (CST) do IBS e da CBS. */
  CST: string;
  cClassTrib: string;
  /** Código e classificação do crédito presumido (2 dígitos), quando aplicável. */
  cCredPres?: string;
  gTribRegular?: TributacaoRegularIbscbs;
  gDif?: DiferimentoIbscbs;
}

export type TipoChaveDfe = '1' | '2' | '3' | '9';
export type TipoReembolsoRepasseRessarcimento = '01' | '02' | '03' | '04' | '99';

/** Documento fiscal eletrônico do Repositório Nacional (TCRTCListaDocDFe). */
export interface DocumentoFiscalEletronicoReferenciado {
  tipoChaveDFe: TipoChaveDfe;
  /** Obrigatório apenas quando tipoChaveDFe = "9" (Outro). */
  xTipoChaveDFe?: string;
  chaveDFe: string;
}

/** Documento fiscal fora do Repositório Nacional (TCRTCListaDocFiscalOutro). */
export interface DocumentoFiscalOutroReferenciado {
  cMunDocFiscal: string;
  nDocFiscal: string;
  xDocFiscal: string;
}

/** Documento não fiscal (TCRTCListaDocOutro). */
export interface DocumentoOutroReferenciado {
  nDoc: string;
  xDoc: string;
}

export interface FornecedorReeRepRes extends IdentificacaoDestinatarioIbscbs {
  xNome: string;
}

/**
 * Documento referenciado num reembolso, repasse ou ressarcimento de valores
 * já tributados por terceiros (TCRTCListaDoc) - exige exatamente uma das três
 * formas de identificar o documento.
 */
export interface DocumentoReeRepRes {
  dFeNacional?: DocumentoFiscalEletronicoReferenciado;
  docFiscalOutro?: DocumentoFiscalOutroReferenciado;
  docOutro?: DocumentoOutroReferenciado;
  fornec?: FornecedorReeRepRes;
  dtEmiDoc: Date;
  dtCompDoc: Date;
  tpReeRepRes: TipoReembolsoRepasseRessarcimento;
  /** Obrigatório apenas quando tpReeRepRes = "99" (Outros). */
  xTpReeRepRes?: string;
  vlrReeRepRes: number;
}

export interface ValoresIbscbs {
  /** Documentos de reembolso/repasse/ressarcimento (gReeRepRes/documentos), até 1000 ocorrências. */
  gReeRepRes?: DocumentoReeRepRes[];
  trib: {
    gIBSCBS: SituacaoTributariaIbscbs;
  };
}

export type FinalidadeNFSe = '0';
export type IndicadorConsumoPessoal = '0' | '1';
export type TipoOperacaoEnteGovernamental = '1' | '2' | '3' | '4' | '5';
export type TipoEnteGovernamental = '1' | '2' | '3' | '4';
export type IndicadorDestinatario = '0' | '1';

/** Bloco IBSCBS declarado pelo emitente da DPS (TCRTCInfoIBSCBS). */
export interface InfoIbscbs {
  finNFSe: FinalidadeNFSe;
  indFinal?: IndicadorConsumoPessoal;
  /** Código indicador da operação de fornecimento (6 dígitos), conforme tabela oficial. */
  cIndOp: string;
  tpOper?: TipoOperacaoEnteGovernamental;
  /** Chaves das NFS-e referenciadas (gRefNFSe), até 99 ocorrências. */
  refNFSe?: string[];
  tpEnteGov?: TipoEnteGovernamental;
  indDest: IndicadorDestinatario;
  dest?: DestinatarioIbscbs;
  imovel?: ImovelIbscbs;
  valores: ValoresIbscbs;
}

export interface DadosDps {
  tpAmb: TipoAmbiente;
  dhEmi: Date;
  verAplic: string;
  serie: string;
  nDPS: string;
  dCompet: Date;
  tpEmit: TipoEmitenteDps;
  cLocEmi: string;
  prest: Prestador;
  toma?: Pessoa;
  interm?: Pessoa;
  serv: Servico;
  valores: Valores;
  IBSCBS?: InfoIbscbs;
}
