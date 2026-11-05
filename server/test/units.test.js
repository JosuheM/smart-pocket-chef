import test from 'node:test';
import assert from 'node:assert/strict';
import { measureEs, poundsToMetric } from '../src/utils/spanish.js';
import { fahrenheitToCelsius, ouncesToMetric, toMetric } from '../src/utils/units.js';

const measure = (text) => toMetric(measureEs(text));

test('libras a gramos y kilos', () => {
  assert.equal(poundsToMetric('1 lb'), '450 g');
  assert.equal(poundsToMetric('3 Lbs'), '1,35 kg');
  assert.equal(poundsToMetric('Serve with a pound cake.'), 'Serve with a pound cake.');
});

test('onzas de las medidas a gramos', () => {
  assert.equal(measure('4 oz'), '115 g');
  assert.equal(measure('16 ounces'), '450 g');
  assert.equal(measure('1 1/4 oz'), '35 g');
  assert.equal(measure('14 oz jar'), '400 g jar');
  assert.equal(measure('2-3 oz'), '55 a 85 g');
});

test('onzas líquidas a mililitros', () => {
  assert.equal(measure('8 fl oz'), '235 ml');
});

test('si el valor métrico ya está al lado, solo se quita la parte en onzas', () => {
  assert.equal(measure('175g/6oz'), '175g');
  assert.equal(measure('50ml/2fl oz'), '50ml');
  assert.equal(measure('8 ounces (230 grams)'), '230 g');
  assert.equal(ouncesToMetric('Melt 25g/1oz of the butter'), 'Melt 25g of the butter');
  assert.equal(ouncesToMetric('In a bowl combine 3.5 oz (100 grams) Feta'), 'In a bowl combine 100 grams Feta');
});

test('onzas dentro de los pasos', () => {
  assert.equal(toMetric('Place 4 oz. ground pork in the pan'), 'Place 115 g ground pork in the pan');
});

test('grados Fahrenheit a Celsius', () => {
  assert.equal(fahrenheitToCelsius('Heat oven to 350°F, or until'), 'Heat oven to 175 °C, or until');
  assert.equal(fahrenheitToCelsius('Preheat oven to 550F.'), 'Preheat oven to 290 °C.');
  assert.equal(fahrenheitToCelsius('Bake at 350 F for 10'), 'Bake at 175 °C for 10');
  assert.equal(fahrenheitToCelsius('Preheat the oven to 350˚F.'), 'Preheat the oven to 175 °C.');
  assert.equal(fahrenheitToCelsius('Bake at 350-375°F'), 'Bake at 175 a 190 °C');
  assert.equal(fahrenheitToCelsius('Precalienta el horno a 350 grados F.'), 'Precalienta el horno a 175 °C.');
});

test('si el Celsius ya está, se quita el Fahrenheit', () => {
  assert.equal(fahrenheitToCelsius('Bake at 200°C (400°F) for 20 minutes'), 'Bake at 200°C for 20 minutes');
  assert.equal(fahrenheitToCelsius('Preheat oven to 375 degrees F (190 degrees C) and'), 'Preheat oven to 190 degrees C and');
  assert.equal(fahrenheitToCelsius('Preheat oven to 400ºF (200ºC), and'), 'Preheat oven to 200ºC, and');
});

test('no toca lo que no es Fahrenheit', () => {
  assert.equal(toMetric('Hornea a 200°C durante 20 minutos'), 'Hornea a 200°C durante 20 minutos');
  assert.equal(toMetric('Cook 20 minutes at medium heat'), 'Cook 20 minutes at medium heat');
  assert.equal(toMetric('Servir con 2 F tazas'), 'Servir con 2 F tazas');
});
