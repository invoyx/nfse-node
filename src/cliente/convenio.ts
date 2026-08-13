// Tipos fieis a schemas/adn/v1/adn-parametros-municipais-v1.json (spec
// oficial do ADN, endpoint GET /{codigoMunicipio}/convenio).

export type TipoConvenio = 1 | 2;
export type IndicadorSimNao = 0 | 1 | -1;

export interface ParametrosConvenio {
  tipoConvenio?: TipoConvenio;
  aderenteAmbienteNacional?: IndicadorSimNao;
  aderenteEmissorNacional?: IndicadorSimNao;
  situacaoEmissaoPadraoContribuintesRfb?: IndicadorSimNao;
  aderenteMan?: IndicadorSimNao;
  permiteAproveitamentoDeCreditos?: boolean;
}

export interface ResultadoConsultaConvenio {
  mensagem?: string;
  parametros: ParametrosConvenio;
}

// O nome dos campos abaixo (`tipoConvenioDeserializationSetter`,
// `permiteAproveitametoDeCreditos` sem o "n") vem literal da spec oficial do
// governo - nao sao erros de digitacao nossos, sao o formato real da
// resposta. Normalizamos pra nomes corretos no tipo exposto pelo SDK.
export function normalizarConvenio(corpo: unknown): ResultadoConsultaConvenio {
  const objeto = (corpo ?? {}) as Record<string, unknown>;
  const parametros = (objeto.parametrosConvenio ?? {}) as Record<string, unknown>;

  return {
    mensagem: objeto.mensagem as string | undefined,
    parametros: {
      tipoConvenio: parametros.tipoConvenioDeserializationSetter as TipoConvenio | undefined,
      aderenteAmbienteNacional: parametros.aderenteAmbienteNacional as IndicadorSimNao | undefined,
      aderenteEmissorNacional: parametros.aderenteEmissorNacional as IndicadorSimNao | undefined,
      situacaoEmissaoPadraoContribuintesRfb: parametros.situacaoEmissaoPadraoContribuintesRFB as
        | IndicadorSimNao
        | undefined,
      aderenteMan: parametros.aderenteMAN as IndicadorSimNao | undefined,
      permiteAproveitamentoDeCreditos: parametros.permiteAproveitametoDeCreditos as boolean | undefined,
    },
  };
}
