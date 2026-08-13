// Formatadores que atendem exatamente aos padroes de tiposSimples_v1.01.xsd.
// TSData: AAAA-MM-DD. TSDateTimeUTC: AAAA-MM-DDThh:mm:ss seguido de deslocamento
// explicito tipo +hh:00/-hh:00 - "Z" nao e aceito pelo padrao (regex do XSD nao
// inclui esse sufixo). TSDecXXV2: string decimal com ponto, sempre 2 casas.

/** Data em UTC, formatada como AAAA-MM-DD (TSData). */
export function formatarData(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Data e hora formatada como AAAA-MM-DDThh:mm:ss±hh:00 (TSDateTimeUTC).
 * `deslocamentoMinutos` desloca o instante UTC antes de formatar; o padrão
 * -180 corresponde ao horário de Brasília, que cobre a grande maioria dos
 * municípios emissores.
 */
export function formatarDataHora(data: Date, deslocamentoMinutos = -180): string {
  const instanteLocal = new Date(data.getTime() + deslocamentoMinutos * 60_000);
  const semDeslocamento = instanteLocal.toISOString().slice(0, 19);
  const sinal = deslocamentoMinutos <= 0 ? '-' : '+';
  const minutosAbsolutos = Math.abs(deslocamentoMinutos);
  const horas = String(Math.floor(minutosAbsolutos / 60)).padStart(2, '0');
  const minutos = String(minutosAbsolutos % 60).padStart(2, '0');
  return `${semDeslocamento}${sinal}${horas}:${minutos}`;
}

/** Valor decimal no formato exigido pelos tipos TSDecXXV2 (ex.: "1500.00"). */
export function formatarDecimal(valor: number): string {
  return valor.toFixed(2);
}

/** Escapa caracteres especiais de XML em conteúdo de texto. */
export function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
