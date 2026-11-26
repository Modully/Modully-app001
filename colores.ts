/**
 * Catálogo de colores de tablero (Duratex, catálogo digital 2026) más el Blanco de estructura.
 * El tono (hex) es aproximado: sirve para ver el diseño con colores parecidos; el color real se ve en el render aprobado.
 */

export interface ColorCatalogo { nombre: string; hex: string; grupo: string }

export const CATALOGO: ColorCatalogo[] = [
  { nombre: 'Blanco', hex: '#f4f4f1', grupo: 'Estructura' },
  // tendencias
  { nombre: 'Barrica', hex: '#6b4a2f', grupo: 'Tendencias' }, { nombre: 'Karamell', hex: '#d1a064', grupo: 'Tendencias' },
  { nombre: 'Bosco', hex: '#7a6248', grupo: 'Tendencias' }, { nombre: 'Sagano', hex: '#b79a78', grupo: 'Tendencias' },
  { nombre: 'Oasis', hex: '#e6cdb2', grupo: 'Tendencias' }, { nombre: 'Terranta', hex: '#a0714f', grupo: 'Tendencias' },
  { nombre: 'Riviera', hex: '#c8b59a', grupo: 'Tendencias' }, { nombre: 'Traviata', hex: '#8d7861', grupo: 'Tendencias' },
  { nombre: 'Fronda', hex: '#9c8a6e', grupo: 'Tendencias' }, { nombre: 'Sensa', hex: '#ece2d4', grupo: 'Tendencias' },
  // atemporales
  { nombre: 'Arena', hex: '#d9c7ae', grupo: 'Atemporales' }, { nombre: 'Kallio', hex: '#e6e4e0', grupo: 'Atemporales' },
  { nombre: 'Capuccino', hex: '#a98c6f', grupo: 'Atemporales' }, { nombre: 'Mitte', hex: '#6f6257', grupo: 'Atemporales' },
  { nombre: 'Chantillí', hex: '#c2b5a5', grupo: 'Atemporales' }, { nombre: 'Nuez', hex: '#6e4b33', grupo: 'Atemporales' },
  { nombre: 'Glacial', hex: '#e3d8cc', grupo: 'Atemporales' }, { nombre: 'Söder', hex: '#cbb89e', grupo: 'Atemporales' },
  { nombre: 'Grécia', hex: '#b9ad9f', grupo: 'Atemporales' }, { nombre: 'Vienés', hex: '#b08a5e', grupo: 'Atemporales' },
  { nombre: 'Humo', hex: '#7d7872', grupo: 'Atemporales' },
  // piedras
  { nombre: 'Risco', hex: '#4d4e52', grupo: 'Piedras' }, { nombre: 'Sambe', hex: '#8a8782', grupo: 'Piedras' },
  { nombre: 'Mármoro', hex: '#d8cfd0', grupo: 'Piedras' }, { nombre: 'Lunar', hex: '#9a9a9c', grupo: 'Piedras' },
  // maderas rústicas
  { nombre: 'Amaretto', hex: '#8a5a3c', grupo: 'Rústicas' }, { nombre: 'Mácula', hex: '#7b6a5a', grupo: 'Rústicas' },
  { nombre: 'Austral', hex: '#5a4636', grupo: 'Rústicas' }, { nombre: 'Tabacco Chic', hex: '#5c4433', grupo: 'Rústicas' },
  { nombre: 'Cala', hex: '#d6c3a5', grupo: 'Rústicas' }, { nombre: 'Koa', hex: '#6a4a36', grupo: 'Rústicas' },
  { nombre: 'Terranta', hex: '#a0714f', grupo: 'Rústicas' },
  // metalizados y textiles
  { nombre: 'Auro', hex: '#b89b5e', grupo: 'Metalizados' }, { nombre: 'Bohemm', hex: '#6e5b4c', grupo: 'Metalizados' },
  { nombre: 'Lana', hex: '#ecebe8', grupo: 'Textiles' }, { nombre: 'Yutex', hex: '#c0b08f', grupo: 'Textiles' },
  // sólidos
  { nombre: 'Verde Selva', hex: '#3a4442', grupo: 'Sólidos' }, { nombre: 'Perla', hex: '#ebe7d9', grupo: 'Sólidos' },
  { nombre: 'Ámbar', hex: '#b8804a', grupo: 'Sólidos' }, { nombre: 'Verde Olivo', hex: '#6f7355', grupo: 'Sólidos' },
  { nombre: 'Cinza', hex: '#8c8f93', grupo: 'Sólidos' }, { nombre: 'Cobalto', hex: '#2f4a6b', grupo: 'Sólidos' }, { nombre: 'Graffo', hex: '#3c3d3f', grupo: 'Sólidos' },
  { nombre: 'Viena', hex: '#c9bfae', grupo: 'Sólidos' }, { nombre: 'Negro', hex: '#1f1f21', grupo: 'Sólidos' },
  { nombre: 'Nívola', hex: '#f1f0ec', grupo: 'Sólidos' },
].filter((c, i, l) => l.findIndex(x => x.nombre === c.nombre) === i);

