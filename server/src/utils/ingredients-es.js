import { normalize, stem } from './text.js';

// Diccionario inglés = español de los ingredientes que más usa TheMealDB (cubre ~90 % de las apariciones).
// Se traduce sin gastar cuota de ninguna API; lo que no esté aquí se traduce con MyMemory/DeepL y se guarda en caché.
const RAW = `
salt = sal
garlic = ajo
onion = cebolla
butter = mantequilla
olive oil = aceite de oliva
sugar = azúcar
water = agua
milk = leche
egg = huevo
eggs = huevos
vegetable oil = aceite vegetal
parsley = perejil
pepper = pimienta
black pepper = pimienta negra
ground black pepper = pimienta negra molida
flour = harina
plain flour = harina común
all purpose flour = harina todo uso
self-raising flour = harina con polvo de hornear
strong white bread flour = harina de fuerza
strong white flour = harina de fuerza
bread flour = harina de fuerza
corn flour = almidón de maíz
cornflour = almidón de maíz
cornstarch = maicena
cornmeal = harina de maíz
rice flour = harina de arroz
rye flour = harina de centeno
wheat flour = harina de trigo
white flour = harina blanca
almond flour = harina de almendras
chickpea flour = harina de garbanzo
buckwheat flour = harina de trigo sarraceno
potatoes = papas
potato = papa
carrots = zanahorias
carrot = zanahoria
soy sauce = salsa de soya
dark soy sauce = salsa de soya oscura
spring onions = cebolla china
scallions = cebolla china
coriander = cilantro
cilantro = cilantro
coriander leaves = hojas de cilantro
cilantro leaves = hojas de cilantro
ground coriander = cilantro molido
coriander seeds = semillas de cilantro
baking powder = polvo de hornear
bicarbonate of soda = bicarbonato de sodio
lime = lima
lime juice = jugo de lima
lemon = limón
lemons = limones
lemon juice = jugo de limón
lemon zest = ralladura de limón
orange = naranja
orange juice = jugo de naranja
orange zest = ralladura de naranja
caster sugar = azúcar extrafina
golden caster sugar = azúcar rubia extrafina
granulated sugar = azúcar granulada
brown sugar = azúcar morena
dark brown soft sugar = azúcar morena oscura
dark brown sugar = azúcar morena oscura
light brown soft sugar = azúcar morena clara
muscovado sugar = azúcar mascabo
demerara sugar = azúcar demerara
icing sugar = azúcar glas
powdered sugar = azúcar impalpable
palm sugar = azúcar de palma
vanilla sugar = azúcar vainillada
paprika = pimentón
smoked paprika = pimentón ahumado
sweet smoked paprika = pimentón dulce ahumado
smoky paprika = pimentón ahumado
red pepper = pimiento rojo
green pepper = pimiento verde
yellow pepper = pimiento amarillo
red pepper flakes = hojuelas de ají rojo
garlic clove = diente de ajo
garlic cloves = dientes de ajo
minced garlic = ajo picado
garlic powder = ajo en polvo
garlic sauce = salsa de ajo
garlic bulb = cabeza de ajo
thyme = tomillo
fresh thyme = tomillo fresco
ginger = jengibre
ground ginger = jengibre molido
ginger paste = pasta de jengibre
ginger garlic paste = pasta de jengibre y ajo
red chilli = ají rojo
green chilli = ají verde
chilli = ají
chili powder = ají en polvo
chilli powder = ají en polvo
chilli flakes = hojuelas de ají
red chilli flakes = hojuelas de ají rojo
chilli sauce = salsa de ají
sweet chilli sauce = salsa dulce de ají
birds-eye chillies = ají ojo de pájaro
scotch bonnet = ají scotch bonnet
jalapeno = jalapeño
habanero pepper = ají habanero
cayenne pepper = pimienta de cayena
chicken stock = caldo de pollo
chicken stock cube = cubito de caldo de pollo
beef stock = caldo de res
vegetable stock = caldo de verduras
vegetable stock cube = cubito de caldo de verduras
fish stock = caldo de pescado
lamb stock = caldo de cordero
vanilla extract = extracto de vainilla
vanilla = vainilla
vanilla pod = vaina de vainilla
almond extract = extracto de almendra
tomato puree = puré de tomate
tomato purée = puré de tomate
tomato sauce = salsa de tomate
tomato ketchup = kétchup
tomato = tomate
tomatoes = tomates
cherry tomatoes = tomates cherry
plum tomatoes = tomates ciruela
chopped tomatoes = tomates picados
tinned tomatos = tomates en lata
canned tomatoes = tomates en lata
diced tomatoes = tomates en cubos
sun-dried tomatoes = tomates secos
passata = salsa de tomate colada
oil = aceite
sunflower oil = aceite de girasol
sesame seed oil = aceite de ajonjolí
extra virgin olive oil = aceite de oliva extra virgen
rapeseed oil = aceite de colza
canola oil = aceite de canola
peanut oil = aceite de maní
ground nut oil = aceite de maní
coconut oil = aceite de coco
cinnamon = canela
ground cinnamon = canela molida
cinnamon stick = rama de canela
bay leaf = hoja de laurel
bay leaves = hojas de laurel
coconut milk = leche de coco
coconut cream = crema de coco
desiccated coconut = coco rallado
coconut flakes = hojuelas de coco
coconut = coco
red onions = cebollas rojas
red onion = cebolla roja
onions = cebollas
chopped onion = cebolla picada
onion salt = sal de cebolla
mint = menta
dried mint = menta seca
cumin = comino
ground cumin = comino molido
cumin seeds = semillas de comino
fish sauce = salsa de pescado
thai fish sauce = salsa de pescado tailandesa
unsalted butter = mantequilla sin sal
salted butter = mantequilla con sal
melted butter = mantequilla derretida
peanut butter = mantequilla de maní
chilled butter = mantequilla fría
rice = arroz
basmati rice = arroz basmati
jasmine rice = arroz jazmín
sushi rice = arroz para sushi
paella rice = arroz para paella
brown rice = arroz integral
glutinous rice = arroz glutinoso
rice noodles = fideos de arroz
rice vinegar = vinagre de arroz
rice wine = vino de arroz
double cream = crema de leche espesa
heavy cream = crema de leche
single cream = crema de leche ligera
whipping cream = crema para batir
cream = crema de leche
sour cream = crema agria
soured cream = crema agria
clotted cream = crema cuajada
cream cheese = queso crema
creme fraiche = crème fraîche
beef = carne de res
ground beef = carne molida de res
minced beef = carne molida de res
lean minced beef = carne molida de res magra
beef brisket = pecho de res
beef fillet = filete de res
beef tenderloin = lomo fino de res
sirloin steak = bistec de lomo
flank steak = falda de res
oxtail = rabo de res
beef shin = jarrete de res
egg yolks = yemas de huevo
egg yolk = yema de huevo
egg white = clara de huevo
egg whites = claras de huevo
bacon = tocino
streaky bacon = tocino entreverado
sunflower seeds = semillas de girasol
celery = apio
celeriac = apio nabo
celery salt = sal de apio
almonds = almendras
ground almonds = almendras molidas
flaked almonds = almendras en láminas
shallots = chalotas
challots = chalotas
cucumber = pepino
yeast = levadura
instant yeast = levadura instantánea
fast action yeast = levadura de acción rápida
allspice = pimienta de Jamaica
ground allspice = pimienta de Jamaica molida
bread = pan
white bread = pan blanco
rye bread = pan de centeno
crusty bread = pan crujiente
pita bread = pan pita
naan bread = pan naan
baguette = baguette
ciabatta = ciabatta
tortillas = tortillas
flour tortilla = tortilla de harina
corn tortillas = tortillas de maíz
chorizo = chorizo
honey = miel
clear honey = miel
chicken thighs = muslos de pollo
chicken legs = piernas de pollo
chicken wings = alitas de pollo
chicken drumsticks = muslitos de pollo
chicken liver = hígado de pollo
chicken breast = pechuga de pollo
chicken breasts = pechugas de pollo
chicken = pollo
breadcrumbs = pan rallado
nutmeg = nuez moscada
ground nutmeg = nuez moscada molida
mushrooms = champiñones
shiitake mushrooms = hongos shiitake
oyster mushrooms = hongos ostra
chestnut mushroom = champiñón castaño
wild mushrooms = hongos silvestres
greek yogurt = yogur griego
yogurt = yogur
yoghurt = yogur
natural yoghurt = yogur natural
mayonnaise = mayonesa
cardamom = cardamomo
ground cardomom = cardamomo molido
cabbage = repollo
white cabbage = repollo blanco
red cabbage = repollo morado
savoy cabbage = repollo de Saboya
napa cabbage = repollo napa
leek = puerro
mustard = mostaza
dijon mustard = mostaza de Dijon
english mustard = mostaza inglesa
wholegrain mustard = mostaza en grano
mustard powder = mostaza en polvo
mustard seeds = semillas de mostaza
basil = albahaca
basil leaves = hojas de albahaca
fresh basil = albahaca fresca
dill = eneldo
dried dill = eneldo seco
raisins = pasas
sultanas = pasas sultanas
currants = pasas de Corinto
rosemary = romero
turmeric = cúrcuma
ground turmeric = cúrcuma molida
turmeric powder = cúrcuma en polvo
white wine = vino blanco
dry white wine = vino blanco seco
red wine = vino tinto
red wine vinegar = vinagre de vino tinto
white wine vinegar = vinagre de vino blanco
dry sherry = jerez seco
sherry = jerez
sherry vinegar = vinagre de jerez
cooking wine = vino de cocina
parmesan = queso parmesano
parmesan cheese = queso parmesano
parmigiano-reggiano = parmigiano reggiano
kosher salt = sal kosher
sea salt = sal marina
coarse salt = sal gruesa
lamb = cordero
lamb mince = carne molida de cordero
lamb leg = pierna de cordero
lamb shoulder = paleta de cordero
lamb shanks = jarretes de cordero
lamb loin chops = chuletas de cordero
lamb kidney = riñón de cordero
cloves = clavos de olor
clove = clavo de olor
ground clove = clavo de olor molido
pork = cerdo
pork chops = chuletas de cerdo
pork belly slices = panceta de cerdo en lonjas
pork shoulder = paleta de cerdo
pork tenderloin = lomo de cerdo
pork back ribs = costillas de cerdo
ground pork = carne molida de cerdo
minced pork = carne molida de cerdo
chives = cebollín
chickpeas = garbanzos
prawns = langostinos
king prawns = langostinos
raw king prawns = langostinos crudos
tiger prawns = langostinos tigre
raw tiger prawns = langostinos tigre crudos
shrimp = camarones
mozzarella = mozzarella
mozzarella balls = bolitas de mozzarella
green beans = vainitas
runner beans = judías verdes
broad beans = habas
butter beans = pallares
kidney beans = frijoles rojos
black beans = frijoles negros
cannellini beans = frijoles cannellini
pinto beans = frijoles pintos
lima beans = pallares
borlotti beans = frijoles borlotti
haricot beans = frijoles blancos
black eyed peas = frijoles de ojo negro
dried white beans = frijoles blancos secos
baked beans = frijoles en salsa de tomate
refried beans = frijoles refritos
sesame seed = semillas de ajonjolí
sesame seeds = semillas de ajonjolí
lettuce = lechuga
iceberg lettuce = lechuga iceberg
little gem lettuce = lechuga little gem
worcestershire sauce = salsa Worcestershire
spinach = espinaca
feta = queso feta
cubed feta cheese = queso feta en cubos
aubergine = berenjena
egg plants = berenjenas
saffron = azafrán
oregano = orégano
dried oregano = orégano seco
peanuts = maní
roasted peanut = maní tostado
unsalted peanuts = maní sin sal
walnuts = nueces
ground walnuts = nueces molidas
pecan nuts = nueces pecanas
cashew nuts = castañas de cajú
cashews = castañas de cajú
pistachio = pistacho
pine nuts = piñones
hazlenuts = avellanas
shelled hazelnuts = avellanas peladas
chestnuts = castañas
curry powder = curry en polvo
dark chocolate = chocolate amargo
milk chocolate = chocolate con leche
plain chocolate = chocolate amargo
white chocolate = chocolate blanco
chocolate chips = chispas de chocolate
cocoa powder = cacao en polvo
cocoa = cacao
oyster sauce = salsa de ostras
condensed milk = leche condensada
sweetened condensed milk = leche condensada
evaporated milk = leche evaporada
whole milk = leche entera
semi-skimmed milk = leche semidescremada
soya milk = leche de soya
almond milk = leche de almendras
buttermilk = suero de leche
puff pastry = masa de hojaldre
shortcrust pastry = masa quebrada
filo pastry = masa filo
phyllo dough = masa filo
vinegar = vinagre
white vinegar = vinagre blanco
apple cider vinegar = vinagre de manzana
cider vinegar = vinagre de manzana
balsamic vinegar = vinagre balsámico
malt vinegar = vinagre de malta
peas = arvejas
frozen peas = arvejas congeladas
petit pois = arvejas
sugar snap peas = arvejas dulces
snow peas = arvejas chinas
courgettes = calabacines
zucchini = zapallito italiano
avocado = palta
sausages = salchichas
hotsauce = salsa picante
tabasco sauce = salsa Tabasco
tobasco sauce = salsa Tabasco
sriracha = salsa sriracha
garam masala = garam masala
cheddar cheese = queso cheddar
mature cheddar = queso cheddar maduro
cheese = queso
swiss cheese = queso suizo
gouda cheese = queso gouda
goats cheese = queso de cabra
gruyère = queso gruyère
gruyere = queso gruyère
gruyere cheese = queso gruyère
ricotta = ricota
mascarpone = mascarpone
brie = queso brie
manchego = queso manchego
pecorino = queso pecorino
stilton cheese = queso stilton
queso fresco = queso fresco
cottage cheese = requesón
paneer = paneer
halloumi = queso halloumi
tofu = tofu
silken tofu = tofu sedoso
marinated tofu = tofu marinado
thai red curry paste = pasta de curry rojo tailandés
thai green curry paste = pasta de curry verde tailandés
red curry paste = pasta de curry rojo
massaman curry paste = pasta de curry massaman
panang curry paste = pasta de curry panang
madras paste = pasta de curry madrás
tamarind paste = pasta de tamarindo
tamarind pulp = pulpa de tamarindo
tamarind ball = bola de tamarindo
harissa spice = harissa
ras el hanout = ras el hanout
sumac = zumaque
tahini = tahini
tahini paste = pasta de tahini
bean sprouts = brotes de soya
mung bean sprouts = brotes de frijol mungo
dulce de leche = dulce de leche
black olives = aceitunas negras
green olives = aceitunas verdes
pitted black olives = aceitunas negras sin pepa
capers = alcaparras
peanut cookies = galletas de maní
beetroot = betarraga
beets = betarragas
cooked beetroot = betarraga cocida
pumpkin = zapallo
pumpkin puree = puré de zapallo
squash = zapallo
butternut squash = zapallo butternut
zapallo squash = zapallo
squid = calamar
baby squid = calamares pequeños
ham = jamón
smoked ham = jamón ahumado
deli ham = jamón
parma ham = jamón de Parma
serrano ham = jamón serrano
prosciutto = prosciutto
jamón ibérico = jamón ibérico
broccoli = brócoli
purple sprouting broccoli = brócoli morado
chinese broccoli = brócoli chino
warm water = agua tibia
boiling water = agua hirviendo
cold water = agua fría
ice cubes = cubos de hielo
rocket = rúcula
orange blossom water = agua de azahar
rose water = agua de rosas
banana = plátano
bananas = plátanos
plantain = plátano de freír
raspberries = frambuesas
blackberries = moras
blueberries = arándanos
strawberries = fresas
redcurrants = grosellas rojas
cranberry = arándano rojo
dried cranberries = arándanos rojos secos
cherry = cereza
dried cherries = cerezas secas
glace cherry = cereza confitada
peaches = duraznos
apricot = damasco
dried apricots = orejones
figs = higos
pears = peras
apples = manzanas
cooking apples = manzanas para cocinar
bramley apples = manzanas para cocinar
braeburn apples = manzanas Braeburn
pomegranate = granada
pomegranate molasses = melaza de granada
mango = mango
pineapple chunks = trozos de piña
pineapple juice = jugo de piña
grapefruit = toronja
passion fruit pulp = pulpa de maracuyá
rhubarb = ruibarbo
prunes = ciruelas pasas
stoned dates = dátiles sin pepa
pitted dates = dátiles sin pepa
medjool dates = dátiles medjool
dried fruit = fruta seca
fruit mix = mezcla de frutas secas
mixed peel = cáscaras confitadas
candied peel = cáscaras confitadas
mincemeat = mincemeat
marzipan = mazapán
jam = mermelada
raspberry jam = mermelada de frambuesa
apricot jam = mermelada de damasco
plum jam = mermelada de ciruela
blackcurrant jam = mermelada de grosella negra
caramel = caramelo
caramel sauce = salsa de caramelo
golden syrup = sirope dorado
maple syrup = jarabe de arce
molasses = melaza
black treacle = melaza negra
sugar syrup = almíbar
dutch stroop = sirope holandés
red wine jelly = jalea de vino tinto
brandy = brandy
dark rum = ron oscuro
grand marnier = Grand Marnier
beer = cerveza
dark beer = cerveza negra
stout = cerveza negra
cider = sidra
sake = sake
mirin = mirin
shaoxing wine = vino shaoxing
marjoram = mejorana
sage = salvia
tarragon leaves = hojas de estragón
dried sorrel = acedera seca
summer savoury = ajedrea
lemongrass = hierba luisa
lemongrass stalks = tallos de hierba luisa
galangal = galanga
galangal paste = pasta de galanga
star anise = anís estrellado
fennel = hinojo
fennel bulb = bulbo de hinojo
fennel seeds = semillas de hinojo
caraway seed = semillas de alcaravea
poppy seeds = semillas de amapola
juniper berries = bayas de enebro
fenugreek = fenogreco
sichuan pepper = pimienta de Sichuan
szechuan peppercorns = pimienta de Sichuan
peppercorns = granos de pimienta
whole black peppercorns = granos de pimienta negra
five spice powder = polvo de cinco especias
chinese five spice powder = polvo de cinco especias
mixed spice = especias mixtas
italian seasoning = condimento italiano
all-purpose seasoning = sazonador todo uso
seasoning = condimento
cajun = condimento cajún
jerk = condimento jerk
fajita seasoning = condimento para fajitas
anchovy fillet = filete de anchoa
sardines = sardinas
pilchards = sardinas
herring = arenque
mackerel = caballa
tuna = atún
salmon = salmón
smoked salmon = salmón ahumado
hot smoked flaked salmon = salmón ahumado desmenuzado
smoked haddock = eglefino ahumado
haddock = eglefino
cod = bacalao
salt cod = bacalao salado
codfish bulljaw = bacalao
hake = merluza
monkfish = rape
trout = trucha
rainbow trout = trucha arcoíris
red snapper = pargo rojo
barramundi = barramundi
sea bass fillets = filetes de lubina
white fish = pescado blanco
white fish fillets = filetes de pescado blanco
fish fillet = filete de pescado
mussels = mejillones
clams = almejas
oysters = ostras
lobster = langosta
conchs = caracoles de mar
crab meay = carne de cangrejo
dried shrimp = camarones secos
shrimp paste = pasta de camarón
frozen seafood mix = mezcla de mariscos congelados
seafood stock = caldo de mariscos
frogs legs = ancas de rana
turkey = pavo
turkey mince = carne molida de pavo
duck legs = piernas de pato
goat meat = carne de cabra
veal = ternera
corned beef = carne en conserva
black pudding = morcilla
morcilla = morcilla
suet = sebo
lard = manteca de cerdo
shortening = manteca vegetal
vegetable shortening = manteca vegetal
goose fat = grasa de ganso
ghee = ghee
vegan butter = mantequilla vegana
noodles = fideos
egg noodles = fideos de huevo
udon noodles = fideos udon
vermicelli rice noodles = fideos de arroz finos
rice stick noodles = fideos de arroz planos
flat rice noodles = fideos de arroz planos
rice vermicelli = fideos de arroz finos
spaghetti = espagueti
linguine pasta = linguini
fettuccine = fetuccini
macaroni = macarrones
rigatoni = rigatoni
penne rigate = penne rigate
farfalle = farfalle
lasagne sheets = láminas de lasaña
vermicelli pasta = fideos cabello de ángel
couscous = cuscús
semolina = sémola
bulgur wheat = trigo bulgur
freekeh = freekeh
quinoa = quinua
oats = avena
porridge oats = avena
rolled oats = hojuelas de avena
ground oats = avena molida
oatmeal = avena
buckwheat = trigo sarraceno
tapioca = tapioca
starch = almidón
potato starch = fécula de papa
lentils = lentejas
brown lentils = lentejas marrones
french lentils = lentejas francesas
toor dal = lentejas toor dal
yellow split peas = arvejas partidas amarillas
soya bean = soya
hummus = hummus
falafel = falafel
olives = aceitunas
pickle juice = jugo de pepinillos
dill pickles = pepinillos al eneldo
sauerkraut = chucrut
kale = col rizada
bok choi = bok choy
pak choi = pak choi
chinese leaf = repollo chino
chinese cabbage = repollo chino
chinese long beans = vainitas chinas
spring greens = hojas verdes
asparagus = espárragos
white asparagus = espárragos blancos
artichoke = alcachofa
jerusalem artichokes = alcachofas de Jerusalén
swede = nabo sueco
turnips = nabos
parsnips = chirivías
radish = rabanito
daikon radish = rábano daikon
horseradish = rábano picante
sweet potatoes = camotes
new potatoes = papas nuevas
small potatoes = papas pequeñas
baby new potatoes = papas nuevas pequeñas
red potatoes = papas rojas
russet potato = papa russet
floury potatoes = papas harinosas
jersey royal potatoes = papas Jersey Royal
charlotte potatoes = papas Charlotte
fries = papas fritas
cassava = yuca
raw yucca = yuca cruda
yuca = yuca
taro = taro
white yam = ñame blanco
yautia = yautía
corn on the cob = choclo
sweetcorn = choclo
creamed corn = crema de choclo
dried white corn = maíz blanco seco
water chestnut = castaña de agua
bamboo shoot = brotes de bambú
palm hearts = palmitos
wood ear mushrooms = hongos orejas de madera
banana leaves = hojas de plátano
vine leaves = hojas de parra
pickled grape leaves = hojas de parra en conserva
rice paper sheets = láminas de papel de arroz
wonton skin = masa para wantán
egg roll wrappers = masa para rollitos
hard taco shells = tortillas duras para tacos
buns = panes
bread rolls = panecillos
english muffins = muffins ingleses
sesame seed burger buns = panes de hamburguesa con ajonjolí
pretzels = pretzels
digestive biscuits = galletas digestivas
oreo cream biscuits = galletas Oreo
maria cookies = galletas María
meringue nests = nidos de merengue
christmas pudding = pudín navideño
custard = natilla
custard powder = polvo para natilla
ice cream = helado
marshmallows = malvaviscos
miniature marshmallows = malvaviscos pequeños
rice krispies = cereal de arroz inflado
toffee popcorn = canchita con caramelo
peanut brittle = turrón de maní
turkish delight = delicias turcas
cream of tartar = crémor tártaro
gelatine leafs = hojas de gelatina
unflavoured gelatin = gelatina sin sabor
pink food colouring = colorante rosado
yellow food colouring = colorante amarillo
egg wash = huevo batido
free-range egg, beaten = huevo batido
free-range eggs, beaten = huevos batidos
beef gravy = salsa de carne
hoisin sauce = salsa hoisin
plum sauce = salsa de ciruela
duck sauce = salsa de pato
barbeque sauce = salsa barbacoa
enchilada sauce = salsa enchilada
chimichurri sauce = salsa chimichurri
pico de gallo sauce = salsa pico de gallo
green salsa = salsa verde
salsa = salsa
gochujang = gochujang
doubanjiang = pasta de frijol picante
chilli bean paste = pasta de frijol con ají
red pepper paste = pasta de pimiento rojo
sweet peppadew peppers = pimientos peppadew
roasted pepper = pimiento asado
romano pepper = pimiento romano
padron peppers = pimientos de Padrón
banana pepper = ají banana
ancho chillies = ají ancho
dried chillies = ajíes secos
dried red chillies = ajíes rojos secos
pul biber = hojuelas de ají turco
truffle oil = aceite de trufa
horseradish sauce = salsa de rábano picante
vinaigrette dressing = vinagreta
aioli = alioli
smoky aïoli = alioli ahumado
stir-fry vegetables = verduras para saltear
mixed peppers = pimientos mixtos
roasted vegetables = verduras asadas
raw vegetables = verduras crudas
vegetables = verduras
`;

