// Sigla de UF a partir dos dois primeiros dígitos do código IBGE do
// município - tabela pequena e estável, ao contrário do nome do município
// (~5500 linhas), que fica a cargo de um resolvedor externo injetável.
const UF_POR_PREFIXO_IBGE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

export function ufDoCodigoMunicipio(codigoIbge: string | undefined): string | undefined {
  if (!codigoIbge || codigoIbge.length < 2) return undefined;
  return UF_POR_PREFIXO_IBGE[codigoIbge.slice(0, 2)];
}

export function formatarData(data: Date | undefined): string {
  if (!data) return '-';
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatarDataHora(data: Date | undefined): string {
  if (!data) return '-';
  const dia = formatarData(data);
  const hora = data.toLocaleTimeString('pt-BR', { timeZone: 'UTC', hour12: false });
  return `${dia} ${hora}`;
}

export function formatarMoeda(valor: number | undefined): string {
  if (valor === undefined) return '-';
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatarPercentual(valor: number | undefined): string {
  if (valor === undefined) return '-';
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatarDocumento(documento: string | undefined): string {
  if (!documento) return '-';
  if (documento.length === 14) {
    return documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (documento.length === 11) {
    return documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return documento;
}

export function formatarCep(cep: string | undefined): string {
  if (!cep || cep.length !== 8) return cep ?? '-';
  return cep.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3');
}

export function formatarTelefone(telefone: string | undefined): string {
  if (!telefone) return '-';
  if (telefone.length === 11) return telefone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (telefone.length === 10) return telefone.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return telefone;
}

/** Junta partes não vazias com " / "; devolve "-" se nada sobrar. */
export function juntar(...partes: (string | undefined)[]): string {
  const preenchidas = partes.filter((parte): parte is string => !!parte && parte.trim() !== '');
  return preenchidas.length ? preenchidas.join(' / ') : '-';
}

/** Corta no limite de palavra inteira e acrescenta reticências, como pede a NT 008/2026. */
export function reticencias(texto: string | undefined, limite: number): string {
  if (!texto) return '-';
  if (texto.length <= limite) return texto;
  const cortado = texto.slice(0, limite);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  return (ultimoEspaco > 0 ? cortado.slice(0, ultimoEspaco) : cortado) + '...';
}
