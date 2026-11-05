import test from 'node:test';
import assert from 'node:assert/strict';
import { allergensOf, dietFlags, ingredientFlags, parseDiet } from '../src/utils/diet.js';

const flagged = (name) => Object.entries(ingredientFlags(name)).filter(([, on]) => on).map(([diet]) => diet);

test('gluten', () => {
  assert.deepEqual(flagged('Plain Flour'), ['gluten']);
  assert.deepEqual(flagged('Egg Noodles'), ['gluten']);
  assert.deepEqual(flagged('Soy Sauce'), ['gluten']);
  assert.deepEqual(flagged('rice flour'), []);
  assert.deepEqual(flagged('Rice Noodles'), []);
});

test('lácteos', () => {
  assert.deepEqual(flagged('Butter'), ['dairy']);
  assert.deepEqual(flagged('Cheddar Cheese'), ['dairy']);
  assert.deepEqual(flagged('Double Cream'), ['dairy']);
  assert.deepEqual(flagged('Coconut Milk'), []);
  assert.deepEqual(flagged('Butternut Squash'), []);
  assert.deepEqual(flagged('Cream of Tartar'), []);
});

test('frutos secos', () => {
  assert.deepEqual(flagged('Almonds'), ['nuts']);
  assert.deepEqual(flagged('Peanut Butter'), ['nuts']);
  assert.deepEqual(flagged('Nutmeg'), []);
  assert.deepEqual(flagged('Coconut'), []);
  assert.deepEqual(flagged('Water Chestnuts'), []);
});

test('una receta se marca según todos sus ingredientes', () => {
  const flags = dietFlags(['Chicken Breast', 'Plain Flour', 'Butter']);
  assert.deepEqual(flags, { gluten: true, dairy: true, nuts: false });
  assert.deepEqual(allergensOf(flags), ['gluten', 'lácteos']);
});

test('parseDiet descarta valores desconocidos', () => {
  assert.deepEqual(parseDiet('gluten,dairy,otra,gluten'), ['gluten', 'dairy']);
  assert.deepEqual(parseDiet(undefined), []);
});