/** inglés (minúsculas) -> español */
const ES_BY_EN = new Map();
/** español sin acentos -> lista de ingredientes en inglés */
const EN_BY_ES = new Map();

for (const line of RAW.split('\n')) {
  const i = line.indexOf('=');
  if (i < 1) continue;
  const en = line.slice(0, i).trim().toLowerCase();
  const es = line.slice(i + 1).trim();
  if (!en || !es) continue;
  ES_BY_EN.set(en, es);
  const key = normalize(es);
  if (!EN_BY_ES.has(key)) EN_BY_ES.set(key, [en]);
}

// Palabras que escribe la gente (incluye regionalismos) y que apuntan a uno o varios nombres de TheMealDB.
const SYNONYMS = {
  carne: ['beef'], res: ['beef'], vaca: ['beef'], 'carne de vaca': ['beef'], bistec: ['beef', 'sirloin steak'], lomo: ['beef', 'pork'],
  puerco: ['pork'], chancho: ['pork'], cochino: ['pork'], 'carne de cerdo': ['pork'], costillas: ['pork back ribs'],
  pescado: ['white fish', 'cod', 'haddock', 'salmon', 'tuna'], bonito: ['tuna'], atun: ['tuna'],
  camaron: ['prawns', 'shrimp'], camarones: ['prawns', 'shrimp'], gambas: ['prawns'], langostino: ['prawns'],
  mariscos: ['prawns', 'mussels', 'squid', 'clams'], choro: ['mussels'], choros: ['mussels'], 'mejillones': ['mussels'],
  huevo: ['eggs', 'egg'], huevos: ['eggs', 'egg'], yema: ['egg yolks'], clara: ['egg white'],
  tomate: ['tomatoes', 'tomato'], jitomate: ['tomatoes'], papa: ['potatoes'], papas: ['potatoes'], patata: ['potatoes'], patatas: ['potatoes'],
  choclo: ['sweetcorn', 'corn on the cob'], maiz: ['sweetcorn', 'cornmeal'], elote: ['sweetcorn'], mazorca: ['corn on the cob'],
  palta: ['avocado'], aguacate: ['avocado'], camote: ['sweet potatoes'], batata: ['sweet potatoes'], boniato: ['sweet potatoes'],
  zapallo: ['pumpkin', 'squash', 'butternut squash'], calabaza: ['pumpkin', 'squash'], zapallito: ['courgettes'], calabacin: ['courgettes'],
  aji: ['chilli', 'red chilli', 'green chilli', 'aji amarillo', 'aji panca', 'aji limo'], chile: ['chilli', 'red chilli', 'green chilli'], rocoto: ['rocoto', 'red chilli'],
  'aji amarillo': ['aji amarillo'], 'pasta de aji amarillo': ['aji amarillo'], 'aji panca': ['aji panca'], 'pasta de aji panca': ['aji panca'], 'aji limo': ['aji limo'],
  'maiz morado': ['purple corn'], pisco: ['pisco'], membrillo: ['quince'], chuno: ['cornstarch'], chancaca: ['palm sugar'], 'queso fresco': ['queso fresco'], pimiento: ['red pepper', 'green pepper', 'yellow pepper'],
  limon: ['lemon', 'lime'], limones: ['lemon', 'lime'], lima: ['lime'], 'limon verde': ['lime'],
  cebolla: ['onion'], 'cebolla china': ['spring onions'], 'cebolla verde': ['spring onions'], cebollita: ['spring onions'], cebollin: ['chives'],
  betarraga: ['beetroot'], remolacha: ['beetroot'], vainita: ['green beans'], vainitas: ['green beans'], ejote: ['green beans'], ejotes: ['green beans'], 'judias verdes': ['green beans'],
  arveja: ['peas'], arvejas: ['peas'], guisantes: ['peas'], chicharos: ['peas'],
  frejol: ['kidney beans', 'black beans'], frejoles: ['kidney beans', 'black beans'], frijol: ['kidney beans', 'black beans'], frijoles: ['kidney beans', 'black beans'], porotos: ['kidney beans', 'black beans'],
  pallar: ['butter beans', 'lima beans'], pallares: ['butter beans', 'lima beans'], habas: ['broad beans'], lenteja: ['lentils'], lentejas: ['lentils'], garbanzo: ['chickpeas'], garbanzos: ['chickpeas'],
  mani: ['peanuts'], cacahuate: ['peanuts'], cacahuete: ['peanuts'], nuez: ['walnuts'], nueces: ['walnuts'], almendra: ['almonds'], almendras: ['almonds'], pasas: ['raisins'],
  platano: ['banana', 'plantain'], banano: ['banana'], fresa: ['strawberries'], fresas: ['strawberries'], frutilla: ['strawberries'], durazno: ['peaches'], melocoton: ['peaches'],
  mantequilla: ['butter'], manteca: ['butter', 'lard'], nata: ['double cream', 'heavy cream'], crema: ['double cream', 'heavy cream', 'cream'], 'crema de leche': ['double cream', 'heavy cream'],
  leche: ['milk'], yogur: ['yogurt', 'greek yogurt', 'natural yoghurt'], yogurt: ['yogurt', 'greek yogurt', 'natural yoghurt'], queso: ['cheese', 'cheddar cheese', 'mozzarella', 'parmesan'],
  harina: ['flour', 'plain flour', 'self-raising flour'], 'harina de trigo': ['flour', 'plain flour'], azucar: ['sugar', 'caster sugar'], 'azucar morena': ['brown sugar'], 'azucar rubia': ['brown sugar'], chancaca: ['brown sugar', 'palm sugar'],
  maicena: ['cornstarch', 'corn flour'], 'polvo de hornear': ['baking powder'], 'royal': ['baking powder'], bicarbonato: ['bicarbonate of soda'], levadura: ['yeast'], vainilla: ['vanilla', 'vanilla extract'],
  aceite: ['oil', 'vegetable oil', 'olive oil', 'sunflower oil'], 'aceite de oliva': ['olive oil', 'extra virgin olive oil'], vinagre: ['vinegar'],
  sal: ['salt'], pimienta: ['black pepper', 'pepper'], 'pimienta negra': ['black pepper'], comino: ['cumin', 'ground cumin'], 'pimenton': ['paprika'], oregano: ['oregano', 'dried oregano'],
  perejil: ['parsley'], cilantro: ['coriander', 'cilantro'], culantro: ['coriander', 'cilantro'], albahaca: ['basil'], laurel: ['bay leaf', 'bay leaves'], huacatay: ['mint'], hierbabuena: ['mint'], menta: ['mint'],
  jengibre: ['ginger'], kion: ['ginger'], canela: ['cinnamon', 'ground cinnamon', 'cinnamon stick'], clavo: ['cloves'], clavos: ['cloves'], 'nuez moscada': ['nutmeg'], curry: ['curry powder'],
  ajo: ['garlic', 'garlic clove'], 'dientes de ajo': ['garlic clove'], 'diente de ajo': ['garlic clove'],
  sillao: ['soy sauce'], 'salsa de soya': ['soy sauce'], 'salsa de soja': ['soy sauce'], soja: ['soy sauce'],
  fideos: ['spaghetti', 'noodles'], tallarines: ['spaghetti', 'noodles'], tallarin: ['spaghetti', 'noodles'], espagueti: ['spaghetti'], espaguetis: ['spaghetti'], spaghetti: ['spaghetti'],
  pasta: ['spaghetti', 'macaroni', 'penne rigate', 'fettuccine', 'linguine pasta', 'rigatoni', 'farfalle'], macarrones: ['macaroni'], lasana: ['lasagne sheets'], lasagna: ['lasagne sheets'],
  arroz: ['rice', 'basmati rice', 'jasmine rice'], pan: ['bread'], 'pan rallado': ['breadcrumbs'], tostadas: ['bread'], tortilla: ['tortillas', 'flour tortilla', 'corn tortillas'], tortillas: ['tortillas', 'flour tortilla', 'corn tortillas'],
  champinon: ['mushrooms'], champinones: ['mushrooms'], hongos: ['mushrooms'], setas: ['mushrooms'],
  lechuga: ['lettuce'], espinaca: ['spinach'], espinacas: ['spinach'], brocoli: ['broccoli'], coliflor: ['cauliflower'], repollo: ['cabbage'], col: ['cabbage'], apio: ['celery'], pepino: ['cucumber'], berenjena: ['aubergine'], zanahoria: ['carrots'], zanahorias: ['carrots'],
  salchicha: ['sausages'], salchichas: ['sausages'], chorizo: ['chorizo'], tocino: ['bacon'], panceta: ['bacon', 'pork belly slices'], jamon: ['ham'],
  pavo: ['turkey'], pato: ['duck legs'], cordero: ['lamb'], ternera: ['veal', 'beef'], 'carne molida': ['minced beef', 'ground beef', 'ground pork'], molida: ['minced beef', 'ground beef'],
  pollo: ['chicken'], 'pechuga de pollo': ['chicken breast', 'chicken breasts'], pechuga: ['chicken breast', 'chicken breasts'], 'muslo de pollo': ['chicken thighs'], muslo: ['chicken thighs'], alitas: ['chicken wings'],
  miel: ['honey'], chocolate: ['dark chocolate', 'milk chocolate', 'plain chocolate'], cacao: ['cocoa powder', 'cocoa'], coco: ['coconut', 'coconut milk'], 'leche de coco': ['coconut milk'],
  manzana: ['apples'], manzanas: ['apples'], naranja: ['orange'], pera: ['pears'], mango: ['mango'], pina: ['pineapple chunks'], uva: ['grapes'], uvas: ['grapes'],
  'salsa de tomate': ['tomato sauce', 'tomato puree'], ketchup: ['tomato ketchup'], mostaza: ['mustard', 'dijon mustard'], mayonesa: ['mayonnaise'],
  vino: ['white wine', 'red wine'], 'vino tinto': ['red wine'], 'vino blanco': ['white wine'], cerveza: ['beer'], agua: ['water'],
  tofu: ['tofu'], quinua: ['quinoa'], quinoa: ['quinoa'], avena: ['oats', 'porridge oats'], cuscus: ['couscous'],
};

