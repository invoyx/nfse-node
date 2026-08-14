export type Ambiente = 'producao' | 'homologacao';

// homologacao = "producao restrita", o ambiente de testes do SEFIN Nacional.
const URL_BASE_SEFIN_POR_AMBIENTE: Record<Ambiente, string> = {
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
};

// ADN (Ambiente de Dados Nacional) e um host separado do SEFIN Nacional -
// trata distribuicao de documentos (DFe por NSU) e parametrizacao municipal,
// nao emissao/consulta de NFS-e.
const URL_BASE_ADN_POR_AMBIENTE: Record<Ambiente, string> = {
  producao: 'https://adn.nfse.gov.br',
  homologacao: 'https://adn.producaorestrita.nfse.gov.br',
};

export function urlBaseSefin(ambiente: Ambiente): string {
  return URL_BASE_SEFIN_POR_AMBIENTE[ambiente];
}

export function urlBaseAdn(ambiente: Ambiente): string {
  return URL_BASE_ADN_POR_AMBIENTE[ambiente];
}
