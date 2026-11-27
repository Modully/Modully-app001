import * as THREE from 'three';
import { estiloVeta, hexConVeta, EstiloVeta } from './colores';

/**
 * Veta de madera dibujada en un canvas (no hay fotos del catálogo). Tres diseños según el color del catálogo:
 *  - fina (tendencias): líneas largas y finas, casi rectas, de poco contraste, con poros;
 *  - clásica (atemporales con veta): vetas onduladas y arcos de catedral;
 *  - rústica: franjas marcadas, nudos, vetas que los rodean y pequeñas grietas.
 * El tono es siempre el del color; la veta solo lo aclara y lo oscurece un poco. El color real se ve en el render.
 */
const cache = new Map<string, THREE.CanvasTexture>();
const cacheMini = new Map<string, string>();

function semilla(s: string): () => number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

const oscura = (a: number) => `rgba(0,0,0,${a})`;
const clara = (a: number) => `rgba(255,255,255,${a})`;

/** Dibuja la veta de un tono en un canvas cuadrado de N px; la veta corre a lo largo (eje vertical) y el dibujo se repite sin saltos fuertes */
export function dibujarVeta(hex: string, N = 512, estilo: EstiloVeta = estiloVeta(hex)): HTMLCanvasElement {
  const k = hex.toLowerCase();
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const g = cv.getContext('2d')!;
  const e = N / 512; // escala del dibujo respecto de 512 px
  const rnd = semilla(k + estilo);
  g.fillStyle = k; g.fillRect(0, 0, N, N);

  // franjas anchas de tono (anillos de crecimiento)
  const franjas = estilo === 'rustica' ? 18 : estilo === 'clasica' ? 14 : 10;
  const fuerza = estilo === 'rustica' ? 1.7 : estilo === 'clasica' ? 1.1 : 0.8;
  for (let i = 0; i < franjas; i++) {
    const x = rnd() * N, w = (14 + rnd() * (estilo === 'rustica' ? 70 : 46)) * e;
    g.fillStyle = rnd() > 0.5 ? clara(0.05 * fuerza) : oscura(0.06 * fuerza);
    g.fillRect(x, 0, w, N);
  }

  // arcos de catedral: parábolas anidadas que abren hacia abajo
  const catedral = (cx: number, y0: number, niveles: number, paso: number, alpha: number) => {
    for (let j = 1; j <= niveles; j++) {
      const s = j * paso;
      g.strokeStyle = j % 2 ? oscura(alpha * (0.6 + rnd() * 0.5)) : clara(alpha * 0.8 * (0.6 + rnd() * 0.5));
      g.lineWidth = (0.7 + rnd() * 1.1) * e;
      for (const lado of [-1, 1]) {
        g.beginPath();
        for (let y = y0; y <= y0 + N * 0.55; y += 6 * e) {
          const x = cx + lado * Math.sqrt(Math.max(0, (y - y0) * s)) * 1.4;
          if (y === y0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  };

  if (estilo === 'clasica') {
    catedral(N * (0.25 + rnd() * 0.2), N * (0.05 + rnd() * 0.2), 7, 5 * e, 0.16);
    catedral(N * (0.68 + rnd() * 0.2), N * (0.45 + rnd() * 0.25), 6, 4 * e, 0.14);
  }

  // nudos de la madera rústica: óvalos concéntricos alargados con la veta rodeándolos
  if (estilo === 'rustica') {
    const nudos = 2 + Math.floor(rnd() * 2);
    for (let n = 0; n < nudos; n++) {
      const cx = N * (0.15 + rnd() * 0.7), cy = N * (0.1 + rnd() * 0.8), r = (7 + rnd() * 9) * e;
      for (let a = 5; a >= 1; a--) {
        g.beginPath();
        g.ellipse(cx, cy, r * a * 0.55, r * a * 1.25, 0, 0, Math.PI * 2);
        g.strokeStyle = a === 1 ? oscura(0.4) : oscura(0.1 + 0.03 * (5 - a));
        g.lineWidth = (a === 1 ? 1.6 : 0.9) * e; g.stroke();
      }
      g.beginPath(); g.ellipse(cx, cy, r * 0.5, r * 1.1, 0, 0, Math.PI * 2); g.fillStyle = oscura(0.28); g.fill();
    }
  }

  // vetas finas a lo largo de la pieza
  const lineas = estilo === 'fina' ? 120 : estilo === 'clasica' ? 150 : 130;
  for (let i = 0; i < lineas; i++) {
    const x0 = rnd() * N;
    const amp = (estilo === 'fina' ? 0.6 + rnd() * 1.8 : estilo === 'clasica' ? 1.5 + rnd() * 5 : 1 + rnd() * 4) * e;
    const fase = rnd() * 6.28, frec = (estilo === 'fina' ? 0.003 + rnd() * 0.006 : 0.006 + rnd() * 0.012);
    const fuerteOscuro = estilo === 'rustica' ? 0.08 + rnd() * 0.24 : estilo === 'fina' ? 0.04 + rnd() * 0.09 : 0.05 + rnd() * 0.16;
    g.strokeStyle = rnd() > 0.45 ? oscura(fuerteOscuro) : clara(fuerteOscuro * 0.75);
    g.lineWidth = (estilo === 'rustica' ? 0.7 + rnd() * 2.1 : estilo === 'fina' ? 0.5 + rnd() * 1.0 : 0.6 + rnd() * 1.6) * e;
    // las vetas de la rústica se curvan alrededor del centro de la hoja para no verse todas paralelas
    const desvio = estilo === 'rustica' ? (rnd() - 0.5) * 18 * e : 0;
    g.beginPath();
    for (let y = 0; y <= N; y += 8 * e) {
      const x = x0 + Math.sin(y * frec * 6.28 / e + fase) * amp + desvio * Math.sin((y / N) * Math.PI);
      if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }

  // poros: trazos cortos y oscuros a lo largo de la veta
  const poros = estilo === 'fina' ? 420 : estilo === 'rustica' ? 220 : 300;
  g.lineWidth = Math.max(0.5, 0.8 * e);
  for (let i = 0; i < poros; i++) {
    const x = rnd() * N, y = rnd() * N, l = (3 + rnd() * 9) * e;
    g.strokeStyle = oscura(0.07 + rnd() * 0.12);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * e, y + l); g.stroke();
  }

  // grietas de la madera rústica
  if (estilo === 'rustica') {
    for (let i = 0; i < 6; i++) {
      const x = rnd() * N, y = rnd() * N, l = (25 + rnd() * 60) * e;
      g.strokeStyle = oscura(0.3); g.lineWidth = Math.max(0.6, 0.9 * e);
      g.beginPath(); g.moveTo(x, y);
      for (let t = 1; t <= 5; t++) g.lineTo(x + (rnd() - 0.5) * 2.5 * e, y + (l * t) / 5);
      g.stroke();
    }
  }
  return cv;
}

export function texturaVeta(hex: string): THREE.CanvasTexture {
  const k = hex.toLowerCase();
  const hit = cache.get(k);
  if (hit) return hit;
  const t = new THREE.CanvasTexture(dibujarVeta(k, 512));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(k, t);
  return t;
}

/** Imagen pequeña (data URL) de la veta de un tono, para los cuadros de color y el buscador */
export function vetaMiniatura(hex: string, size = 64): string {
  const k = `${hex.toLowerCase()}|${size}`;
  const hit = cacheMini.get(k);
  if (hit) return hit;
  const url = dibujarVeta(hex, size * 2).toDataURL('image/png');
  cacheMini.set(k, url);
  return url;
}

/** Propiedades del material: el tono solo, o blanco con la veta si el color es de madera */
export function vetaProps(hex: string): { color: string; map?: THREE.Texture } {
  return hexConVeta(hex) ? { color: '#ffffff', map: texturaVeta(hex) } : { color: hex };
}
