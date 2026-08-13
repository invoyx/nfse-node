import https from 'node:https';
import { urlBaseSefin, type Ambiente } from './ambiente.js';
import { compactarGZipBase64, descompactarGZipBase64 } from './compressao.js';
import { ErroComunicacaoSefin, type ErroSefin } from './erros.js';

export { urlBaseSefin } from './ambiente.js';
export type { Ambiente } from './ambiente.js';
export type { ErroSefin } from './erros.js';

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
   * Substitui a URL base padrão do ambiente. Alguns municípios conveniados
   * expõem o mesmo contrato de API em infraestrutura própria; também é o
   * ponto usado pelos testes para apontar a um servidor local.
   */
  urlBase?: string;
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
  /** GET /nfse/{chave}/eventos - lista os eventos registrados para a NFS-e. */
  listarEventos(chaveAcesso: string): Promise<RespostaSefin>;
}

/** Cria um cliente HTTP autenticado por mTLS para o SEFIN Nacional. */
export function criarClienteSefin(opcoes: OpcoesClienteSefin): ClienteSefin {
  const urlBase = opcoes.urlBase ?? urlBaseSefin(opcoes.ambiente);
  const agente = new https.Agent({
    ...opcoes.agenteOpcoes,
    key: opcoes.certificado.chavePrivadaPem,
    cert: opcoes.certificado.certificadoPem,
  });

  async function requisitar(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<RespostaSefin> {
    const corpoSerializado = corpo === undefined ? undefined : JSON.stringify(corpo);

    return new Promise<RespostaSefin>((resolve, reject) => {
      const requisicao = https.request(
        `${urlBase}/${caminho}`,
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
      const { status, corpo } = await requisitar('POST', 'nfse', {
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
      return requisitar('GET', `nfse/${chaveAcesso}`);
    },

    consultarDps(idDps) {
      return requisitar('GET', `dps/${idDps}`);
    },

    registrarEvento(chaveAcesso, pedRegXmlAssinado) {
      return requisitar('POST', `nfse/${chaveAcesso}/eventos`, {
        pedRegXmlGZipB64: compactarGZipBase64(pedRegXmlAssinado),
      });
    },

    listarEventos(chaveAcesso) {
      return requisitar('GET', `nfse/${chaveAcesso}/eventos`);
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
