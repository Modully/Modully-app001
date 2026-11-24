import * as THREE from 'three';
import { hexConVeta } from './colores';

/**
 * Veta de madera dibujada en un canvas (no hay fotos del catálogo): líneas finas más claras y más oscuras que el tono,
 * un poco onduladas, siguiendo el largo de la pieza. Es solo para que el modelo se vea como madera; el color real se ve en el render.
 */
const cache = new Map<string, THREE.CanvasTexture>();

function semilla(s: string): () => number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

export function texturaVeta(hex: string): THREE.CanvasTexture {
  const k = hex.toLowerCase();
  const hit = cache.get(k);
  if (hit) return hit;
  const N = 512, cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const g = cv.getContext('2d')!;
  g.fillStyle = k; g.fillRect(0, 0, N, N);
  const rnd = semilla(k);
  // franjas anchas de tono (anillos de crecimiento) y luego vetas finas
  for (let i = 0; i < 14; i++) {
    const x = rnd() * N, w = 14 + rnd() * 46;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    g.fillRect(x, 0, w, N);
  }
  for (let i = 0; i < 170; i++) {
    const x0 = rnd() * N, amp = 1.5 + rnd() * 5, fase = rnd() * 6.28, frec = 0.006 + rnd() * 0.012;
    g.strokeStyle = rnd() > 0.45 ? `rgba(0,0,0,${0.05 + rnd() * 0.16})` : `rgba(255,255,255,${0.04 + rnd() * 0.12})`;
    g.lineWidth = 0.6 + rnd() * 1.6;
    g.beginPath();
    for (let y = 0; y <= N; y += 8) {
      const x = x0 + Math.sin(y * frec * 6.28 + fase) * amp;
      if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(k, t);
  return t;
}

/** Propiedades del material: el tono solo, o blanco con la veta si el color es de madera */
export function vetaProps(hex: string): { color: string; map?: THREE.Texture } {
  return hexConVeta(hex) ? { color: '#ffffff', map: texturaVeta(hex) } : { color: hex };
}