for (const [es, en] of Object.entries(SYNONYMS)) EN_BY_ES.set(normalize(es), en);

// Productos de despensa que se asumen disponibles cuando el usuario activa "tengo lo básico".
const STAPLES = new Set([
  'salt', 'sea salt', 'kosher salt', 'coarse salt', 'pepper', 'black pepper', 'ground black pepper', 'water',
  'warm water', 'cold water', 'boiling water', 'ice cubes', 'oil', 'vegetable oil', 'olive oil',
  'extra virgin olive oil', 'sunflower oil', 'canola oil', 'rapeseed oil',
].map(stem));

export const isStaple = (name) => STAPLES.has(stem(name));

/** Nombre en español de un ingrediente de TheMealDB, o null si no está en el diccionario. */
export function ingredientEs(nameEn) {
  return ES_BY_EN.get(String(nameEn ?? '').trim().toLowerCase()) ?? null;
}

/** Agrega un ingrediente propio (por ejemplo, de las recetas peruanas) si el diccionario aún no lo tiene. */
export function registerIngredient(en, es) {
  const key = String(en).trim().toLowerCase();
  if (!key || !es) return;
  if (!ES_BY_EN.has(key)) ES_BY_EN.set(key, es);
  const spanish = normalize(es);
  if (!EN_BY_ES.has(spanish)) EN_BY_ES.set(spanish, [key]);
}

