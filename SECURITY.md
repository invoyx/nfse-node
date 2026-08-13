# Política de Segurança

O `nfse-node` lida com certificado digital A1, chave privada, senha de certificado e assinatura de documentos fiscais. Uma falha de segurança aqui pode expor chave privada, permitir assinatura indevida de documentos ou comprometer a comunicação com o SEFIN Nacional - trate relatos nessa área como prioritários.

## Versões com suporte

Enquanto o projeto estiver em `0.x`, apenas a última versão publicada recebe correção de segurança. Não há garantia de compatibilidade retroativa antes da `1.0.0`.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Use a aba [Security](../../security/advisories/new) deste repositório para reportar de forma privada (GitHub Security Advisories).

Inclua, quando possível:

- Versão do `nfse-node` afetada.
- Módulo envolvido (`certificado`, `assinatura`, `dps`, `cliente` ou `danfse`).
- Passos para reproduzir, com dado sintético - nunca envie certificado, senha ou dado real de contribuinte, nem aqui nem numa issue pública.
- Impacto esperado (ex.: vazamento de chave privada, bypass de validação de assinatura, SSRF no cliente HTTP).

Você deve receber uma resposta em até 5 dias úteis. Correções aceitas são publicadas como nova versão no npm assim que possível, com aviso na aba de Security Advisories.

## Fora do escopo

- Vulnerabilidades em dependências de terceiros (`node-forge`, `xml-crypto`, `pdfkit` etc.) - reporte diretamente ao projeto correspondente. Se afetar diretamente o `nfse-node`, ainda assim nos avise, para que possamos atualizar a dependência.
- Falhas de configuração do lado de quem usa o SDK (ex.: certificado guardado em texto plano pelo consumidor da biblioteca).
