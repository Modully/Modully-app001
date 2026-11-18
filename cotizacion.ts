import type { Costeo } from './costos';

/**
 * Documento de cotización para el cliente: HTML maquetado para pantalla, enlace e impresión (A4).
 * Muestra precios de venta, nunca costos. La forma de pago va en porcentaje de anticipo y el saldo sale por resta;
 * las condiciones salen del perfil de la empresa y se pueden retocar en cada cotización.
 */

export interface Condiciones { entrega: string; noIncluye: string; garantia: string; notas: string }
export interface Empresa {
  nombre: string; nit: string; telefono: string; correo: string; ciudad: string;
  anticipo: number;          // % de anticipo
  vigenciaDias: number;
  condiciones: Condiciones;
}

export const EMPRESA_INICIAL: Empresa = {
  nombre: '', nit: '', telefono: '', correo: '', ciudad: '',
  anticipo: 50, vigenciaDias: 15,
  condiciones: {
    entrega: 'Fabricación e instalación en 15 a 20 días hábiles después del anticipo y de la aprobación del diseño.',
    noIncluye: 'Obras civiles, plomería, puntos eléctricos, retiro de muebles existentes ni electrodomésticos.',
    garantia: 'Un año en fabricación e instalación y en herrajes, por defectos de fábrica y de uso normal.',
    notas: 'Los colores pueden variar levemente frente a la imagen. Las medidas se confirman en obra antes de cortar.',
  },
};

export function completarEmpresa(v: unknown): Empresa {
  const a = (v && typeof v === 'object' ? v : {}) as Partial<Empresa>;
  return { ...EMPRESA_INICIAL, ...a, condiciones: { ...EMPRESA_INICIAL.condiciones, ...(a.condiciones ?? {}) } };
}

