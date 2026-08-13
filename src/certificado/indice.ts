import { readFileSync } from 'node:fs';
import forge from 'node-forge';
import { ErroCertificadoIncompleto, ErroSenhaCertificadoInvalida } from './erros.js';

/** Dados de titularidade extraídos do certificado (CN e, quando aplicável, SAN). */
export interface TitularCertificado {
  cnpj: string | null;
  cpf: string | null;
  nome: string | null;
}

/** Resultado da leitura de um certificado digital A1 (.pfx/.p12). */
export interface CertificadoLido {
  /** Chave privada em PEM, pronta para assinatura XML ou mTLS. */
  chavePrivadaPem: string;
  /** Certificado da entidade (folha), em PEM. */
  certificadoPem: string;
  /** Certificados intermediários presentes no arquivo, em PEM (folha excluída). */
  cadeiaPem: string[];
  titular: TitularCertificado;
  validadeInicio: Date;
  validadeFim: Date;
}

// OID (ICP-Brasil, DOC-ICP-04) do CNPJ dentro do SubjectAlternativeName de
// certificados e-CNPJ. Usado como conferência do que já foi lido do CN -
// alguns emissores não seguem a convenção "RAZAO SOCIAL:CNPJ" à risca.
const OID_CNPJ_SAN = '2.16.76.1.3.3';

/**
 * Lê um certificado A1 e devolve a chave privada e o certificado já em PEM,
 * prontos para assinatura XML e para autenticação mTLS junto ao ADN.
 *
 * A leitura é feita inteiramente em JavaScript puro via node-forge, sem
 * repassar o PFX para o OpenSSL do Node. Isso evita o problema comum de
 * certificados antigos cifrados em RC2-40-CBC, que o OpenSSL 3 recusa por
 * padrão: o forge decifra esses arquivos normalmente, e a partir do PEM
 * resultante o OpenSSL não entra mais em cena.
 */
export function lerCertificado(origem: Buffer | string, senha: string): CertificadoLido {
  const bytes = Buffer.isBuffer(origem) ? origem : readFileSync(origem);

  let pfx: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(bytes.toString('binary'));
    pfx = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  } catch (causa) {
    throw new ErroSenhaCertificadoInvalida(
      'Não foi possível abrir o certificado: a senha está incorreta ou o arquivo não é um .pfx/.p12 válido.',
      { causa }
    );
  }

  const oidChavePrivada: string = forge.pki.oids.pkcs8ShroudedKeyBag!;
  const oidCertificado: string = forge.pki.oids.certBag!;

  const chaveBag = pfx.getBags({ bagType: oidChavePrivada })[oidChavePrivada]?.[0];
  if (!chaveBag?.key) {
    throw new ErroCertificadoIncompleto('O arquivo não contém uma chave privada.');
  }
  const chavePrivada = chaveBag.key;

  const certificados = pfx.getBags({ bagType: oidCertificado })[oidCertificado] ?? [];
  if (certificados.length === 0) {
    throw new ErroCertificadoIncompleto('O arquivo não contém nenhum certificado X.509.');
  }

  const folha = encontrarCertificadoDaChave(certificados, chavePrivada) ?? certificados[0]?.cert;
  if (!folha) {
    throw new ErroCertificadoIncompleto('Não foi possível identificar o certificado correspondente à chave privada.');
  }

  const cadeiaPem = certificados
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => !!cert && cert !== folha)
    .map((cert) => forge.pki.certificateToPem(cert));

  return {
    chavePrivadaPem: forge.pki.privateKeyToPem(chavePrivada),
    certificadoPem: forge.pki.certificateToPem(folha),
    cadeiaPem,
    titular: lerTitular(folha),
    validadeInicio: folha.validity.notBefore,
    validadeFim: folha.validity.notAfter,
  };
}

// O PFX não garante ordem entre a folha e a cadeia intermediária, então a
// folha é identificada comparando o módulo RSA da chave pública de cada
// certificado com o da chave privada.
function encontrarCertificadoDaChave(
  certificados: forge.pkcs12.Bag[],
  chavePrivada: forge.pki.rsa.PrivateKey
): forge.pki.Certificate | undefined {
  return certificados.find((bag) => {
    const chavePublica = bag.cert?.publicKey as forge.pki.rsa.PublicKey | undefined;
    return chavePublica?.n !== undefined && chavePublica.n.equals(chavePrivada.n);
  })?.cert;
}

// Certificados ICP-Brasil e-CNPJ/e-CPF trazem "NOME:DOCUMENTO" no CN do
// titular (14 dígitos para CNPJ, 11 para CPF). É a fonte mais consistente
// entre emissores; o SAN é usado só como conferência do CNPJ.
function lerTitular(certificado: forge.pki.Certificate): TitularCertificado {
  const cn = certificado.subject.getField('CN')?.value as string | undefined;
  const partes = (cn ?? '').split(':');
  const documentoCn = partes.length > 1 ? soDigitos(partes[partes.length - 1] ?? '') : '';
  const nome = partes.length > 1 ? partes.slice(0, -1).join(':').trim() || null : (cn?.trim() || null);

  let cnpj = documentoCn.length === 14 ? documentoCn : null;
  const cpf = documentoCn.length === 11 ? documentoCn : null;

  cnpj ??= lerCnpjDoSan(certificado);

  return { cnpj, cpf, nome };
}

function lerCnpjDoSan(certificado: forge.pki.Certificate): string | null {
  const san = certificado.extensions.find((ext) => ext.name === 'subjectAltName');
  const altNames = (san?.altNames ?? []) as Array<{ type: number; value: unknown }>;

  for (const altName of altNames) {
    // otherName (GeneralName tipo 0): SEQUENCE { type-id OID, [0] EXPLICIT valor }
    if (altName.type !== 0) continue;
    const outroNome = altName.value as forge.asn1.Asn1 | undefined;
    const oidNode = outroNome?.value?.[0] as forge.asn1.Asn1 | undefined;
    const valorNode = outroNome?.value?.[1] as forge.asn1.Asn1 | undefined;
    if (!oidNode || typeof oidNode.value !== 'string') continue;
    if (forge.asn1.derToOid(oidNode.value) !== OID_CNPJ_SAN) continue;

    const conteudo = valorNode?.value;
    const texto = Array.isArray(conteudo)
      ? String((conteudo[0] as forge.asn1.Asn1 | undefined)?.value ?? '')
      : String(conteudo ?? '');
    const digitos = soDigitos(texto);
    if (digitos.length === 14) return digitos;
  }
  return null;
}

function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}
