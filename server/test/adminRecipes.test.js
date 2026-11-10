import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRecipe } from '../src/controllers/adminRecipesController.js';

const valid = {
  name: '  Papa   a la huancaína ',
  category: 'Side',
  ingredients: [{ es: 'Papas amarillas', measure: '500 g' }, { es: 'Queso fresco', measure: '', name: 'Queso Fresco' }],
  steps: ['Sancocha las papas.', '  ', 'Sirve con la crema.'],
};

test('limpia el formulario: espacios, pasos vacíos y claves en inglés', () => {
  const r = cleanRecipe(valid);
  assert.equal(r.name, 'Papa a la huancaína');
  assert.equal(r.nameEn, 'Papa a la huancaína'); // sin nombre en inglés se usa el mismo
  assert.equal(r.photo, 'Papa a la huancaína'); // sin búsqueda de foto se usa el nombre
  assert.deepEqual(r.steps, ['Sancocha las papas.', 'Sirve con la crema.']);
  assert.equal(r.ingredients[1].name, 'queso fresco'); // la clave que escribió el admin, en minúsculas
  assert.ok(r.ingredients[0].name.length > 0); // se completa sola (diccionario o el propio nombre)
});

test('la clave en inglés se toma del diccionario si el admin no la escribe', () => {
  const r = cleanRecipe({ ...valid, ingredients: [{ es: 'pollo', measure: '1' }] });
  assert.match(r.ingredients[0].name, /chicken/);
});

test('rechaza datos incompletos o inválidos', () => {
  assert.throws(() => cleanRecipe({ ...valid, name: 'a' }), /nombre/);
  assert.throws(() => cleanRecipe({ ...valid, category: 'Inventada' }), /categoría/);
  assert.throws(() => cleanRecipe({ ...valid, ingredients: [{ es: '  ' }] }), /ingrediente/);
  assert.throws(() => cleanRecipe({ ...valid, steps: ['   '] }), /paso/);
  assert.throws(() => cleanRecipe({ ...valid, steps: Array.from({ length: 31 }, (_, i) => `Paso ${i}`) }), /30 pasos/);
  assert.throws(() => cleanRecipe(), /nombre/);
});
