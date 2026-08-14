import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  AMBIENTE_GERADOR,
  FINALIDADE_NFSE,
  OPCAO_SIMPLES_NACIONAL,
  REGIME_APURACAO_SIMPLES_NACIONAL,
  REGIME_ESPECIAL_TRIBUTACAO,
  RETENCAO_ISSQN,
  RETENCAO_PIS_COFINS,
  SITUACAO_NFSE,
  SUSPENSAO_EXIGIBILIDADE,
  TEXTO_DESTINATARIO_E_TOMADOR,
  TEXTO_DESTINATARIO_NAO_IDENTIFICADO,
  TEXTO_INTERMEDIARIO_NAO_IDENTIFICADO,
  TEXTO_OPERACAO_NAO_SUJEITA_ISSQN,
  TEXTO_QR_CODE,
  TEXTO_SEM_VALIDADE_JURIDICA,
  TEXTO_TOMADOR_NAO_IDENTIFICADO,
  TIPO_AMBIENTE,
  TIPO_EMITENTE,
  TIPO_IMUNIDADE,
  TRIBUTACAO_ISSQN,
} from './dominios.js';
import {
  formatarCep,
  formatarData,
  formatarDataHora,
  formatarDocumento,
  formatarMoeda,
  formatarPercentual,
  formatarTelefone,
  juntar,
  reticencias,
  ufDoCodigoMunicipio,
} from './formatadores.js';
import type { EnderecoLegivel, NfseLegivel, PessoaLegivel, TributacaoMunicipalLegivel } from './tipos.js';

// NT 008/2026: "1-Isenção; 2-Redução da BC em X%; 3-Redução da BC em R$ X;
// 4-Alíquota Diferenciada" - as opções 2 e 3 interpolam o valor declarado no
// bloco BM (pRedBCBM/vRedBCBM), não são um rótulo fixo como as demais tabelas.
function textoBeneficioMunicipal(t: TributacaoMunicipalLegivel): string | undefined {
  switch (t.beneficioMunicipalTipo) {
    case '1':
      return 'Isenção';
    case '2':
      return t.beneficioMunicipalPercentualReducao !== undefined
        ? `Redução da BC em ${formatarPercentual(t.beneficioMunicipalPercentualReducao)}`
        : 'Redução da Base de Cálculo';
    case '3':
      return t.beneficioMunicipalValorReducao !== undefined
        ? `Redução da BC em ${formatarMoeda(t.beneficioMunicipalValorReducao)}`
        : 'Redução da Base de Cálculo';
    case '4':
      return 'Alíquota Diferenciada';
    default:
      return undefined;
  }
}

