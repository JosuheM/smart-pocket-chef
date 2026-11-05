import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMeasure, scaleMeasure, sumMeasures } from '../src/utils/measures.js';
import { buildShoppingList } from '../src/services/quickchart.js';

test('escalar porciones (base 2 personas)', () => {
  assert.equal(scaleMeasure('1/2 taza', 2), '1 taza');
  assert.equal(scaleMeasure('1/2 taza', 3), '1 1/2 tazas');
  assert.equal(scaleMeasure('200g', 2), '400g');
  assert.equal(scaleMeasure('450 g', 3), '1,35 kg');
  assert.equal(scaleMeasure('500 g, en tiras', 2), '1 kg, en tiras');
  assert.equal(scaleMeasure('2 dientes, picados', 2), '4 dientes, picados');
  assert.equal(scaleMeasure('1 diente', 3), '3 dientes');
  assert.equal(scaleMeasure('1-2 tazas', 2), '2 a 4 tazas');
  assert.equal(scaleMeasure('1 taza (unos 10 limones)', 3), '3 tazas (unos 30 limones)');
  assert.equal(scaleMeasure('½ taza', 2), '1 taza');
  assert.equal(scaleMeasure('1 grande', 3), '3 grandes');
});

test('las medidas sin número no se tocan', () => {
  assert.equal(scaleMeasure('al gusto', 3), 'al gusto');
  assert.equal(scaleMeasure('para acompañar', 3), 'para acompañar');
  assert.equal(scaleMeasure('1 lata', 1), '1 lata');
});

test('sumar medidas del mismo ingrediente', () => {
  assert.equal(sumMeasures('200 g', '300 g'), '500 g');
  assert.equal(sumMeasures('500 g', '1 kg'), '1,5 kg');
  assert.equal(sumMeasures('2 dientes', '3 dientes'), '5 dientes');
  assert.equal(sumMeasures('1 taza', '1/2 taza'), '1 1/2 tazas');
  assert.equal(sumMeasures('200 g', '1 taza'), null);
});

test('unir medidas: suma las iguales y apila las distintas', () => {
  assert.equal(mergeMeasure('200 g', '1 taza'), '200 g + 1 taza');
  assert.equal(mergeMeasure('200 g + 1 taza', '100 g'), '300 g + 1 taza');
  assert.equal(mergeMeasure('al gusto', 'al gusto'), 'al gusto');
  assert.equal(mergeMeasure('2', '2'), '4');
});

test('la lista de compras unifica los ingredientes repetidos de varias recetas', () => {
  const list = buildShoppingList([
    { name: 'Cebolla', measure: '1 grande' },
    { name: 'ajo', measure: '2 dientes' },
    { name: 'Ajo', measure: '3 dientes' },
    { name: 'Arroz', measure: '200 g' },
    { name: 'arroz', measure: '300 g' },
  ], 'Compra semanal');
  assert.equal(list.items.length, 3);
  assert.equal(list.items.find((i) => i.name === 'Ajo').measure, '5 dientes');
  assert.equal(list.items.find((i) => i.name === 'Arroz').measure, '500 g');
  assert.match(list.qrUrl, /^https:\/\/quickchart\.io\/qr\?text=/);
});
