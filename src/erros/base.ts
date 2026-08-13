/**
 * Classe base de onde todos os erros do SDK herdam. Permite que quem
 * consome o pacote capture `ErroNfse` genericamente ou trate cada
 * subtipo (certificado, assinatura, comunicação com o ADN etc.)
 * separadamente, sem depender de `instanceof Error` puro.
 */
export class ErroNfse extends Error {
  /** Causa original do erro, quando ele envolve outra exceção capturada. */
  readonly causa?: unknown;

  constructor(mensagem: string, opcoes: { causa?: unknown } = {}) {
    super(mensagem);
    this.name = this.constructor.name;
    this.causa = opcoes.causa;
  }
}