const DIRETORIO_ATUAL = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_FONTE_ROTULO_BOLD = path.join(DIRETORIO_ATUAL, '..', '..', 'assets', 'fonts', 'LiberationSans-Bold.ttf');
const CAMINHO_FONTE_ROTULO_REGULAR = path.join(DIRETORIO_ATUAL, '..', '..', 'assets', 'fonts', 'LiberationSans-Regular.ttf');
const CAMINHO_FONTE_CONTEUDO = path.join(DIRETORIO_ATUAL, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf');

const MM = 2.83465; // 1mm em pontos
const SOMBREADO = '#f2f2f2';
const ESPESSURA_DIVISORIA = 0.5;
const ESPESSURA_BORDA = 1;
const ALTURA_LINHA = 6.4 * MM;
const ALTURA_FAIXA = 3.4 * MM;

/** Resolve nome e UF a partir do código IBGE do município (~5500 linhas - não embutido no SDK). */
export type ResolvedorMunicipio = (codigoIbge: string) => { nome: string; uf: string } | undefined;

export interface OpcoesGerarDanfse {
  /**
   * Aplica marca d'água diagonal, conforme NT 008/2026 §2.5. Precisa ser
   * informado explicitamente porque cancelamento/substituição nunca ficam no
   * XML da própria NFS-e (o `cStat` só tem códigos de geração) - são sempre
   * um documento de EVENTO separado. Quem chama essa função é responsável
   * por checar os eventos (`listarEventos`/`baixarDfe`) antes de decidir.
   */
  situacaoEspecial?: 'Cancelada' | 'Substituida';
  resolverMunicipio?: ResolvedorMunicipio;
  /** PNG/JPEG da logomarca oficial da NFS-e (item 2.4.3). Sem isso, o cabeçalho usa só texto. */
  logomarca?: Buffer;
  /**
   * Inclui o bloco de Canhoto (item 2.1.13, opcional). Quando `false`, o
   * espaço é absorvido pelo bloco de Informações Complementares, conforme
   * item 2.3.3. Padrão: `true`.
   */
  incluirCanhoto?: boolean;
}

/** Desenha o DANFSe em PDF a partir dos dados já lidos do XML da NFS-e (NT 008/2026). */
export async function desenharDanfse(dados: NfseLegivel, opcoes: OpcoesGerarDanfse = {}): Promise<Buffer> {
  const documento = new PDFDocument({ size: 'A4', margins: { top: 2 * MM, bottom: 2 * MM, left: 2 * MM, right: 2 * MM } });
  const blocos: Buffer[] = [];
  documento.on('data', (b: Buffer) => blocos.push(b));
  const finalizado = new Promise<Buffer>((resolve) => documento.on('end', () => resolve(Buffer.concat(blocos))));

  documento.registerFont('rotuloBold', CAMINHO_FONTE_ROTULO_BOLD);
  documento.registerFont('rotuloRegular', CAMINHO_FONTE_ROTULO_REGULAR);
  documento.registerFont('conteudo', CAMINHO_FONTE_CONTEUDO);

  // fontkit ativa a ligadura tipográfica "fi" por padrão (DejaVu Sans e
  // Liberation Sans tem esse glifo). O PDF resultante fica visualmente
  // correto, mas o mapa ToUnicode vira uma sequencia de dois codepoints por
  // glifo, que varios extratores de texto de PDF nao sabem interpretar -
  // "financeiro" vira "fnanceiro" na hora de copiar/pesquisar o texto, o que
  // e inaceitavel num documento fiscal. `{liga: false}` (objeto, nao array -
  // e como o fontkit aceita desligar uma feature especifica) desliga a
  // ligadura e garante um glifo por caractere, sem perda visual perceptivel
  // nesses tamanhos de fonte.
  const semLigadura = { liga: false } as unknown as PDFKit.Mixins.OpenTypeFeatures[];
  function escrever(texto: string, x: number, y: number, opcoes: PDFKit.Mixins.TextOptions = {}): void {
    documento.text(texto, x, y, { ...opcoes, features: semLigadura });
  }
  function larguraDoTexto(texto: string): number {
    return documento.widthOfString(texto, { features: semLigadura });
  }
  function alturaDoTexto(texto: string, largura: number): number {
    return documento.heightOfString(texto, { width: largura, features: semLigadura });
  }

  const margemSup = documento.page.margins.top;
  const margemEsq = documento.page.margins.left;
  const larguraUtil = documento.page.width - margemEsq - documento.page.margins.right;
  const alturaUtil = documento.page.height - margemSup - documento.page.margins.bottom;

  const bx = margemEsq + 1 * MM;
  const bw = larguraUtil - 2 * MM;
  const colw = bw / 4;
  const col = (i: number) => bx + i * colw;

  const resolverMunicipio = opcoes.resolverMunicipio;
  function municipioLegivel(codigoIbge: string | undefined): string {
    if (!codigoIbge) return '-';
    const resolvido = resolverMunicipio?.(codigoIbge);
    if (resolvido) return juntar(resolvido.nome, resolvido.uf);
    return juntar(codigoIbge, ufDoCodigoMunicipio(codigoIbge));
  }

  function linhaHorizontal(y: number): void {
    documento.lineWidth(ESPESSURA_DIVISORIA).strokeColor('#000').moveTo(bx, y).lineTo(bx + bw, y).stroke();
  }
  function sombrear(x: number, y: number, w: number, h: number): void {
    documento.rect(x, y + 0.15 * MM, w, h - 0.15 * MM).fillColor(SOMBREADO).fill().fillColor('#000');
  }
  function textoCabendo(texto: string, largura: number, tamanho: number, fonte: string): string {
    if (!texto) return '';
    documento.font(fonte).fontSize(tamanho);
    const espacoSeguro = largura - 2;
    if (larguraDoTexto(texto) <= espacoSeguro) return texto;
    const palavras = texto.split(/\s+/);
    while (palavras.length && larguraDoTexto(palavras.join(' ') + '...') > espacoSeguro) palavras.pop();
    return palavras.length ? palavras.join(' ') + '...' : '...';
  }
  function tituloBloco(y: number, texto: string): void {
    sombrear(col(0), y, colw, ALTURA_LINHA);
    documento.font('rotuloBold').fontSize(7).fillColor('#000');
    escrever(texto, col(0) + 0.8 * MM, y + ALTURA_LINHA / 2 - 3.5, { width: colw - 1.6 * MM, lineBreak: false });
  }
  function faixaTitulo(y: number, texto: string): number {
    const altura = ALTURA_FAIXA + 0.5 * MM;
    documento.font('rotuloBold').fontSize(7).fillColor('#000');
    escrever(texto, bx + 0.8 * MM, y + 1, { width: bw - 1.6 * MM, lineBreak: false });
    return y + altura;
  }
  function faixaSupressao(y: number, texto: string): number {
    documento.font('rotuloBold').fontSize(7).fillColor('#000');
    escrever(texto, bx, y + 1, { width: bw, align: 'center', lineBreak: false });
    const novoY = y + ALTURA_FAIXA;
    linhaHorizontal(novoY);
    return novoY;
  }
  function campo(coluna: number, extensao: number, y: number, rotulo: string, valor: string, comSombra = false): void {
    const x = col(coluna);
    const largura = extensao * colw;
    if (comSombra) sombrear(x, y, largura, ALTURA_LINHA);
    documento.font('rotuloBold').fontSize(6).fillColor('#000');
    escrever(textoCabendo(rotulo, largura - 1.6 * MM, 6, 'rotuloBold'), x + 0.8 * MM, y + 0.5 * MM, {
      width: largura - 1.6 * MM,
      lineBreak: false,
    });
    documento.font('conteudo').fontSize(7).fillColor('#000');
    escrever(textoCabendo(valor || '-', largura - 1.6 * MM, 7, 'conteudo'), x + 0.8 * MM, y + 3.0 * MM, {
      width: largura - 1.6 * MM,
      lineBreak: false,
    });
  }
  // Campo sem valor vindo do XML de proposito - "Data de Cientificação" e
  // "Identificação e Assinatura" do Canhoto sao preenchidos a mao no papel
  // impresso, entao nao levam o traco "-" usado pra campo sem dado (nota 12).
  function campoBranco(coluna: number, extensao: number, y: number, rotulo: string): void {
    const x = col(coluna);
    const largura = extensao * colw;
    documento.font('rotuloBold').fontSize(6).fillColor('#000');
    escrever(textoCabendo(rotulo, largura - 1.6 * MM, 6, 'rotuloBold'), x + 0.8 * MM, y + 0.5 * MM, {
      width: largura - 1.6 * MM,
      lineBreak: false,
    });
  }
  function campoIdentificacao(coluna: number, y: number, rotulo: string, valor: string, comSombra = false): void {
    const x = col(coluna);
    if (comSombra) sombrear(x, y, colw, 6.9 * MM);
    documento.font('rotuloBold').fontSize(7).fillColor('#000');
    escrever(textoCabendo(rotulo, colw - 1.6 * MM, 7, 'rotuloBold'), x + 0.8 * MM, y + 0.6 * MM, {
      width: colw - 1.6 * MM,
      lineBreak: false,
    });
    documento.font('conteudo').fontSize(7).fillColor('#000');
    escrever(textoCabendo(valor || '-', colw - 1.6 * MM, 7, 'conteudo'), x + 0.8 * MM, y + 3.6 * MM, {
      width: colw - 1.6 * MM,
      lineBreak: false,
    });
  }
  function enderecoLegivel(end: EnderecoLegivel | undefined): string {
    if (!end) return '-';
    if (end.cidadeExterior) {
      return reticencias(
        [end.logradouro, end.numero, end.complemento, end.bairro].filter(Boolean).join(', '),
        77
      );
    }
    return reticencias([end.logradouro, end.numero, end.complemento, end.bairro].filter(Boolean).join(', '), 77);
  }
  function municipioSiglaUf(end: EnderecoLegivel | undefined): string {
    if (!end) return '-';
    if (end.uf) return municipioLegivel(end.codigoMunicipio).replace(/ \/ .*/, ` / ${end.uf}`);
    return municipioLegivel(end.codigoMunicipio);
  }
  function codigoIbgeCep(end: EnderecoLegivel | undefined): string {
    if (!end) return '-';
    if (end.codigoPostalExterior) return `${end.codigoPostalExterior} (ext)`;
    return juntar(end.codigoMunicipio, formatarCep(end.cep));
  }
  function linhasPessoa(y: number, titulo: string, pessoa: PessoaLegivel, comInscricao = true): number {
    tituloBloco(y, titulo);
    campo(1, 1, y, 'CNPJ / CPF / NIF', formatarDocumento(pessoa.cnpj ?? pessoa.cpf) !== '-' ? formatarDocumento(pessoa.cnpj ?? pessoa.cpf) : pessoa.nif ?? '-');
    if (comInscricao) campo(2, 1, y, 'Indicador Municipal (Inscrição)', pessoa.inscricaoMunicipal ?? '-');
    campo(3, 1, y, 'Telefone', formatarTelefone(pessoa.telefone));
    y += ALTURA_LINHA;
    campo(0, 2, y, 'Nome / Nome Empresarial', reticencias(pessoa.nome, 77));
    campo(2, 1, y, 'Município / Sigla UF', municipioSiglaUf(pessoa.endereco));
    campo(3, 1, y, 'Código IBGE / CEP', codigoIbgeCep(pessoa.endereco));
    y += ALTURA_LINHA;
    campo(0, 2, y, 'Endereço', enderecoLegivel(pessoa.endereco));
    campo(2, 2, y, 'E-mail', pessoa.email ?? '-');
    y += ALTURA_LINHA;
    linhaHorizontal(y);
    return y;
  }
  function contarLinhas(texto: string, largura: number, tamanho: number): number {
    documento.font('conteudo').fontSize(tamanho);
    const alturaLinha = tamanho * 1.15;
    return Math.max(1, Math.ceil(alturaDoTexto(texto || '', largura) / alturaLinha));
  }

  // ── Cabeçalho (2.4.3) ──
  function desenharCabecalho(): number {
    const y0 = margemSup + 1 * MM;
    const alturaFaixa = 11.6 * MM;
    sombrear(bx, y0, bw, alturaFaixa);
    if (opcoes.logomarca) {
      try {
        documento.image(opcoes.logomarca, bx + 2 * MM, y0 + 1.8 * MM, { height: 8 * MM });
      } catch {
        // logomarca invalida - segue sem imagem
      }
    }

    documento.font('rotuloBold').fontSize(9).fillColor('#000');
    escrever('DANFSe v2.0', col(1), y0 + 1.6 * MM, { width: colw * 2, align: 'center' });
    escrever('Documento Auxiliar da NFS-e', col(1), y0 + 5.2 * MM, { width: colw * 2, align: 'center' });
    if (dados.tipoAmbiente === '2') {
      documento.font('rotuloBold').fontSize(9).fillColor('#f00');
      escrever(TEXTO_SEM_VALIDADE_JURIDICA, col(1), y0 + 8.8 * MM, { width: colw * 2, align: 'center' });
      documento.fillColor('#000');
    }

    const xDireita = col(3) + 0.8 * MM;
    const larguraDireita = colw - 1.6 * MM;
    documento.font('conteudo').fontSize(8);
    escrever(textoCabendo(`Município: ${dados.municipioEmissor}`, larguraDireita, 8, 'conteudo'), xDireita, y0 + 1.2 * MM, {
      width: larguraDireita,
      lineBreak: false,
    });
    documento.font('conteudo').fontSize(6);
    escrever(`Ambiente Gerador: ${AMBIENTE_GERADOR[dados.ambienteGerador] ?? '-'}`, xDireita, y0 + 6.4 * MM, {
      width: larguraDireita,
      lineBreak: false,
    });
    escrever(`Tipo de Ambiente: ${TIPO_AMBIENTE[dados.tipoAmbiente] ?? '-'}`, xDireita, y0 + 9.0 * MM, {
      width: larguraDireita,
      lineBreak: false,
    });

    linhaHorizontal(y0 + alturaFaixa);
    return y0 + alturaFaixa;
  }

  // ── Identificação + QR Code (2.1.1, 2.1.2, 2.4.3) ──
  async function desenharIdentificacao(y0: number): Promise<number> {
    documento.font('rotuloBold').fontSize(7).fillColor('#000');
    escrever('CHAVE DE ACESSO DA NFS-e', bx + 0.8 * MM, y0 + 0.8 * MM, { width: colw * 3, lineBreak: false });
    documento.font('conteudo').fontSize(7);
    escrever(dados.chaveAcesso, bx + 0.8 * MM, y0 + 3.8 * MM, { width: colw * 3, lineBreak: false });

    let y = y0 + 7.9 * MM;
    campoIdentificacao(0, y, 'NÚMERO DA NFS-e', dados.numero);
    campoIdentificacao(1, y, 'COMPETÊNCIA DA NFS-e', formatarData(dados.competencia));
    campoIdentificacao(2, y, 'DATA E HORA DA EMISSÃO DA NFS-e', formatarDataHora(dados.dataHoraEmissaoNfse));
    y += 6.9 * MM;
    campoIdentificacao(0, y, 'NÚMERO DA DPS', dados.numeroDps);
    campoIdentificacao(1, y, 'SÉRIE DA DPS', dados.serieDps);
    campoIdentificacao(2, y, 'DATA E HORA DA EMISSÃO DA DPS', formatarDataHora(dados.dataHoraEmissaoDps));
    y += 6.9 * MM;
    campoIdentificacao(0, y, 'EMITENTE DA NFS-e', TIPO_EMITENTE[dados.tipoEmitente] ?? '-', true);
    campoIdentificacao(1, y, 'SITUAÇÃO DA NFS-e', reticencias(SITUACAO_NFSE[dados.situacao] ?? dados.situacao, 37));
    campoIdentificacao(2, y, 'FINALIDADE', reticencias((dados.finalidade && FINALIDADE_NFSE[dados.finalidade]) ?? '-', 37));

    const urlConsulta = `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${dados.chaveAcesso}`;
    const qrPng = await QRCode.toBuffer(urlConsulta, { width: 150, margin: 1, errorCorrectionLevel: 'L' });
    const tamanhoQr = 17 * MM;
    documento.image(qrPng, col(3) + (colw - tamanhoQr) / 2, y0 + 1.5 * MM, { width: tamanhoQr });
    documento.font('conteudo').fontSize(6).fillColor('#000');
    escrever(TEXTO_QR_CODE, col(3) + 0.8 * MM, y0 + 1.5 * MM + tamanhoQr + 1 * MM, {
      width: colw - 1.6 * MM,
      align: 'left',
    });

    const novoY = y + 6.9 * MM;
    linhaHorizontal(novoY);
    return novoY;
  }

  // ── Prestador (2.1.3) ──
  function desenharPrestador(y: number): number {
    const p = dados.prestador;
    tituloBloco(y, 'PRESTADOR / FORNECEDOR');
    campo(1, 1, y, 'CNPJ / CPF / NIF', formatarDocumento(p.cnpj ?? p.cpf));
    campo(2, 1, y, 'Indicador Municipal (Inscrição)', p.inscricaoMunicipal ?? '-');
    campo(3, 1, y, 'Telefone', formatarTelefone(p.telefone));
    y += ALTURA_LINHA;
    campo(0, 2, y, 'Nome / Nome Empresarial', reticencias(p.nome, 77));
    campo(2, 1, y, 'Município / Sigla UF', municipioSiglaUf(p.endereco));
    campo(3, 1, y, 'Código IBGE / CEP', codigoIbgeCep(p.endereco));
    y += ALTURA_LINHA;
    campo(0, 2, y, 'Endereço', enderecoLegivel(p.endereco));
    campo(2, 2, y, 'E-mail', p.email ?? '-');
    y += ALTURA_LINHA;
    campo(0, 2, y, 'Simples Nacional na Data de Competência', reticencias(p.opcaoSimplesNacional && OPCAO_SIMPLES_NACIONAL[p.opcaoSimplesNacional], 37));
    campo(2, 2, y, 'Regime de Apuração Tributária pelo SN', reticencias(p.regimeApuracaoSimplesNacional && REGIME_APURACAO_SIMPLES_NACIONAL[p.regimeApuracaoSimplesNacional], 77));
    y += ALTURA_LINHA;
    linhaHorizontal(y);
    return y;
  }

  // ── Tomador / Destinatário / Intermediário (2.1.4-2.1.6, 2.3.1-2.3.2) ──
  function desenharTomador(y: number): number {
    if (!dados.tomador) return faixaSupressao(y, TEXTO_TOMADOR_NAO_IDENTIFICADO);
    return linhasPessoa(y, 'TOMADOR / ADQUIRENTE', dados.tomador);
  }
  function desenharDestinatario(y: number): number {
    if (dados.destinatarioEhTomador) return faixaSupressao(y, TEXTO_DESTINATARIO_E_TOMADOR);
    if (!dados.destinatario) return faixaSupressao(y, TEXTO_DESTINATARIO_NAO_IDENTIFICADO);
    return linhasPessoa(y, 'DESTINATÁRIO DA OPERAÇÃO', dados.destinatario, false);
  }
  function desenharIntermediario(y: number): number {
    if (!dados.intermediario) return faixaSupressao(y, TEXTO_INTERMEDIARIO_NAO_IDENTIFICADO);
    return linhasPessoa(y, 'INTERMEDIÁRIO DA OPERAÇÃO', dados.intermediario);
  }

  // Altura mínima que os blocos abaixo do Serviço vão ocupar - usada pra
  // truncar a descrição do serviço e caber tudo numa página A4 (§2.2).
  function alturaReservadaAposServico(): number {
    let altura = 0;
    altura += dados.tributacaoMunicipal ? 4 * ALTURA_LINHA : ALTURA_FAIXA;
    altura += ALTURA_LINHA; // tributacao federal, linha 1
    if (mostrarPisCofins()) altura += ALTURA_LINHA;
    if (dados.tributacaoIbscbs) altura += 4 * ALTURA_LINHA;
    altura += 2 * ALTURA_LINHA; // valor total
    altura += ALTURA_FAIXA + 0.5 * MM + 6 * MM; // informacoes complementares
    return altura + 1 * MM;
  }
  function mostrarPisCofins(): boolean {
    const ano = dados.competencia.getUTCFullYear();
    return ano <= 2026;
  }

  // ── Serviço (2.1.7) ──
  function desenharServico(y: number): number {
    const s = dados.servico;
    tituloBloco(y, 'SERVIÇO PRESTADO');
    campo(1, 1, y, 'Código de Tributação Nacional / Municipal', juntar(s.codigoTribNacional, s.codigoTribMunicipal));
    campo(2, 1, y, 'Código da NBS', s.codigoNbs ?? '-');
    campo(3, 1, y, 'Local da Prestação / Sigla UF / País', municipioLegivel(s.codigoMunicipioPrestacao));
    y += ALTURA_LINHA;

    // Descrição do código de tributação: sem label (tabela 2.4.5).
    const descricaoCodigo = s.codigoTribMunicipal ? s.descricaoTribMunicipal : s.descricaoTribNacional;
    documento.font('conteudo').fontSize(7).fillColor('#000');
    escrever(textoCabendo(reticencias(descricaoCodigo, 167), bw - 1.6 * MM, 7, 'conteudo'), bx + 0.8 * MM, y + 0.5 * MM, {
      width: bw - 1.6 * MM,
      lineBreak: false,
    });
    y += 3.8 * MM;

    documento.font('rotuloBold').fontSize(6);
    escrever('Descrição do Serviço', bx + 0.8 * MM, y + 0.5 * MM, { width: bw - 1.6 * MM, lineBreak: false });

    const tamanhoFonte = 7;
    const alturaLinha = tamanhoFonte * 1.15;
    const disponivel = margemSup + alturaUtil - alturaReservadaAposServico() - (y + 3.0 * MM);
    const maxLinhas = Math.max(Math.floor(disponivel / alturaLinha), 1);
    let descricao = s.descricao;
    const linhas = contarLinhas(descricao, bw - 1.6 * MM, tamanhoFonte);
    if (linhas > maxLinhas) {
      const aproximado = Math.floor((descricao.length * maxLinhas) / linhas) - 4;
      descricao = descricao.slice(0, Math.max(aproximado, 0)).replace(/\s+\S*$/, '') + '...';
    }
    documento.font('conteudo').fontSize(tamanhoFonte).fillColor('#000');
    escrever(descricao, bx + 0.8 * MM, y + 3.0 * MM, { width: bw - 1.6 * MM });
    y = Math.max(documento.y, y + 5.6 * MM) + 0.6 * MM;
    linhaHorizontal(y);
    return y;
  }

  // ── Tributação Municipal - ISSQN (2.1.8, 2.3.1) ──
  function desenharTributacaoMunicipal(y: number): number {
    const t = dados.tributacaoMunicipal;
    if (!t) return faixaSupressao(y, TEXTO_OPERACAO_NAO_SUJEITA_ISSQN);

    tituloBloco(y, 'TRIBUTAÇÃO MUNICIPAL (ISSQN)');
    campo(1, 1, y, 'Tipo de Tributação do ISSQN', (t.tribISSQN && TRIBUTACAO_ISSQN[t.tribISSQN]) ?? '-');
    campo(2, 2, y, 'Município / Sigla UF / País da Incidência do ISSQN', juntar(t.descricaoMunicipioIncidencia, t.codigoPaisIncidencia));
    y += ALTURA_LINHA;
    campo(0, 1, y, 'Regime Especial de Tributação do ISSQN', (t.regimeEspecialTributacao && REGIME_ESPECIAL_TRIBUTACAO[t.regimeEspecialTributacao]) ?? '-');
    campo(1, 1, y, 'Tipo de Imunidade do ISSQN', reticencias(t.tipoImunidade && TIPO_IMUNIDADE[t.tipoImunidade], 37));
    campo(2, 1, y, 'Suspensão da Exigibilidade do ISSQN', reticencias(t.suspensaoTipo && SUSPENSAO_EXIGIBILIDADE[t.suspensaoTipo], 37));
    campo(3, 1, y, 'Número Processo Suspensão', t.suspensaoNumeroProcesso ?? '-');
    y += ALTURA_LINHA;
    campo(0, 1, y, 'Benefício Municipal', reticencias(textoBeneficioMunicipal(t), 37));
    campo(1, 1, y, 'Cálculo do BM', formatarMoeda(t.beneficioMunicipalValor ?? t.beneficioMunicipalValorReducao));
    campo(2, 1, y, 'Total Deduções/Reduções', formatarMoeda(t.totalDeducoesReducoes));
    campo(3, 1, y, 'Desconto Incondicionado', formatarMoeda(t.descontoIncondicionado));
    y += ALTURA_LINHA;
    campo(0, 1, y, 'BC ISSQN', formatarMoeda(t.baseCalculo));
    campo(1, 1, y, 'Alíquota Aplicada', formatarPercentual(t.aliquotaAplicada));
    campo(2, 1, y, 'Retenção do ISSQN', (t.retencaoIssqn && RETENCAO_ISSQN[t.retencaoIssqn]) ?? '-');
    campo(3, 1, y, 'ISSQN Apurado', formatarMoeda(t.issqnApurado));
    y += ALTURA_LINHA;
    linhaHorizontal(y);
    return y;
  }

  // ── Tributação Federal exceto CBS (2.1.9) ──
  function desenharTributacaoFederal(y: number): number {
    const t = dados.tributacaoFederal;
    tituloBloco(y, 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)');
    campo(1, 1, y, 'IRRF', formatarMoeda(t.irrf));
    campo(2, 1, y, 'Contribuição Previdenciária - Retida', formatarMoeda(t.contribuicaoPrevidenciaria));
    campo(3, 1, y, 'Contribuições Sociais - Retidas', formatarMoeda(t.contribuicoesSociaisRetidas));
    y += ALTURA_LINHA;
    if (mostrarPisCofins()) {
      campo(0, 1, y, 'PIS - Débito Apuração Própria', formatarMoeda(t.pisDebito));
      campo(1, 1, y, 'COFINS - Débito Apuração Própria', formatarMoeda(t.cofinsDebito));
      campo(2, 2, y, 'Descrição Contrib. Sociais - Retidas', reticencias(t.tipoRetencaoPisCofins && RETENCAO_PIS_COFINS[t.tipoRetencaoPisCofins], 35));
      y += ALTURA_LINHA;
    }
    linhaHorizontal(y);
    return y;
  }

  // ── Tributação IBS / CBS (2.1.10) ──
  function desenharTributacaoIbscbs(y: number): number {
    const t = dados.tributacaoIbscbs;
    if (!t) return y;
    tituloBloco(y, 'TRIBUTAÇÃO IBS / CBS');
    campo(1, 1, y, 'CST / CCLASSTRIB', juntar(t.cst, t.cClassTrib));
    campo(2, 2, y, 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', juntar(t.indicadorOperacao, t.codigoMunicipioIncidencia, t.descricaoMunicipioIncidencia));
    y += ALTURA_LINHA;
    campo(0, 1, y, 'Exclusões e Reduções da Base de Cálculo', formatarMoeda(t.exclusoesReducoesBaseCalculo));
    campo(1, 1, y, 'Base de Cálculo Após Exclusões e Reduções', formatarMoeda(t.baseCalculoAposExclusoes));
    campo(2, 1, y, 'Red. Alíquota IBS / Red. Alíquota CBS', juntar(formatarPercentual(t.reducaoAliquotaUf), formatarPercentual(t.reducaoAliquotaMun), formatarPercentual(t.reducaoAliquotaCbs)));
    campo(3, 1, y, 'Alíquota - IBS UF / IBS Mun', juntar(formatarPercentual(t.aliquotaIbsUf), formatarPercentual(t.aliquotaIbsMun)));
    y += ALTURA_LINHA;
    campo(0, 1, y, 'Alíq. Efetiva Municipal - IBS', formatarPercentual(t.aliquotaEfetivaMun));
    campo(1, 1, y, 'Valor Apurado Municipal - IBS', formatarMoeda(t.valorApuradoMun));
    campo(2, 1, y, 'Alíq. Efetiva Estadual - IBS', formatarPercentual(t.aliquotaEfetivaUf));
    campo(3, 1, y, 'Valor Apurado Estadual - IBS', formatarMoeda(t.valorApuradoUf));
    y += ALTURA_LINHA;
    campo(0, 1, y, 'Valor Total Apurado - IBS', formatarMoeda(t.valorTotalApuradoIbs));
    campo(1, 1, y, 'Alíquota - CBS', formatarPercentual(t.aliquotaCbs));
    campo(2, 1, y, 'Alíquota Efetiva - CBS', formatarPercentual(t.aliquotaEfetivaCbs));
    campo(3, 1, y, 'Valor Total Apurado - CBS', formatarMoeda(t.valorTotalApuradoCbs));
    y += ALTURA_LINHA;
    linhaHorizontal(y);
    return y;
  }

  // ── Valor Total da NFS-e (2.1.11) ──
  function desenharValorTotal(y: number): number {
    const t = dados.valorTotal;
    tituloBloco(y, 'VALOR TOTAL DA NFS-E');
    campo(1, 1, y, 'Valor da Operação / Serviço', formatarMoeda(t.valorServico));
    campo(2, 1, y, 'Desconto Incondicionado', formatarMoeda(t.descontoIncondicionado));
    campo(3, 1, y, 'Desconto Condicionado', formatarMoeda(t.descontoCondicionado));
    y += ALTURA_LINHA;
    campo(0, 1, y, 'Total das Retenções (ISSQN / Federais)', formatarMoeda(t.totalRetencoes));
    campo(1, 1, y, 'Valor Líquido da NFS-e', formatarMoeda(t.valorLiquido));
    campo(2, 1, y, 'Total do IBS/CBS', formatarMoeda(t.totalIbsCbs));
    campo(3, 1, y, 'Valor Líquido da NFS-e + IBS/CBS', formatarMoeda(t.valorLiquidoComIbsCbs), true);
    y += ALTURA_LINHA;
    linhaHorizontal(y);
    return y;
  }

  // ── Informações Complementares (absorve o espaço restante da página,
  // descontado o Canhoto quando incluído - §2.1.12, §2.3.3) ──
  function desenharInformacoesComplementares(y: number, alturaReservada: number): number {
    const info = dados.informacoesComplementares;
    const fim = margemSup + alturaUtil - alturaReservada;
    y = faixaTitulo(y, 'INFORMAÇÕES COMPLEMENTARES');

    const segmentos: string[] = [];
    const adicionar = (rotulo: string, valor: string | undefined) => {
      if (valor && valor.trim()) segmentos.push(`${rotulo} ${valor.trim()}`);
    };
    adicionar('Inf. Cont.:', info.informacoesContribuinte);
    adicionar('NFS-e Subst.:', info.chaveNfseSubstituida);
    adicionar('Doc. Ref.:', info.documentoReferenciado);
    adicionar('Cod. Obra:', info.codigoObra);
    adicionar('Insc. Imob.:', info.inscricaoImobiliariaFiscal);
    adicionar('Cod. Evt.:', info.codigoEvento);
    adicionar('Doc. Tec.:', info.documentoTecnico);
    adicionar('Núm. Ped.:', info.numeroPedido);
    if (info.itensPedido.length) adicionar('Item Ped.:', info.itensPedido.join('; '));
    adicionar('Inf. A. T. Mun.:', info.informacoesAdministracaoTributariaMunicipal);

    const totalAproximado = (rotulo: string, alvo?: { valor?: number; percentual?: number }) =>
      `${rotulo}: ${alvo?.valor !== undefined ? formatarMoeda(alvo.valor) : alvo?.percentual !== undefined ? formatarPercentual(alvo.percentual) : '-'}`;
    const aproximados =
      'Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: ' +
      `${totalAproximado('Federais', info.totalAproximadoTributosFederais)} ; ` +
      `${totalAproximado('Estaduais', info.totalAproximadoTributosEstaduais)} ; ` +
      `${totalAproximado('Municipais', info.totalAproximadoTributosMunicipais)}`;

    const tamanhoFonte = 7;
    const alturaLinha = tamanhoFonte * 1.15;
    const disponivel = fim - y - 1 * MM;
    const maxLinhas = Math.max(Math.floor(disponivel / alturaLinha), 1);
    let limiteVariavel = 1997;
    let texto: string;
    while (true) {
      const variavel = reticencias(segmentos.join(' | '), limiteVariavel);
      texto = variavel !== '-' ? `${variavel} | ${aproximados}` : aproximados;
      if (contarLinhas(texto, bw - 1.6 * MM, tamanhoFonte) <= maxLinhas || limiteVariavel <= 100) break;
      limiteVariavel = Math.max(limiteVariavel - 200, 100);
    }
    documento.font('conteudo').fontSize(tamanhoFonte).fillColor('#000');
    escrever(texto, bx + 0.8 * MM, y + 0.5 * MM, { width: bw - 1.6 * MM });
    return fim;
  }

  // ── Canhoto (item 2.1.13, opcional) ──
  function desenharCanhoto(y: number): number {
    y = faixaTitulo(y, 'CANHOTO');
    campoBranco(0, 2, y, 'Data de Cientificação');
    campoBranco(2, 2, y, 'Identificação e Assinatura');
    y += ALTURA_LINHA;
    campo(0, 4, y, 'Nº NFS-e / Chave de Acesso da NFS-e', `${dados.numero} / ${dados.chaveAcesso}`);
    y += ALTURA_LINHA;
    linhaHorizontal(y);
    return y;
  }

  // ── Marca d'água (Cancelada/Substituída), §2.5 ──
  function desenharMarcaDagua(): void {
    const marca = opcoes.situacaoEspecial === 'Cancelada' ? 'CANCELADA' : opcoes.situacaoEspecial === 'Substituida' ? 'SUBSTITUÍDA' : null;
    if (!marca) return;
    documento.save();
    documento.rotate(-45, { origin: [documento.page.width / 2, documento.page.height / 2] });
    // Cinza K35 solido - sem opacity() por cima, que deixaria a marca mais
    // clara que o exigido em visualizadores que respeitam transparencia.
    documento.font('rotuloRegular').fontSize(60).fillColor('#a6a6a6');
    escrever(marca, 0, documento.page.height / 2 - 30, { width: documento.page.width, align: 'center' });
    documento.fillColor('#000').restore();
  }

  const incluirCanhoto = opcoes.incluirCanhoto ?? true;
  const alturaCanhoto = ALTURA_FAIXA + 0.5 * MM + 2 * ALTURA_LINHA;

  let y = desenharCabecalho();
  y = await desenharIdentificacao(y);
  y = desenharPrestador(y);
  y = desenharTomador(y);
  y = desenharDestinatario(y);
  y = desenharIntermediario(y);
  y = desenharServico(y);
  y = desenharTributacaoMunicipal(y);
  y = desenharTributacaoFederal(y);
  y = desenharTributacaoIbscbs(y);
  y = desenharValorTotal(y);
  y = desenharInformacoesComplementares(y, incluirCanhoto ? alturaCanhoto : 0);
  if (incluirCanhoto) desenharCanhoto(y);

  documento.lineWidth(ESPESSURA_BORDA).strokeColor('#000').rect(margemEsq, margemSup, larguraUtil, alturaUtil).stroke();
  desenharMarcaDagua();

  documento.end();
  return finalizado;
}
