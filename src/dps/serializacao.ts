import { ErroValidacaoDps } from './erros.js';
import { escaparXml, formatarData, formatarDataHora, formatarDecimal } from './formatadores.js';
import { gerarIdDps } from './identificador.js';
import type {
  DadosDps,
  DestinatarioIbscbs,
  Endereco,
  Pessoa,
  Prestador,
  Servico,
  Valores,
} from './tipos.js';

const NAMESPACE_DPS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO_LEIAUTE = '1.01';

/** Resultado da montagem: XML ainda não assinado e o Id gerado para o elemento infDPS. */
export interface DpsMontada {
  id: string;
  xml: string;
}

/**
 * Monta o XML da DPS a partir dos dados informados, seguindo a ordem de
 * elementos exigida por tiposComplexos_v1.01.xsd (TCInfDPS). O XML retornado
 * ainda não está assinado - use o módulo `assinatura` com o `id` devolvido.
 */
export function montarXmlDps(dados: DadosDps): DpsMontada {
  const documentoEmitente = dados.prest.CNPJ ?? dados.prest.CPF;
  if (!documentoEmitente) {
    throw new ErroValidacaoDps('prest.CNPJ ou prest.CPF é obrigatório para gerar o Id da DPS.');
  }
  if (dados.IBSCBS) {
    throw new ErroValidacaoDps(
      'Serialização do bloco IBSCBS ainda não implementada nesta versão do SDK (o detalhamento de cálculo por classificação tributária exigido pelo XSD ainda não está coberto).'
    );
  }

  const id = gerarIdDps({
    documentoEmitente,
    codigoMunicipioEmissor: dados.cLocEmi,
    serie: dados.serie,
    numero: dados.nDPS,
  });

  const infDps = [
    tag('tpAmb', dados.tpAmb),
    tag('dhEmi', formatarDataHora(dados.dhEmi)),
    tag('verAplic', dados.verAplic),
    tag('serie', dados.serie),
    tag('nDPS', dados.nDPS),
    tag('dCompet', formatarData(dados.dCompet)),
    tag('tpEmit', dados.tpEmit),
    tag('cLocEmi', dados.cLocEmi),
    xmlPrestador(dados.prest),
    dados.toma ? xmlPessoa('toma', dados.toma) : '',
    dados.interm ? xmlPessoa('interm', dados.interm) : '',
    xmlServico(dados.serv),
    xmlValores(dados.valores),
  ].join('');

  const xml =
    `<DPS xmlns="${NAMESPACE_DPS}" versao="${VERSAO_LEIAUTE}">` +
    `<infDPS Id="${id}">${infDps}</infDPS>` +
    `</DPS>`;

  return { id, xml };
}

function xmlDocumentoFiscal(doc: { CNPJ?: string; CPF?: string }): string {
  if (doc.CNPJ) return tag('CNPJ', doc.CNPJ);
  if (doc.CPF) return tag('CPF', doc.CPF);
  throw new ErroValidacaoDps('É necessário informar CNPJ ou CPF.');
}

function xmlEndereco(end: Endereco): string {
  return (
    `<endNac>${tag('cMun', end.cMun)}${tag('CEP', end.CEP)}</endNac>` +
    tag('xLgr', end.xLgr) +
    tag('nro', end.nro) +
    tag('xCpl', end.xCpl) +
    tag('xBairro', end.xBairro)
  );
}

function xmlPrestador(prest: Prestador): string {
  const corpo =
    xmlDocumentoFiscal(prest) +
    tag('IM', prest.IM) +
    tag('xNome', prest.xNome) +
    (prest.end ? `<end>${xmlEndereco(prest.end)}</end>` : '') +
    tag('fone', prest.fone) +
    tag('email', prest.email) +
    `<regTrib>${tag('opSimpNac', prest.regTrib.opSimpNac)}${tag('regApTribSN', prest.regTrib.regApTribSN)}${tag('regEspTrib', prest.regTrib.regEspTrib)}</regTrib>`;
  return `<prest>${corpo}</prest>`;
}

function xmlPessoaConteudo(pessoa: Pessoa | DestinatarioIbscbs): string {
  return (
    xmlDocumentoFiscal(pessoa) +
    ('IM' in pessoa ? tag('IM', pessoa.IM) : '') +
    tag('xNome', pessoa.xNome) +
    (pessoa.end ? `<end>${xmlEndereco(pessoa.end)}</end>` : '') +
    tag('fone', pessoa.fone) +
    tag('email', pessoa.email)
  );
}

