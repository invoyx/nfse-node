// Tabelas de domínio de código -> descrição oficial, conforme a NT 008/2026
// (item 2.1 e correlatos) e o XSD (tiposComplexos_v1.01.xsd).

export const TIPO_EMITENTE: Record<string, string> = {
  '1': 'Prestador',
  '2': 'Tomador',
  '3': 'Intermediário',
};

export const AMBIENTE_GERADOR: Record<string, string> = {
  '1': 'Sistema Próprio do Município',
  '2': 'Sefin Nacional NFS-e',
};

export const TIPO_AMBIENTE: Record<string, string> = {
  '1': 'Produção',
  '2': 'Homologação',
};

export const SITUACAO_NFSE: Record<string, string> = {
  '100': 'NFS-e Gerada',
  '101': 'NFS-e de Substituição Gerada',
  '102': 'NFS-e de Decisão Judicial ou Administrativa',
  '103': 'NFS-e Avulsa',
  '107': 'NFS-e MEI',
};

export const FINALIDADE_NFSE: Record<string, string> = {
  '0': 'NFS-e regular',
  '1': 'NFS-e de crédito',
  '2': 'NFS-e de débito',
};

// Ordem oficial do enum: 2-Imunidade, 3-Exportação, 4-Não Incidência.
export const TRIBUTACAO_ISSQN: Record<string, string> = {
  '1': 'Operação Tributável',
  '2': 'Imunidade',
  '3': 'Exportação de serviço',
  '4': 'Não Incidência',
};

export const TIPO_IMUNIDADE: Record<string, string> = {
  '0': 'Imunidade (tipo não informado na nota de origem)',
  '1': 'Patrimônio, renda ou serviços, uns dos outros (CF88, Art 150, VI, a)',
  '2': 'Templos de qualquer culto (CF88, Art 150, VI, b)',
  '3': 'Patrimônio, renda ou serviços dos partidos políticos, inclusive suas fundações, das entidades sindicais dos trabalhadores, das instituições de educação e de assistência social, sem fins lucrativos, atendidos os requisitos da lei (CF88, Art 150, VI, c)',
  '4': 'Livros, jornais, periódicos e o papel destinado a sua impressão (CF88, Art 150, VI, d)',
  '5': 'Fonogramas e videofonogramas musicais produzidos no Brasil contendo obras musicais ou literomusicais de autores brasileiros e/ou obras em geral interpretadas por artistas brasileiros bem como os suportes materiais ou arquivos digitais que os contenham',
};

export const SUSPENSAO_EXIGIBILIDADE: Record<string, string> = {
  '1': 'Exigibilidade Suspensa por Decisão Judicial',
  '2': 'Exigibilidade Suspensa por Processo Administrativo',
};

export const RETENCAO_ISSQN: Record<string, string> = {
  '1': 'Não Retido',
  '2': 'Retido pelo Tomador',
  '3': 'Retido pelo Intermediário',
};

export const RETENCAO_PIS_COFINS: Record<string, string> = {
  '0': 'PIS/COFINS/CSLL Não Retidos',
  '1': 'PIS/COFINS Retidos',
  '2': 'PIS/COFINS Não Retidos',
  '3': 'PIS/COFINS/CSLL Retidos',
  '4': 'PIS/COFINS Retidos, CSLL Não Retido',
  '5': 'PIS Retido, COFINS/CSLL Não Retido',
  '6': 'COFINS Retido, PIS/CSLL Não Retido',
  '7': 'PIS Não Retido, COFINS/CSLL Retidos',
  '8': 'PIS/COFINS Não Retidos, CSLL Retido',
  '9': 'COFINS Não Retido, PIS/CSLL Retidos',
};

export const OPCAO_SIMPLES_NACIONAL: Record<string, string> = {
  '1': 'Não Optante',
  '2': 'Optante - Microempreendedor Individual (MEI)',
  '3': 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)',
};

export const REGIME_APURACAO_SIMPLES_NACIONAL: Record<string, string> = {
  '1': 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
  '2': 'Regime de apuração dos tributos federais pelo SN e o ISSQN pela NFS-e conforme respectiva legislação municipal do tributo',
  '3': 'Regime de apuração dos tributos federais e municipal pela NFS-e conforme respectivas legislações federal e municipal de cada tributo',
};

export const REGIME_ESPECIAL_TRIBUTACAO: Record<string, string> = {
  '0': 'Nenhum',
  '1': 'Ato Cooperado (Cooperativa)',
  '2': 'Estimativa',
  '3': 'Microempresa Municipal',
  '4': 'Notário ou Registrador',
  '5': 'Profissional Autônomo',
  '6': 'Sociedade de Profissionais',
  '9': 'Outros',
};

// Textos fixos de supressão/aviso previstos na NT 008/2026.
export const TEXTO_TOMADOR_NAO_IDENTIFICADO = 'TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e';
export const TEXTO_DESTINATARIO_NAO_IDENTIFICADO = 'DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e';
export const TEXTO_DESTINATARIO_E_TOMADOR = 'O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO';
export const TEXTO_INTERMEDIARIO_NAO_IDENTIFICADO = 'INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e';
export const TEXTO_OPERACAO_NAO_SUJEITA_ISSQN = 'TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN';
export const TEXTO_SEM_VALIDADE_JURIDICA = 'NFS-e SEM VALIDADE JURÍDICA';
export const TEXTO_QR_CODE =
  'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e';
