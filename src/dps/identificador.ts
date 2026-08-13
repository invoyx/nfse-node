import { ErroValidacaoDps } from './erros.js';

export interface DadosIdentificadorDps {
  /** CPF ou CNPJ do emitente, com ou sem máscara. */
  documentoEmitente: string;
  /** Código IBGE do município emissor (7 dígitos). */
  codigoMunicipioEmissor: string;
  serie: string | number;
  numero: string | number;
}

const TAMANHO_MUNICIPIO = 7;
const TAMANHO_DOCUMENTO = 14;
const TAMANHO_SERIE = 5;
const TAMANHO_NUMERO = 15;

/**
 * Gera o identificador da DPS: "DPS" + código do município emissor (7) +
 * tipo de inscrição federal (1: 1=CPF, 2=CNPJ) + inscrição federal (14,
 * zero à esquerda) + série (5) + número (15) - formato fixo definido pelas
 * regras de negócio do Sistema Nacional NFS-e, usado tanto como Id do
 * elemento assinado quanto como prefixo da chave de acesso da NFS-e.
 */
export function gerarIdDps(dados: DadosIdentificadorDps): string {
  const documento = soDigitos(dados.documentoEmitente);
  if (documento.length !== 11 && documento.length !== 14) {
    throw new ErroValidacaoDps(
      `documentoEmitente deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos); recebido "${dados.documentoEmitente}".`
    );
  }

  const municipio = soDigitos(dados.codigoMunicipioEmissor);
  if (municipio.length !== TAMANHO_MUNICIPIO) {
    throw new ErroValidacaoDps(
      `codigoMunicipioEmissor deve ter ${TAMANHO_MUNICIPIO} dígitos (código IBGE); recebido "${dados.codigoMunicipioEmissor}".`
    );
  }

  const serie = paraCampoNumerico(dados.serie, TAMANHO_SERIE, 'serie');
  const numero = paraCampoNumerico(dados.numero, TAMANHO_NUMERO, 'numero');
  const tipoInscricao = documento.length === 14 ? '2' : '1';

  return `DPS${municipio}${tipoInscricao}${documento.padStart(TAMANHO_DOCUMENTO, '0')}${serie}${numero}`;
}

function paraCampoNumerico(valor: string | number, tamanho: number, nomeCampo: string): string {
  const digitos = soDigitos(String(valor));
  if (!digitos || digitos.length > tamanho) {
    throw new ErroValidacaoDps(`${nomeCampo} deve ter no máximo ${tamanho} dígitos; recebido "${valor}".`);
  }
  return digitos.padStart(tamanho, '0');
}

function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}
