import https from 'node:https';
import { urlBaseAdn, urlBaseSefin, type Ambiente } from './ambiente.js';
import { compactarGZipBase64, descompactarGZipBase64 } from './compressao.js';
import { normalizarConvenio, type ResultadoConsultaConvenio } from './convenio.js';
import { normalizarLoteDistribuicao, type LoteDistribuicaoNsu } from './distribuicao.js';
import { ErroComunicacaoSefin, type ErroSefin } from './erros.js';

export { urlBaseAdn, urlBaseSefin } from './ambiente.js';
export type { Ambiente } from './ambiente.js';
export type { ErroSefin } from './erros.js';
export type { ParametrosConvenio, ResultadoConsultaConvenio } from './convenio.js';
export type {
  DocumentoDistribuicao,
  LoteDistribuicaoNsu,
  MensagemProcessamentoAdn,
  TipoDocumentoDistribuicao,
  TipoEventoDistribuicao,
} from './distribuicao.js';

/** Par mínimo necessário para autenticação mTLS: as mesmas PEMs usadas em `assinatura`. */
export interface ChaveClienteSefin {
  chavePrivadaPem: string;
  certificadoPem: string;
}

export interface OpcoesClienteSefin {
  ambiente: Ambiente;
  certificado: ChaveClienteSefin;
  /** Tempo limite por requisição, em milissegundos. Padrão: 60000. */
  timeoutMs?: number;
  /**
   * Substitui a URL base padrão do ambiente para o SEFIN Nacional. Alguns
   * municípios conveniados expõem o mesmo contrato de API em infraestrutura
   * própria; também é o ponto usado pelos testes para apontar a um servidor
   * local.
   */
  urlBase?: string;
  /** Substitui a URL base padrão do ambiente para o ADN (distribuição de DFe e parametrização). */
  urlBaseAdn?: string;
  /** Opções adicionais repassadas ao `https.Agent` (ex.: `ca`, `rejectUnauthorized` em testes). */
  agenteOpcoes?: https.AgentOptions;
}

export interface RespostaSefin {
  status: number;
  corpo: unknown;
}

export interface ResultadoEmissao {
  chaveAcesso: string;
  nfseXml: string;
  status: number;
  corpo: unknown;
}

export interface ClienteSefin {
  /** POST /nfse - transmite a DPS assinada e devolve a NFS-e gerada. */
  emitirDps(dpsXmlAssinado: string): Promise<ResultadoEmissao>;
  /** GET /nfse/{chave} - consulta a NFS-e pela chave de acesso (50 dígitos). */
  consultarNfse(chaveAcesso: string): Promise<RespostaSefin>;
  /** GET /dps/{idDps} - consulta o processamento de uma DPS pelo seu Id. */
  consultarDps(idDps: string): Promise<RespostaSefin>;
  /** POST /nfse/{chave}/eventos - registra um evento (ex.: cancelamento) já assinado. */
  registrarEvento(chaveAcesso: string, pedRegXmlAssinado: string): Promise<RespostaSefin>;
  /**
   * GET /contribuintes/NFSe/{chave}/Eventos no ADN - lista os eventos (ex.:
   * cancelamento, substituição) registrados para a chave de acesso. Não
   * confundir com `registrarEvento`: aquele é POST no SEFIN Nacional (só
   * aceita escrita, devolve 405 em GET); este é leitura, e vive no ADN.
   */
  listarEventos(chaveAcesso: string): Promise<LoteDistribuicaoNsu>;
  /**
   * GET /contribuintes/DFe/{nsu} no ADN - baixa o próximo lote de documentos
   * fiscais (até 50) a partir do NSU informado. Use `0` para sincronizar
   * desde o início; o NSU do último documento recebido para continuar depois.
   */
  baixarDfe(nsu: number, opcoes?: { cnpjConsulta?: string; lote?: boolean }): Promise<LoteDistribuicaoNsu>;
  /** GET /parametrizacao/{codigoMunicipio}/convenio no ADN - parâmetros de convênio do município. */
  consultarConvenio(codigoMunicipio: string | number): Promise<ResultadoConsultaConvenio>;
}

