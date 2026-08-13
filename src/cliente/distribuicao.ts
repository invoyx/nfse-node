import { descompactarGZipBase64 } from './compressao.js';

// Tipos fieis a schemas/adn/v1/adn-contribuinte-v1.json (spec oficial do ADN,
// endpoint GET /DFe/{NSU}). Os nomes dos campos da resposta original vem em
// PascalCase (padrao .NET do governo); aqui normalizamos pra camelCase, no
// mesmo estilo do restante do modulo `cliente`.

export type StatusProcessamentoDistribuicao =
  | 'REJEICAO'
  | 'NENHUM_DOCUMENTO_LOCALIZADO'
  | 'DOCUMENTOS_LOCALIZADOS';

export type TipoDocumentoDistribuicao = 'NENHUM' | 'DPS' | 'PEDIDO_REGISTRO_EVENTO' | 'NFSE' | 'EVENTO' | 'CNC';

export type TipoEventoDistribuicao =
  | 'CANCELAMENTO'
  | 'SOLICITACAO_CANCELAMENTO_ANALISE_FISCAL'
  | 'CANCELAMENTO_POR_SUBSTITUICAO'
  | 'CANCELAMENTO_DEFERIDO_ANALISE_FISCAL'
  | 'CANCELAMENTO_INDEFERIDO_ANALISE_FISCAL'
  | 'CONFIRMACAO_PRESTADOR'
  | 'REJEICAO_PRESTADOR'
  | 'CONFIRMACAO_TOMADOR'
  | 'REJEICAO_TOMADOR'
  | 'CONFIRMACAO_INTERMEDIARIO'
  | 'REJEICAO_INTERMEDIARIO'
  | 'CONFIRMACAO_TACITA'
  | 'ANULACAO_REJEICAO'
  | 'CANCELAMENTO_POR_OFICIO'
  | 'BLOQUEIO_POR_OFICIO'
  | 'DESBLOQUEIO_POR_OFICIO'
  | 'INCLUSAO_NFSE_DAN'
  | 'TRIBUTOS_NFSE_RECOLHIDOS';

export interface MensagemProcessamentoAdn {
  codigo?: string;
  descricao?: string;
  complemento?: string;
  parametros?: string[];
}

export interface DocumentoDistribuicao {
  nsu?: number;
  chaveAcesso?: string;
  tipoDocumento: TipoDocumentoDistribuicao;
  tipoEvento?: TipoEventoDistribuicao;
  /** XML original do documento, ja descompactado (o ADN devolve GZip+Base64). */
  xml?: string;
  dataHoraGeracao?: string;
}

export interface LoteDistribuicaoNsu {
  statusProcessamento: StatusProcessamentoDistribuicao;
  documentos: DocumentoDistribuicao[];
  alertas: MensagemProcessamentoAdn[];
  erros: MensagemProcessamentoAdn[];
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO';
  versaoAplicativo?: string;
  dataHoraProcessamento: string;
}

function normalizarMensagens(lista: unknown): MensagemProcessamentoAdn[] {
  if (!Array.isArray(lista)) return [];
  return (lista as Record<string, unknown>[]).map((item) => ({
    codigo: item.Codigo as string | undefined,
    descricao: item.Descricao as string | undefined,
    complemento: item.Complemento as string | undefined,
    parametros: item.Parametros as string[] | undefined,
  }));
}

export function normalizarLoteDistribuicao(corpo: unknown): LoteDistribuicaoNsu {
  const objeto = (corpo ?? {}) as Record<string, unknown>;
  const lote = (objeto.LoteDFe as Record<string, unknown>[] | undefined) ?? [];

  const documentos: DocumentoDistribuicao[] = lote.map((doc) => ({
    nsu: doc.NSU as number | undefined,
    chaveAcesso: doc.ChaveAcesso as string | undefined,
    tipoDocumento: doc.TipoDocumento as TipoDocumentoDistribuicao,
    tipoEvento: doc.TipoEvento as TipoEventoDistribuicao | undefined,
    xml: typeof doc.ArquivoXml === 'string' ? descompactarGZipBase64(doc.ArquivoXml) : undefined,
    dataHoraGeracao: doc.DataHoraGeracao as string | undefined,
  }));

  return {
    statusProcessamento: objeto.StatusProcessamento as StatusProcessamentoDistribuicao,
    documentos,
    alertas: normalizarMensagens(objeto.Alertas),
    erros: normalizarMensagens(objeto.Erros),
    ambiente: objeto.TipoAmbiente as 'PRODUCAO' | 'HOMOLOGACAO',
    versaoAplicativo: objeto.VersaoAplicativo as string | undefined,
    dataHoraProcessamento: objeto.DataHoraProcessamento as string,
  };
}
