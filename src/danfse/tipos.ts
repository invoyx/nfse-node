// Dados extraídos do XML da NFS-e, prontos para o desenho do DANFSe (NT
// 008/2026). Valores ficam em formato bruto (number/string/Date) - formatação
// de exibição (moeda, data, reticências) é responsabilidade da camada de
// desenho, não da leitura.

export interface EnderecoLegivel {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  codigoMunicipio?: string;
  /** Só vem preenchido para o emitente - o XSD só dá a sigla da UF nesse caso. */
  uf?: string;
  cep?: string;
  codigoPostalExterior?: string;
  cidadeExterior?: string;
  estadoProvinciaExterior?: string;
}

export interface PessoaLegivel {
  cnpj?: string;
  cpf?: string;
  nif?: string;
  inscricaoMunicipal?: string;
  nome?: string;
  telefone?: string;
  email?: string;
  endereco?: EnderecoLegivel;
}

export interface PrestadorLegivel extends PessoaLegivel {
  opcaoSimplesNacional?: string;
  regimeApuracaoSimplesNacional?: string;
}

export interface ServicoLegivel {
  codigoTribNacional?: string;
  codigoTribMunicipal?: string;
  descricaoTribNacional?: string;
  descricaoTribMunicipal?: string;
  codigoNbs?: string;
  codigoMunicipioPrestacao?: string;
  codigoPaisPrestacao?: string;
  descricao: string;
}

export interface TributacaoMunicipalLegivel {
  /** Ausente quando a operação não é sujeita ao ISSQN (bloco suprimido no DANFSe). */
  tribISSQN?: string;
  codigoMunicipioIncidencia?: string;
  descricaoMunicipioIncidencia?: string;
  codigoPaisIncidencia?: string;
  regimeEspecialTributacao?: string;
  tipoImunidade?: string;
  suspensaoTipo?: string;
  suspensaoNumeroProcesso?: string;
  beneficioMunicipalTipo?: string;
  beneficioMunicipalValor?: number;
  /** Percentual declarado de redução da BC (BM/pRedBCBM) - usado quando beneficioMunicipalTipo = "2". */
  beneficioMunicipalPercentualReducao?: number;
  /** Valor declarado de redução da BC (BM/vRedBCBM) - usado quando beneficioMunicipalTipo = "3". */
  beneficioMunicipalValorReducao?: number;
  totalDeducoesReducoes?: number;
  descontoIncondicionado?: number;
  baseCalculo?: number;
  aliquotaAplicada?: number;
  retencaoIssqn?: string;
  issqnApurado?: number;
}

export interface TributacaoFederalLegivel {
  irrf?: number;
  contribuicaoPrevidenciaria?: number;
  contribuicoesSociaisRetidas?: number;
  pisDebito?: number;
  cofinsDebito?: number;
  tipoRetencaoPisCofins?: string;
}

export interface DestinatarioIbscbsLegivel extends PessoaLegivel {}

export interface TributacaoIbscbsLegivel {
  cst?: string;
  cClassTrib?: string;
  indicadorOperacao?: string;
  codigoMunicipioIncidencia?: string;
  descricaoMunicipioIncidencia?: string;
  exclusoesReducoesBaseCalculo?: number;
  baseCalculoAposExclusoes?: number;
  reducaoAliquotaUf?: number;
  reducaoAliquotaMun?: number;
  reducaoAliquotaCbs?: number;
  aliquotaIbsUf?: number;
  aliquotaIbsMun?: number;
  aliquotaEfetivaMun?: number;
  valorApuradoMun?: number;
  aliquotaEfetivaUf?: number;
  valorApuradoUf?: number;
  valorTotalApuradoIbs?: number;
  aliquotaCbs?: number;
  aliquotaEfetivaCbs?: number;
  valorTotalApuradoCbs?: number;
}

