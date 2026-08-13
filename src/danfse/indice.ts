import { desenharDanfse, type OpcoesGerarDanfse } from './desenho.js';
import { lerNfse } from './leitura.js';
import type { NfseLegivel } from './tipos.js';

export { ErroLeituraNfse } from './erros.js';
export { lerNfse } from './leitura.js';
export { desenharDanfse } from './desenho.js';
export type { OpcoesGerarDanfse, ResolvedorMunicipio } from './desenho.js';
export type {
  DestinatarioIbscbsLegivel,
  EnderecoLegivel,
  InformacoesComplementaresLegivel,
  NfseLegivel,
  PessoaLegivel,
  PrestadorLegivel,
  ServicoLegivel,
  TributacaoFederalLegivel,
  TributacaoIbscbsLegivel,
  TributacaoMunicipalLegivel,
  ValorTotalLegivel,
} from './tipos.js';

/** Lê o XML da NFS-e e desenha o DANFSe em PDF, num só passo. */
export async function gerarDanfse(xml: string, opcoes: OpcoesGerarDanfse = {}): Promise<Buffer> {
  const dados: NfseLegivel = lerNfse(xml);
  return desenharDanfse(dados, opcoes);
}
