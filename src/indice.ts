export { ErroNfse } from './erros/base.js';
export {
  ErroCertificado,
  ErroCertificadoIncompleto,
  ErroSenhaCertificadoInvalida,
} from './certificado/erros.js';
export { lerCertificado } from './certificado/indice.js';
export type { CertificadoLido, TitularCertificado } from './certificado/indice.js';
export { ErroAssinatura } from './assinatura/erros.js';
export { assinarXml, assinaturaValida } from './assinatura/indice.js';
export type { ChaveDeAssinatura } from './assinatura/indice.js';
export * from './dps/indice.js';
export { ErroComunicacaoSefin } from './cliente/erros.js';
export type { ErroSefin } from './cliente/erros.js';
export { criarClienteSefin, urlBaseSefin } from './cliente/indice.js';
export type {
  Ambiente,
  ChaveClienteSefin,
  ClienteSefin,
  OpcoesClienteSefin,
  ResultadoEmissao,
  RespostaSefin,
} from './cliente/indice.js';
export { compactarGZipBase64, descompactarGZipBase64 } from './cliente/compressao.js';
export * from './danfse/indice.js';