/** Cria um cliente HTTP autenticado por mTLS para o SEFIN Nacional e o ADN. */
export function criarClienteSefin(opcoes: OpcoesClienteSefin): ClienteSefin {
  const urlBase = opcoes.urlBase ?? urlBaseSefin(opcoes.ambiente);
  const urlAdn = opcoes.urlBaseAdn ?? urlBaseAdn(opcoes.ambiente);
  const agente = new https.Agent({
    ...opcoes.agenteOpcoes,
    key: opcoes.certificado.chavePrivadaPem,
    cert: opcoes.certificado.certificadoPem,
  });

  async function requisitar(
    metodo: 'GET' | 'POST',
    urlBaseAlvo: string,
    caminho: string,
    corpo?: unknown
  ): Promise<RespostaSefin> {
    const corpoSerializado = corpo === undefined ? undefined : JSON.stringify(corpo);

    return new Promise<RespostaSefin>((resolve, reject) => {
      const requisicao = https.request(
        `${urlBaseAlvo}/${caminho}`,
        {
          method: metodo,
          agent: agente,
          timeout: opcoes.timeoutMs ?? 60_000,
          headers: corpoSerializado
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(corpoSerializado),
              }
            : undefined,
        },
        (resposta) => {
          const pedacos: Buffer[] = [];
          resposta.on('data', (pedaco: Buffer) => pedacos.push(pedaco));
          resposta.on('end', () => {
            const status = resposta.statusCode ?? 0;
            const texto = Buffer.concat(pedacos).toString('utf8');
            let corpoResposta: unknown = texto;
            if (texto) {
              try {
                corpoResposta = JSON.parse(texto);
              } catch {
                // corpo nao-JSON (raro, mas nao deve travar quem so quer o status/texto)
              }
            }

            if (status >= 200 && status < 300) {
              resolve({ status, corpo: corpoResposta });
              return;
            }
            reject(
              new ErroComunicacaoSefin(`SEFIN Nacional recusou a requisição (HTTP ${status}).`, {
                status,
                erros: extrairErros(corpoResposta),
                corpoResposta,
              })
            );
          });
        }
      );

      requisicao.on('timeout', () => {
        requisicao.destroy();
        reject(new ErroComunicacaoSefin('Tempo limite excedido ao comunicar com o SEFIN Nacional.'));
      });
      requisicao.on('error', (causa) => {
        reject(new ErroComunicacaoSefin('Falha de rede ao comunicar com o SEFIN Nacional.', { causa }));
      });

      if (corpoSerializado) requisicao.write(corpoSerializado);
      requisicao.end();
    });
  }

  return {
    async emitirDps(dpsXmlAssinado) {
      const { status, corpo } = await requisitar('POST', urlBase, 'nfse', {
        dpsXmlGZipB64: compactarGZipBase64(dpsXmlAssinado),
      });
      const objeto = corpo as Record<string, unknown>;
      const nfseGZipB64 = (objeto?.nfseXmlGZipB64 ?? objeto?.NfseXmlGZipB64) as string | undefined;
      if (!nfseGZipB64) {
        throw new ErroComunicacaoSefin('SEFIN Nacional aceitou a requisição, mas não devolveu a NFS-e gerada.', {
          status,
          corpoResposta: corpo,
        });
      }
      const nfseXml = descompactarGZipBase64(nfseGZipB64);
      const chaveAcesso =
        (objeto?.chaveAcesso as string | undefined) ??
        (objeto?.ChaveAcesso as string | undefined) ??
        nfseXml.match(/Id="NFS(\d{50})"/)?.[1] ??
        '';
      return { chaveAcesso, nfseXml, status, corpo };
    },

    consultarNfse(chaveAcesso) {
      return requisitar('GET', urlBase, `nfse/${chaveAcesso}`);
    },

    consultarDps(idDps) {
      return requisitar('GET', urlBase, `dps/${idDps}`);
    },

    registrarEvento(chaveAcesso, pedRegXmlAssinado) {
      return requisitar('POST', urlBase, `nfse/${chaveAcesso}/eventos`, {
        pedRegXmlGZipB64: compactarGZipBase64(pedRegXmlAssinado),
      });
    },

    async listarEventos(chaveAcesso) {
      const { corpo } = await requisitar('GET', urlAdn, `contribuintes/NFSe/${chaveAcesso}/Eventos`);
      return normalizarLoteDistribuicao(corpo);
    },

    async baixarDfe(nsu, opcoesConsulta) {
      const parametros = new URLSearchParams();
      if (opcoesConsulta?.cnpjConsulta) parametros.set('cnpjConsulta', opcoesConsulta.cnpjConsulta);
      if (opcoesConsulta?.lote !== undefined) parametros.set('lote', String(opcoesConsulta.lote));
      const query = parametros.size > 0 ? `?${parametros.toString()}` : '';

      const { corpo } = await requisitar('GET', urlAdn, `contribuintes/DFe/${nsu}${query}`);
      return normalizarLoteDistribuicao(corpo);
    },

    async consultarConvenio(codigoMunicipio) {
      const { corpo } = await requisitar('GET', urlAdn, `parametrizacao/${codigoMunicipio}/convenio`);
      return normalizarConvenio(corpo);
    },
  };
}

// O envelope de erro do SEFIN Nacional varia entre minúsculas e PascalCase
// dependendo do endpoint - checamos as duas formas em vez de assumir uma.
function extrairErros(corpo: unknown): ErroSefin[] {
  const objeto = corpo as Record<string, unknown> | undefined;
  const lista = (objeto?.erros ?? objeto?.Erros ?? objeto?.erro ?? objeto?.Erro) as
    | Record<string, unknown>[]
    | Record<string, unknown>
    | undefined;

  const normalizar = (item: Record<string, unknown>): ErroSefin => ({
    codigo: (item.codigo ?? item.Codigo) as string | undefined,
    descricao: (item.descricao ?? item.Descricao) as string | undefined,
    complemento: (item.complemento ?? item.Complemento) as string | undefined,
    mensagem: (item.mensagem ?? item.Mensagem) as string | undefined,
  });

  if (Array.isArray(lista)) return lista.map(normalizar);
  if (lista) return [normalizar(lista)];
  return [];
}
