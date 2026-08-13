export type Ambiente = 'producao' | 'homologacao';

// homologacao = "producao restrita", o ambiente de testes do SEFIN Nacional.
const URL_BASE_POR_AMBIENTE: Record<Ambiente, string> = {
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
};

export function urlBaseSefin(ambiente: Ambiente): string {
  return URL_BASE_POR_AMBIENTE[ambiente];
}
