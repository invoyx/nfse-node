import { gunzipSync, gzipSync } from 'node:zlib';

/** O SEFIN Nacional exige XML compactado em GZip e codificado em Base64. */
export function compactarGZipBase64(xml: string): string {
  return gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
}

export function descompactarGZipBase64(base64: string): string {
  return gunzipSync(Buffer.from(base64, 'base64')).toString('utf8');
}
