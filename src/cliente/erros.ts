import { ErroNfse } from '../erros/base.js';

/** Um erro no formato de envelope de erro do SEFIN Nacional (campo "erros"). */
export interface ErroSefin {
  codigo?: string;
  descricao?: string;
  complemento?: string;
  mensagem?: string;
}

/** Falha ao comunicar com o SEFIN Nacional: rejeição HTTP, timeout ou rede. */
export class ErroComunicacaoSefin extends ErroNfse {
  readonly status?: number;
  readonly erros: ErroSefin[];
  readonly corpoResposta?: unknown;

  constructor(
    mensagem: string,
    opcoes: { status?: number; erros?: ErroSefin[]; corpoResposta?: unknown; causa?: unknown } = {}
  ) {
    super(mensagem, { causa: opcoes.causa });
    this.status = opcoes.status;
    this.erros = opcoes.erros ?? [];
    this.corpoResposta = opcoes.corpoResposta;
  }
}
