// Tipos fieis a tiposComplexos_v1.01.xsd (schemas/nfse/v1.01). Os nomes dos
// campos seguem exatamente a tag XML oficial (cLocEmi, xDescServ etc.) em vez
// de traduzidos, para casar 1:1 com o manual e o XSD do governo.
//
// Cobertura desta primeira versao: prestador, tomador/intermediario, servico
// (sem obra, evento, comercio exterior ou dedução por documentos), valores,
// tributacao municipal e federal, e o bloco IBSCBS no nivel de identificacao
// do destinatario e finalidade - o detalhamento de calculo por classificacao
// tributaria (IBSCBS/valores/trib/gIBSCBS) ainda nao esta tipado.

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

export interface DestinatarioIbscbs extends DocumentoFiscal {
  xNome: string;
  end?: Endereco;
  fone?: string;
  email?: string;
}

/**
 * Bloco IBSCBS da DPS (reforma tributária). O detalhamento de cálculo por
 * classificação tributária (valores/trib/gIBSCBS do XSD) ainda não está
 * coberto - fica como próximo incremento.
 */
export interface InfoIbscbs {
  finNFSe: string;
  cIndOp: string;
  indDest: string;
  dest?: DestinatarioIbscbs;
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
