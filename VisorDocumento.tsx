import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Documento, enlaceDocumento } from './nube';

/**
 * Visor de un documento del proyecto dentro de Modully (sin abrir otra pestaña):
 * imágenes (render, foto con IA, boceto), páginas (láminas y planos, con botón para imprimir o guardar como PDF)
 * y el Excel de corte (cada hoja como tabla).
 */

type Contenido = { tipo: 'imagen'; url: string } | { tipo: 'pagina'; html: string } | { tipo: 'excel'; hojas: { nombre: string; html: string }[] };

export const VisorDocumento: React.FC<{ doc: Documento; onCerrar: () => void }> = ({ doc, onCerrar }) => {
  const [c, setC] = useState<Contenido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoja, setHoja] = useState(0);
  const marco = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const url = await enlaceDocumento(doc);
        const n = doc.nombre.toLowerCase();
        if (/\.(png|jpe?g|webp)$/.test(n)) { if (vivo) setC({ tipo: 'imagen', url }); return; }
        const r = await fetch(url);
        if (!r.ok) throw new Error('No se pudo leer el documento.');
        if (/\.html?$/.test(n)) { const html = await r.text(); if (vivo) setC({ tipo: 'pagina', html }); return; }
        if (/\.xlsx$/.test(n)) {
          const wb = XLSX.read(await r.arrayBuffer(), { type: 'array' });
          const hojas = wb.SheetNames.map(nombre => ({ nombre, html: XLSX.utils.sheet_to_html(wb.Sheets[nombre], { header: '', footer: '' }) }));
          if (vivo) setC({ tipo: 'excel', hojas });
          return;
        }
        throw new Error('Este tipo de archivo no se puede ver aquí; usa Descargar.');
      } catch (e) { if (vivo) setError(e instanceof Error ? e.message : String(e)); }
    })();
    return () => { vivo = false; };
  }, [doc.id]);

  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onCerrar]);

  const descargar = async () => { const a = document.createElement('a'); a.href = await enlaceDocumento(doc, true); a.click(); };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/50 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200">
          <span className="text-sm font-black text-slate-800 truncate mr-auto">{doc.nombre}</span>
          {c?.tipo === 'pagina' && <button onClick={() => marco.current?.contentWindow?.print()} className="rounded-xl px-3 py-1.5 text-xs font-black border border-slate-200 text-slate-700">Imprimir o guardar PDF</button>}
          <button onClick={descargar} className="rounded-xl px-3 py-1.5 text-xs font-black border border-slate-200 text-slate-700">Descargar</button>
          <button onClick={onCerrar} className="rounded-xl px-3 py-1.5 text-xs font-black bg-slate-800 text-white">Cerrar</button>
        </div>
        {c?.tipo === 'excel' && c.hojas.length > 1 && (
          <div className="flex gap-1 px-4 pt-2">
            {c.hojas.map((h, i) => <button key={h.nombre} onClick={() => setHoja(i)} className={`rounded-lg px-3 py-1 text-[11px] font-black border ${i === hoja ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{h.nombre}</button>)}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
          {!c && !error && <div className="p-6 text-sm font-bold text-slate-400">Cargando…</div>}
          {error && <div className="m-4 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}
          {c?.tipo === 'imagen' && <img src={c.url} alt={doc.nombre} className="max-w-full mx-auto block p-3" />}
          {/* la página se muestra aislada (sin scripts) pero del mismo origen, para poder imprimirla */}
          {c?.tipo === 'pagina' && <iframe ref={marco} title={doc.nombre} srcDoc={c.html} sandbox="allow-same-origin allow-modals" className="w-full h-full bg-white border-0" />}
          {c?.tipo === 'excel' && (
            <div className="p-3 text-[11px] [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_tr:first-child_td]:font-black [&_tr:first-child_td]:bg-slate-200 bg-white"
              dangerouslySetInnerHTML={{ __html: c.hojas[hoja]?.html ?? '' }} />
          )}
        </div>
      </div>
    </div>
  );
};