export interface DocumentoDeducaoLegivel {
  /** Identificação do documento referenciado (chave de NFS-e/NF-e, nota municipal antiga, NF/NFS ou número de documento fiscal/não fiscal). */
  documento?: string;
  tipoDeducao?: string;
  /** Preenchido só quando tipoDeducao = "99" (Outras deduções). */
  descricaoOutraDeducao?: string;
  dataEmissaoDocumento?: Date;
  valorDedutivelRedutivel?: number;
  valorDeducaoReducao?: number;
  fornecedor?: PessoaLegivel;
}

/**
 * Dedução/redução da base de cálculo declarada na DPS (vDedRed) - escolha
 * entre percentual padrão, valor padrão ou lista de documentos. Distinto do
 * total já calculado pelo SEFIN Nacional (`tributacaoMunicipal.totalDeducoesReducoes`),
 * que é o único valor impresso no DANFSe conforme a NT 008/2026.
 */
export interface DeducaoReducaoLegivel {
  percentual?: number;
  valor?: number;
  documentos?: DocumentoDeducaoLegivel[];
}

export interface ValorTotalLegivel {
  valorServico: number;
  descontoIncondicionado?: number;
  descontoCondicionado?: number;
  totalRetencoes?: number;
  valorLiquido: number;
  totalIbsCbs?: number;
  valorLiquidoComIbsCbs?: number;
}

export interface InformacoesComplementaresLegivel {
  informacoesContribuinte?: string;
  chaveNfseSubstituida?: string;
  documentoReferenciado?: string;
  codigoObra?: string;
  inscricaoImobiliariaFiscal?: string;
  codigoEvento?: string;
  documentoTecnico?: string;
  numeroPedido?: string;
  itensPedido: string[];
  informacoesAdministracaoTributariaMunicipal?: string;
  totalAproximadoTributosFederais?: { valor?: number; percentual?: number };
  totalAproximadoTributosEstaduais?: { valor?: number; percentual?: number };
  totalAproximadoTributosMunicipais?: { valor?: number; percentual?: number };
}

export interface NfseLegivel {
  /** Chave de acesso, 50 dígitos, sem o prefixo "NFS". */
  chaveAcesso: string;
  numero: string;
  competencia: Date;
  dataHoraEmissaoNfse: Date;
  numeroDps: string;
  serieDps: string;
  dataHoraEmissaoDps: Date;
  tipoEmitente: string;
  /** Código de status da NFS-e (cStat) - ex.: "100" = NFS-e Gerada. */
  situacao: string;
  /** Ausente quando a NFS-e é anterior ao bloco IBSCBS (finNFSe). */
  finalidade?: string;
  municipioEmissor: string;
  ambienteGerador: string;
  tipoAmbiente: string;

  prestador: PrestadorLegivel;
  /** Ausente quando o tomador não foi identificado na NFS-e. */
  tomador?: PessoaLegivel;
  /** Ausente quando o destinatário não foi identificado ou não se aplica. */
  destinatario?: DestinatarioIbscbsLegivel;
  /** `true` quando o IBSCBS indica que o destinatário é o próprio tomador (indDest = "0"). */
  destinatarioEhTomador: boolean;
  /** Ausente quando o intermediário não participou da operação. */
  intermediario?: PessoaLegivel;

  servico: ServicoLegivel;
  /** Ausente quando a operação não está sujeita ao ISSQN. */
  tributacaoMunicipal?: TributacaoMunicipalLegivel;
  tributacaoFederal: TributacaoFederalLegivel;
  /** Ausente em NFS-e emitidas antes da vigência do IBSCBS. */
  tributacaoIbscbs?: TributacaoIbscbsLegivel;
  valorTotal: ValorTotalLegivel;
  /** Ausente quando a DPS não declarou dedução/redução da base de cálculo (vDedRed). */
  deducaoReducao?: DeducaoReducaoLegivel;
  informacoesComplementares: InformacoesComplementaresLegivel;
}
