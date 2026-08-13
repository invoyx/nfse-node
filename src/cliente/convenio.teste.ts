import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizarConvenio } from './convenio.js';

test('normaliza os parametros de convenio, incluindo os campos com nome literal da spec oficial', () => {
  const resultado = normalizarConvenio({
    mensagem: null,
    parametrosConvenio: {
      tipoConvenioDeserializationSetter: 1,
      aderenteAmbienteNacional: 1,
      aderenteEmissorNacional: 0,
      situacaoEmissaoPadraoContribuintesRFB: 1,
      aderenteMAN: -1,
      permiteAproveitametoDeCreditos: true,
    },
  });

  assert.equal(resultado.parametros.tipoConvenio, 1);
  assert.equal(resultado.parametros.aderenteAmbienteNacional, 1);
  assert.equal(resultado.parametros.aderenteEmissorNacional, 0);
  assert.equal(resultado.parametros.situacaoEmissaoPadraoContribuintesRfb, 1);
  assert.equal(resultado.parametros.aderenteMan, -1);
  assert.equal(resultado.parametros.permiteAproveitamentoDeCreditos, true);
});

test('lida com parametrosConvenio ausente sem lancar erro', () => {
  const resultado = normalizarConvenio({ mensagem: 'Municipio nao conveniado' });
  assert.equal(resultado.mensagem, 'Municipio nao conveniado');
  assert.equal(resultado.parametros.tipoConvenio, undefined);
});
