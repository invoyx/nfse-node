import { ErroNfse } from '../erros/base.js';

/** Erro base para qualquer falha relacionada à leitura do certificado A1. */
export class ErroCertificado extends ErroNfse {}

/** A senha informada não abre o arquivo, ou o arquivo não é um PFX/P12 válido. */
export class ErroSenhaCertificadoInvalida extends ErroCertificado {}

/** O arquivo abriu, mas não contém chave privada e/ou certificado X.509. */
export class ErroCertificadoIncompleto extends ErroCertificado {}
