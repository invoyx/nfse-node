import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import { ErroAssinatura } from './erros.js';

/** Par mínimo necessário para assinar: não depende do módulo `certificado`. */
export interface ChaveDeAssinatura {
  chavePrivadaPem: string;
  certificadoPem: string;
}

const DECLARACAO_XML = '<?xml version="1.0" encoding="UTF-8"?>';

// Algoritmos exigidos pelo SEFIN Nacional para a assinatura da DPS: enveloped
// signature, C14N exclusivo e RSA-SHA256 (não o RSA-SHA1 ainda comum em NF-e).
const ALGORITMO_ASSINATURA = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const ALGORITMO_CANONICALIZACAO = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ALGORITMO_DIGEST = 'http://www.w3.org/2001/04/xmlenc#sha256';

/**
 * Assina o elemento com o `Id` informado dentro do XML, no formato exigido
 * pelo SEFIN Nacional (assinatura enveloped, com o certificado embutido no
 * KeyInfo). Devolve o XML completo, já com a declaração `<?xml ... ?>` -
 * o xml-crypto a descarta ao assinar, e o SEFIN a exige de volta.
 */
export function assinarXml(xml: string, idElemento: string, chave: ChaveDeAssinatura): string {
  const assinador = new SignedXml({
    privateKey: chave.chavePrivadaPem,
    publicCert: chave.certificadoPem,
    signatureAlgorithm: ALGORITMO_ASSINATURA,
    canonicalizationAlgorithm: ALGORITMO_CANONICALIZACAO,
    getKeyInfoContent: SignedXml.getKeyInfoContent,
  });

  assinador.addReference({
    xpath: `//*[@Id='${idElemento}']`,
    digestAlgorithm: ALGORITMO_DIGEST,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      ALGORITMO_CANONICALIZACAO,
    ],
  });

  try {
    assinador.computeSignature(xml);
  } catch (causa) {
    throw new ErroAssinatura(
      `Não foi possível assinar o elemento de Id "${idElemento}": XML inválido ou elemento inexistente.`,
      { causa }
    );
  }

  const assinado = assinador.getSignedXml();
  return assinado.startsWith('<?xml') ? assinado : DECLARACAO_XML + assinado;
}

/**
 * Confere se a assinatura embutida no XML é criptograficamente válida
 * contra o certificado presente no próprio KeyInfo. Não valida a cadeia de
 * confiança do certificado (ICP-Brasil) nem sua validade temporal - apenas
 * que a assinatura corresponde ao conteúdo assinado.
 */
export function assinaturaValida(xml: string): boolean {
  const documento = new DOMParser().parseFromString(xml, 'text/xml');
  // Sem passar `getCertFromKeyInfo` explicitamente aqui, o xml-crypto usa um
  // resolvedor "noop" internamente e a verificação falha mesmo com o
  // certificado presente no KeyInfo - por isso ele é repassado à mão.
  const verificador = new SignedXml({ getCertFromKeyInfo: SignedXml.getCertFromKeyInfo });
  const [assinatura] = verificador.findSignatures(documento);
  if (!assinatura) return false;
  verificador.loadSignature(assinatura);
  return verificador.checkSignature(xml);
}