function xmlPessoa(elemento: 'toma' | 'interm', pessoa: Pessoa): string {
  return `<${elemento}>${xmlPessoaConteudo(pessoa)}</${elemento}>`;
}

function xmlServico(serv: Servico): string {
  const locPrest = serv.locPrest.cLocPrestacao
    ? tag('cLocPrestacao', serv.locPrest.cLocPrestacao)
    : tag('cPaisPrestacao', serv.locPrest.cPaisPrestacao);
  const cServ =
    tag('cTribNac', serv.cServ.cTribNac) +
    tag('cTribMun', serv.cServ.cTribMun) +
    tag('xDescServ', serv.cServ.xDescServ) +
    tag('cNBS', serv.cServ.cNBS);
  return `<serv><locPrest>${locPrest}</locPrest><cServ>${cServ}</cServ></serv>`;
}

function xmlValores(valores: Valores): string {
  const vServPrest =
    tagNum('vReceb', valores.vServPrest.vReceb) + tagNum('vServ', valores.vServPrest.vServ);
  const vDescCondIncond = valores.vDescCondIncond
    ? `<vDescCondIncond>${tagNum('vDescIncond', valores.vDescCondIncond.vDescIncond)}${tagNum('vDescCond', valores.vDescCondIncond.vDescCond)}</vDescCondIncond>`
    : '';

  const tribMun = valores.trib.tribMun;
  const xmlTribMun =
    `<tribMun>` +
    tag('tribISSQN', tribMun.tribISSQN) +
    tag('cPaisResult', tribMun.cPaisResult) +
    tag('tpImunidade', tribMun.tpImunidade) +
    tag('tpRetISSQN', tribMun.tpRetISSQN) +
    tagNum('pAliq', tribMun.pAliq) +
    `</tribMun>`;

  const tribFed = valores.trib.tribFed;
  const xmlTribFed = tribFed
    ? `<tribFed>${
        tribFed.piscofins
          ? `<piscofins>${tag('CST', tribFed.piscofins.CST)}${tagNum('vBCPisCofins', tribFed.piscofins.vBCPisCofins)}${tagNum('pAliqPis', tribFed.piscofins.pAliqPis)}${tagNum('pAliqCofins', tribFed.piscofins.pAliqCofins)}${tagNum('vPis', tribFed.piscofins.vPis)}${tagNum('vCofins', tribFed.piscofins.vCofins)}${tag('tpRetPisCofins', tribFed.piscofins.tpRetPisCofins)}</piscofins>`
          : ''
      }${tagNum('vRetCP', tribFed.vRetCP)}${tagNum('vRetIRRF', tribFed.vRetIRRF)}${tagNum('vRetCSLL', tribFed.vRetCSLL)}</tribFed>`
    : '';

  const totTrib = valores.trib.totTrib;
  const xmlTotTrib =
    'vTotTribFed' in totTrib && totTrib.vTotTribFed !== undefined
      ? `<vTotTrib>${tagNum('vTotTribFed', totTrib.vTotTribFed)}${tagNum('vTotTribEst', totTrib.vTotTribEst)}${tagNum('vTotTribMun', totTrib.vTotTribMun)}</vTotTrib>`
      : `<pTotTrib>${tagNum('pTotTribFed', totTrib.pTotTribFed)}${tagNum('pTotTribEst', totTrib.pTotTribEst)}${tagNum('pTotTribMun', totTrib.pTotTribMun)}</pTotTrib>`;

  return (
    `<valores>` +
    `<vServPrest>${vServPrest}</vServPrest>` +
    vDescCondIncond +
    `<trib>${xmlTribMun}${xmlTribFed}<totTrib>${xmlTotTrib}</totTrib></trib>` +
    `</valores>`
  );
}

function tag(nome: string, valor: string | undefined): string {
  return valor === undefined || valor === '' ? '' : `<${nome}>${escaparXml(valor)}</${nome}>`;
}

function tagNum(nome: string, valor: number | undefined): string {
  return valor === undefined ? '' : `<${nome}>${formatarDecimal(valor)}</${nome}>`;
}
