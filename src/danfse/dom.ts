import type { Element } from '@xmldom/xmldom';

// Busca por nome local (ignora prefixo/namespace) em vez de tagName exato -
// mais robusto que regex e não quebra se o XML vier com prefixo de namespace.

export function filho(elemento: Element | null | undefined, nomeLocal: string): Element | undefined {
  if (!elemento) return undefined;
  for (const no of Array.from(elemento.childNodes)) {
    if (no.nodeType === 1 && (no as Element).localName === nomeLocal) return no as Element;
  }
  return undefined;
}

export function filhos(elemento: Element | null | undefined, nomeLocal: string): Element[] {
  if (!elemento) return [];
  return Array.from(elemento.childNodes).filter(
    (no): no is Element => no.nodeType === 1 && (no as Element).localName === nomeLocal
  );
}

export function texto(elemento: Element | null | undefined, nomeLocal: string): string | undefined {
  const valor = filho(elemento, nomeLocal)?.textContent?.trim();
  return valor ? valor : undefined;
}

export function textos(elemento: Element | null | undefined, nomeLocal: string): string[] {
  return filhos(elemento, nomeLocal)
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean);
}

export function numero(elemento: Element | null | undefined, nomeLocal: string): number | undefined {
  const bruto = texto(elemento, nomeLocal);
  return bruto === undefined ? undefined : Number(bruto);
}

export function atributo(elemento: Element | null | undefined, nome: string): string | undefined {
  const valor = elemento?.getAttribute(nome);
  return valor ? valor : undefined;
}