export interface DatosCotizacion {
  numero: string;
  fecha: Date;
  cliente: string;
  proyecto: string;
  producto: string;          // "Cocina integral", "Closet"…
  descripcion: string;       // medidas generales, acabados
  cantidad: number;
  detalle: 'mueble' | 'modulo';
  costeo: Costeo;
  empresa: Empresa;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const $ = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fechaLarga = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const renglones = (t: string) => t.split('\n').map(x => x.trim()).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('');

/** Renglones de la cotización: el mueble completo o cada módulo, con precios de venta que suman el total exacto */
export function renglonesCotizacion(d: DatosCotizacion): { concepto: string; detalle: string; cant: number; unitario: number; total: number }[] {
  const total = d.costeo.totales.precio;
  if (d.detalle === 'mueble' || d.costeo.grupos.length <= 1) return [{ concepto: d.producto, detalle: d.descripcion, cant: d.cantidad, unitario: total, total: total * d.cantidad }];
  const suma = d.costeo.grupos.reduce((a, g) => a + g.precio, 0) || 1;
  // se reparte el total redondeado entre los módulos según su precio; el último absorbe la diferencia de redondeo
  let acumulado = 0;
  return d.costeo.grupos.map((g, i, l) => {
    const v = i === l.length - 1 ? total - acumulado : Math.round((g.precio / suma) * total / 100) * 100;
    acumulado += v;
    return { concepto: g.nombre, detalle: g.detalle, cant: d.cantidad, unitario: v, total: v * d.cantidad };
  });
}

export function htmlCotizacion(d: DatosCotizacion): string {
  const e = d.empresa;
  const filas = renglonesCotizacion(d);
  const total = filas.reduce((a, f) => a + f.total, 0);
  const anticipo = Math.round(total * e.anticipo / 100), saldo = total - anticipo;
  const vence = new Date(d.fecha.getTime() + e.vigenciaDias * 86400000);
  const bloque = (t: string, txt: string) => (txt.trim() ? `<div class="cond"><h4>${t}</h4><ul>${renglones(txt)}</ul></div>` : '');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cotización ${esc(d.numero)} · ${esc(d.cliente)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f9; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hoja { max-width: 820px; margin: 16px auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 24px rgba(15,23,42,.08); }
  header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 3px solid #4f46e5; padding-bottom: 16px; }
  .empresa h1 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
  .empresa p, .meta p { margin: 2px 0; font-size: 12px; color: #475569; }
  .meta { text-align: right; }
  .meta .num { font-size: 18px; font-weight: 800; color: #4f46e5; }
  .cliente { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 20px 0; font-size: 13px; }
  .cliente b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead { display: table-header-group; }
  th { background: #eef2ff; color: #3730a3; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; padding: 8px 10px; }
  td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr { page-break-inside: avoid; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  td small { display: block; color: #64748b; font-size: 11px; margin-top: 2px; }
  .totales { margin-left: auto; width: 300px; margin-top: 16px; font-size: 13px; page-break-inside: avoid; }
  .totales div { display: flex; justify-content: space-between; padding: 6px 0; }
  .totales .grande { font-size: 18px; font-weight: 800; border-top: 2px solid #0f172a; margin-top: 4px; padding-top: 10px; }
  .pago { background: #f8fafc; border-radius: 12px; padding: 14px 16px; margin-top: 20px; font-size: 13px; page-break-inside: avoid; }
  .conds { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-top: 20px; }
  .cond h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #4f46e5; }
  .cond ul { margin: 0; padding-left: 16px; font-size: 12px; color: #334155; }
  .firma { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; font-size: 12px; color: #475569; page-break-inside: avoid; }
  .firma div { border-top: 1px solid #94a3b8; padding-top: 6px; }
  footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print { body { background: #fff; } .hoja { box-shadow: none; margin: 0; max-width: none; border-radius: 0; padding: 0; } }
  @media (max-width: 600px) { .hoja { padding: 18px; } .cliente, .conds, .firma { grid-template-columns: 1fr; } .totales { width: 100%; } header { flex-direction: column; } .meta { text-align: left; } }
</style></head><body><div class="hoja">
<header>
  <div class="empresa"><h1>${esc(e.nombre || 'Tu empresa')}</h1>
    ${e.nit ? `<p>NIT ${esc(e.nit)}</p>` : ''}${e.telefono ? `<p>${esc(e.telefono)}</p>` : ''}${e.correo ? `<p>${esc(e.correo)}</p>` : ''}${e.ciudad ? `<p>${esc(e.ciudad)}</p>` : ''}</div>
  <div class="meta"><p class="num">Cotización ${esc(d.numero)}</p><p>${fechaLarga(d.fecha)}</p><p>Válida hasta el ${fechaLarga(vence)}</p></div>
</header>
<div class="cliente">
  <div><b>Cliente</b>${esc(d.cliente || '—')}</div>
  <div><b>Proyecto</b>${esc(d.proyecto || '—')}</div>
</div>
<table>
  <thead><tr><th>Concepto</th><th class="n">Cant.</th><th class="n">Valor unitario</th><th class="n">Total</th></tr></thead>
  <tbody>${filas.map(f => `<tr><td>${esc(f.concepto)}${f.detalle ? `<small>${esc(f.detalle)}</small>` : ''}</td><td class="n">${f.cant}</td><td class="n">${$(f.unitario)}</td><td class="n">${$(f.total)}</td></tr>`).join('')}</tbody>
</table>
<div class="totales"><div class="grande"><span>Total</span><span>${$(total)}</span></div></div>
<div class="pago"><b>Forma de pago:</b> anticipo del ${e.anticipo} % (${$(anticipo)}) para iniciar la fabricación y saldo de ${$(saldo)} contra entrega e instalación.</div>
<div class="conds">${bloque('Entrega', e.condiciones.entrega)}${bloque('No incluye', e.condiciones.noIncluye)}${bloque('Garantía', e.condiciones.garantia)}${bloque('Notas', e.condiciones.notas)}</div>
<div class="firma"><div>${esc(e.nombre || 'La empresa')}</div><div>Acepto · ${esc(d.cliente || 'el cliente')}</div></div>
<footer>Cotización hecha con Modully</footer>
</div></body></html>`;
}