/** Colores del catálogo con veta de madera: las tendencias, las rústicas y algunos atemporales. El modelo 3D les dibuja la veta. */
const NOMBRES_CON_VETA = new Set(['Nuez', 'Capuccino', 'Vienés', 'Mitte', 'Söder']);
export const tieneVeta = (c: ColorCatalogo): boolean => c.grupo === 'Tendencias' || c.grupo === 'Rústicas' || NOMBRES_CON_VETA.has(c.nombre);
const HEX_CON_VETA = new Set(CATALOGO.filter(tieneVeta).map(c => c.hex.toLowerCase()));
/** El tono (hex) pertenece a un color de madera con veta */
export const hexConVeta = (hex?: string): boolean => !!hex && HEX_CON_VETA.has(hex.toLowerCase());

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Color del catálogo por nombre (sin importar tildes ni mayúsculas; acepta nombres parciales como "cinza") */
export function colorDeCatalogo(nombre: string): ColorCatalogo | undefined {
  const n = norm(nombre);
  if (!n) return undefined;
  return CATALOGO.find(c => norm(c.nombre) === n) ?? CATALOGO.find(c => norm(c.nombre).startsWith(n)) ?? CATALOGO.find(c => n.includes(norm(c.nombre))) ?? CATALOGO.find(c => norm(c.nombre) === n.replace(/a$/, 'o')); // "blanca" = Blanco
}
/** Tono parecido para dibujar; si el nombre no está en el catálogo, un tono neutro de madera */
export const hexDe = (nombre: string, respaldo = '#c9a26b'): string => colorDeCatalogo(nombre)?.hex ?? respaldo;
export const esBlanco = (nombre: string): boolean => /^(blanco|nivola)/.test(norm(nombre));