/** Lo que escribió el usuario ("Tomates") -> nombres de ingrediente en inglés, o null si no lo conocemos. */
export function spanishToEnglish(term) {
  const n = normalize(term);
  if (!n) return null;
  const candidates = [n, n.replace(/(es|s)$/, ''), n.replace(/s$/, ''), n.replace(/es$/, '')];
  for (const c of candidates) {
    const hit = EN_BY_ES.get(c);
    if (hit) return hit;
  }
  return null;
}

/** Sugerencias para el autocompletado: ingredientes en español que existen en el diccionario. */
export function allSpanishNames() {
  return [...ES_BY_EN.entries()].map(([en, es]) => ({ en, es }));
}

// Palabras de nombres de platillos que escribe la gente al buscar por nombre.
export const DISH_WORDS = {
  lasana: ['lasagne', 'lasagna'], pastel: ['pie', 'cake'], tarta: ['tart', 'pie', 'cake'], torta: ['cake'], pay: ['pie'],
  sopa: ['soup'], caldo: ['soup', 'broth', 'stew'], crema: ['soup', 'cream'], estofado: ['stew'], guiso: ['stew'], ensalada: ['salad'],
  hamburguesa: ['burger'], pizza: ['pizza'], tacos: ['taco'], taco: ['taco'], burrito: ['burrito'], empanada: ['empanada', 'pasty'], empanadas: ['empanada', 'pasty'],
  galletas: ['cookie', 'biscuit'], galleta: ['cookie', 'biscuit'], pan: ['bread', 'loaf'], panqueques: ['pancake'], panqueque: ['pancake'], hotcakes: ['pancake'],
  tortilla: ['tortilla', 'omelette'], omelette: ['omelette'], postre: ['pudding', 'cake', 'tart'], helado: ['ice cream'], flan: ['flan', 'custard'], budin: ['pudding'],
  curry: ['curry'], arroz: ['rice', 'risotto', 'paella'], paella: ['paella'], risotto: ['risotto'], fideos: ['noodle', 'pasta'], tallarines: ['noodle', 'pasta', 'spaghetti'],
  pollo: ['chicken'], carne: ['beef'], res: ['beef'], cerdo: ['pork'], cordero: ['lamb'], pescado: ['fish', 'cod', 'salmon'], mariscos: ['seafood', 'prawn'], camarones: ['prawn', 'shrimp'],
  asado: ['roast', 'grilled'], frito: ['fried', 'fry'], horneado: ['baked', 'bake'], guisado: ['stew', 'braised'], relleno: ['stuffed'], albondigas: ['meatball'],
  croquetas: ['croquette'], bocadillo: ['sandwich'], sandwich: ['sandwich'], brocheta: ['skewer', 'kebab'], kebab: ['kebab'], chocolate: ['chocolate'], manzana: ['apple'], limon: ['lemon'],
};
