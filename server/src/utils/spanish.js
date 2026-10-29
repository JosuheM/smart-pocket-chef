// Categorías, países y medidas de TheMealDB: son listas cerradas, así que se traducen sin gastar cuota de ninguna API.
const CATEGORY = {
  Beef: 'Res', Breakfast: 'Desayuno', Chicken: 'Pollo', Dessert: 'Postre', Goat: 'Cabra',
  Lamb: 'Cordero', Miscellaneous: 'Variado', Pasta: 'Pasta', Pork: 'Cerdo', Seafood: 'Mariscos',
  Side: 'Acompañamiento', Starter: 'Entrada', Vegan: 'Vegano', Vegetarian: 'Vegetariano',
};

// TheMealDB mezcla gentilicios ("Turkish") y nombres de país ("France"): todo se muestra como país en español.
const AREA = {
  American: 'Estados Unidos', 'United States': 'Estados Unidos', USA: 'Estados Unidos', British: 'Reino Unido',
  'United Kingdom': 'Reino Unido', Canadian: 'Canadá', Chinese: 'China', Croatian: 'Croacia', Dutch: 'Países Bajos',
  Netherlands: 'Países Bajos', Egyptian: 'Egipto', Filipino: 'Filipinas', French: 'Francia', France: 'Francia',
  Greek: 'Grecia', Indian: 'India', India: 'India', Irish: 'Irlanda', Italian: 'Italia', Jamaican: 'Jamaica',
  Japanese: 'Japón', Kenyan: 'Kenia', Malaysian: 'Malasia', Mexican: 'México', Moroccan: 'Marruecos',
  Norwegian: 'Noruega', Norway: 'Noruega', Polish: 'Polonia', Portuguese: 'Portugal', Russian: 'Rusia',
  Spanish: 'España', Thai: 'Tailandia', Tunisian: 'Túnez', Turkish: 'Turquía', Ukrainian: 'Ucrania',
  Vietnamese: 'Vietnam', Algerian: 'Argelia', Argentine: 'Argentina', Argentina: 'Argentina', Australian: 'Australia',
  Austrian: 'Austria', Belgian: 'Bélgica', Brazilian: 'Brasil', Chilean: 'Chile', Colombian: 'Colombia',
  Cuban: 'Cuba', Czech: 'Chequia', Danish: 'Dinamarca', Ecuadorean: 'Ecuador', Ethiopian: 'Etiopía',
  German: 'Alemania', Ghanaian: 'Ghana', Hungarian: 'Hungría', Indonesian: 'Indonesia', Iranian: 'Irán',
  Iraqi: 'Irak', Israeli: 'Israel', Lebanese: 'Líbano', Nigerian: 'Nigeria', Pakistani: 'Pakistán',
  Peruvian: 'Perú', 'Puerto Rican': 'Puerto Rico', Romanian: 'Rumanía', 'Saudi Arabian': 'Arabia Saudita',
  Slovakia: 'Eslovaquia', Slovak: 'Eslovaquia', 'South Korean': 'Corea del Sur', Swedish: 'Suecia', Swiss: 'Suiza',
  Syrian: 'Siria', Uruguayan: 'Uruguay', Venezuela: 'Venezuela', Venezuelan: 'Venezuela', Dominican: 'República Dominicana',
  Haitian: 'Haití', Cambodian: 'Camboya', Bangladeshi: 'Bangladés', Bolivian: 'Bolivia', Panamanian: 'Panamá',
  Unknown: '',
};

export const categoryEs = (c) => CATEGORY[c] ?? c;
export const areaEs = (a) => AREA[String(a ?? '').trim()] ?? String(a ?? '').trim();
export const CATEGORIES = Object.keys(CATEGORY);

// Medidas: unidades y palabras frecuentes ("2 tbsp", "3 cloves", "1 large")
const MEASURE_RULES = [
  [/\btablespoons?\b|\btbsp\b|\btbs\b|\btblsp\b/gi, 'cda.'],
  [/\bteaspoons?\b|\btsp\b/gi, 'cdta.'],
  [/\bcups\b/gi, 'tazas'], [/\bcup\b/gi, 'taza'],
  [/\bcloves\b/gi, 'dientes'], [/\bclove\b/gi, 'diente'],
  [/\bpounds?\b|\blbs?\b/gi, 'lb'],
  [/\bounces?\b/gi, 'oz'],
  [/\bpinch(es)?\b/gi, 'pizca'], [/\bdash(es)?\b/gi, 'chorrito'], [/\bhandfull?\b/gi, 'puñado'],
  [/\bbunch(es)?\b/gi, 'manojo'], [/\bsprigs?\b/gi, 'ramitas'], [/\bslices?\b/gi, 'rebanadas'],
  [/\bpieces?\b/gi, 'piezas'], [/\btins?\b|\bcans?\b/gi, 'lata'], [/\bknob\b/gi, 'trozo'],
  [/\bsticks?\b/gi, 'barras'], [/\bsheets?\b/gi, 'láminas'], [/\bpackets?\b|\bpacks?\b/gi, 'paquete'],
  [/\bto taste\b/gi, 'al gusto'], [/\bto serve\b/gi, 'para servir'], [/\bto garnish\b/gi, 'para decorar'],
  [/\bas needed\b/gi, 'al gusto'], [/\bwhole\b/gi, 'entero'], [/\bfresh\b/gi, 'fresco'],
  [/\blarge\b/gi, 'grande'], [/\bmedium\b/gi, 'mediano'], [/\bsmall\b/gi, 'pequeño'],
  [/\bchopped\b/gi, 'picado'], [/\bsliced\b/gi, 'en rodajas'], [/\bdiced\b/gi, 'en cubos'],
  [/\bminced\b/gi, 'picado fino'], [/\bgrated\b/gi, 'rallado'], [/\bfinely\b/gi, 'finamente'],
  [/\bhalf\b/gi, 'medio'], [/\bcloves of\b/gi, 'dientes de'], [/\band\b/gi, 'y'], [/\bof\b/gi, 'de'],
  [/\bplus extra\b/gi, 'más extra'], [/\bbeaten\b/gi, 'batido'], [/\bmelted\b/gi, 'derretido'],
  [/\bpeeled\b/gi, 'pelado'], [/\bcrushed\b/gi, 'triturado'], [/\bsplash\b/gi, 'chorrito'], [/\bdrizzle\b/gi, 'chorrito'],
  [/\bjuice\b/gi, 'jugo'], [/\bzest\b/gi, 'ralladura'], [/\bgarnish\b/gi, 'para decorar'],
  [/\bcooked\b/gi, 'cocido'], [/\bsoftened\b/gi, 'blando'], [/\bcubed\b/gi, 'en cubos'], [/\bground\b/gi, 'molido'],
];

export function measureEs(measure = '') {
  return MEASURE_RULES.reduce((text, [re, es]) => text.replace(re, es), String(measure ?? '')).replace(/\s+/g, ' ').trim();
}