/** Un tablero: color, calibre (mm), RH (resistente a la humedad) y canto rígido */
export interface Tablero { color: string; cal: number; rh: boolean; rigido: boolean }
/** Acabados de un nivel de muebles: estructura, fachada y fondos/espaldares */
export interface AcabadosNivel { est: Tablero; fach: Tablero; fondo: Tablero }
/** Acabados del diseño: MA (aéreos) y MB (muebles base; los demás muebles —torres, alacenas, closets— usan lo mismo de MB) */
export interface Acabados {
  MA: AcabadosNivel;
  MB: AcabadosNivel;
  AL?: AcabadosNivel; // alacena alta: si no se da, lleva lo mismo que los bajos
  TH?: AcabadosNivel; // torre de hornos: si no se da, lleva lo mismo que los bajos
  PU?: AcabadosNivel; // módulo en puente (el de arriba): si no se da, lleva lo mismo que los aéreos
  cantoFachada: boolean; // estructura blanca con fachada de color: el canto del frente va en el color de la fachada
  gola: 'melamina' | 'aluminio'; // sistema gola: puente en L de melamina o perfil de aluminio
  golaCorrida: boolean; // gola en melamina: puente en L corrido entre bajos pegados y costados internos 80 mm más cortos (sin cortes en la instalación)
  laminaLargo: number; // largo de la lámina del proveedor (2400 o 2800): el puente corrido se corta en el costado de un módulo si lo supera
  aereoAbre: 'pestana' | 'alras'; // aéreos: la puerta abre con pestaña inferior o queda al ras del mueble
  herrajes: HerrajesCocina; // herrajería especial que lleva la cocina
}
/** Herrajería de la cocina (casillas de Configuración de módulos). Con zócalo en aluminio, cada mueble base lleva 4 patas plásticas. */
export interface HerrajesCocina { platillero: boolean; condimentero: boolean; basurera: boolean; esquinaMagica: boolean; zocaloAluminio: boolean }
export const HERRAJES_COCINA: HerrajesCocina = { platillero: false, condimentero: false, basurera: false, esquinaMagica: false, zocaloAluminio: false };
export const PATAS_POR_MUEBLE = 4;
const nivel = (): AcabadosNivel => ({
  est: { color: 'Blanco', cal: 15, rh: true, rigido: false },   // regla del carpintero: estructura RH con canto flexible
  fach: { color: 'Blanco', cal: 15, rh: false, rigido: true },  // fachada de 15 con 4LR
  fondo: { color: 'Blanco', cal: 5.5, rh: false, rigido: false }, // fondo de 5,5 (se pide de 6), sin canto
});
// la fachada de MA nace vacía: sigue la de MB hasta que se elija otra
export const ACABADOS: Acabados = { MA: { ...nivel(), fach: { ...nivel().fach, color: '' } }, MB: nivel(), cantoFachada: true, gola: 'melamina', golaCorrida: false, laminaLargo: 2400, aereoAbre: 'pestana', herrajes: HERRAJES_COCINA };
export const CALIBRES = { estructura: [15, 18], fachada: [15, 18], fondo: [2.5, 4, 5.5] };
/** Calibre como se escribe en la lista: 5,5 / 2,5 */
export const calTexto = (n: number) => String(n).replace('.', ',');
/** Nivel que corresponde a un mueble: los aéreos usan MA; base, torres, alacenas y closets usan MB */
export const nivelDe = (a: Acabados, tipo?: string): AcabadosNivel => (tipo === 'PU' ? (a.PU ?? a.MA) : tipo === 'AL' ? (a.AL ?? a.MB) : tipo === 'TH' ? (a.TH ?? a.MB) : tipo === 'MA' ? a.MA : a.MB);

/** Completa acabados guardados antes (formato viejo con estMA/estMB/estOtros, fondo, cal, rh) o a medias */
export function completarAcabados(v?: unknown): Acabados {
  const a = (v ?? {}) as Record<string, any>;
  const base = ACABADOS;
  const tab = (t: any, d: Tablero): Tablero => ({ ...d, ...(t && typeof t === 'object' ? t : {}) });
  const niv = (n: any, d: AcabadosNivel): AcabadosNivel => ({ est: tab(n?.est, d.est), fach: tab(n?.fach, d.fach), fondo: tab(n?.fondo, d.fondo) });
  const herr = { ...HERRAJES_COCINA, ...(a.herrajes && typeof a.herrajes === 'object' ? a.herrajes : {}) };
  if (a.MA || a.MB) return { ...base, ...a, MA: niv(a.MA, base.MA), MB: niv(a.MB, base.MB), ...(a.PU ? { PU: niv(a.PU, base.MA) } : {}), ...(a.AL ? { AL: niv(a.AL, base.MB) } : {}), ...(a.TH ? { TH: niv(a.TH, base.MB) } : {}), herrajes: herr } as Acabados;
  // formato anterior: un campo por tipo de estructura y uno solo de fondo y fachada
  const viejo = (k: 'estMA' | 'estMB'): AcabadosNivel => ({
    est: { color: a[k] ?? 'Blanco', cal: a.cal?.[k] ?? 15, rh: a.rh?.[k] ?? true, rigido: a.rigido?.[k] ?? false },
    fach: { color: '', cal: a.cal?.fachada ?? 15, rh: a.rh?.fachada ?? false, rigido: a.rigido?.fachada ?? true },
    fondo: { color: a.fondo ?? 'Blanco', cal: a.cal?.fondo ?? 5.5, rh: a.rh?.fondo ?? false, rigido: false },
  });
  return { MA: viejo('estMA'), MB: viejo('estMB'), cantoFachada: a.cantoFachada ?? true, gola: a.gola ?? 'melamina', golaCorrida: false, laminaLargo: 2400, aereoAbre: a.aereoAbre ?? 'pestana', herrajes: herr };
}
