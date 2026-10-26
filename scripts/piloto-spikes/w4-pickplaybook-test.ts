import { pickPlaybook } from '../../src/modules/planner/v3/playbooks';
const cases: Array<[string, string, string]> = [
  ['Joyería', 'Aros de resina y acero, precios bajos', 'joyeria'],
  ['Accesorios', 'Collares y pulseras de plata 925', 'joyeria'],
  ['Moda', 'Ropa, vestidos y accesorios de temporada', 'moda'],
  ['Belleza', 'Cremas, sérum y cuidado de la piel con aromas suaves', 'belleza'],
  ['Pastelería', 'Tortas y galletas por encargo', 'comida'],
  ['Decoración', 'Velas aromáticas y cerámica hecha a mano', 'hogar'],
  ['Joyas', 'Anillos y aros bañados en oro', 'joyeria'],
  ['Bisutería', 'Argollas, dijes y cadenas', 'joyeria'],
  ['Moda', 'Carteras, bolsos y zapatos', 'moda'],
  ['Servicios', 'Asesoría de imagen y fotografía', 'servicios'],
  ['Taller', 'Reparación de bicicletas', 'generico'],
  ['Tienda', 'Ropa y joyas de plata', 'joyeria'],
];
let bad = 0;
for (const [cat, desc, want] of cases) {
  const got = pickPlaybook(cat, desc).id;
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'MAL'} [${cat} | ${desc}] -> ${got} (esperado ${want})`);
}
console.log(bad ? `FALLAN ${bad}` : 'TODO OK');
process.exit(bad ? 1 : 0);
