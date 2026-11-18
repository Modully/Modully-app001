import { createClient, Session } from '@supabase/supabase-js';

/**
 * Conexión con Supabase (proyecto "Modully"): cuentas, proyectos de cliente y diseños guardados.
 * La clave es la publicable (pública por diseño): lo que protege los datos son las reglas de seguridad de la base,
 * que solo dejan a cada usuario ver y cambiar lo suyo.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
export const nubeConfigurada = !!url && !!key;
export const nube = nubeConfigurada ? createClient(url!, key!) : null;

export interface Proyecto { id: string; cliente: string; nombre: string; notas: string; updated_at: string }
export interface DisenoGuardado { id: string; proyecto_id: string; seccion: string; nombre: string; ubicacion: string; cantidad: number; datos: unknown; updated_at: string; aprobado_at: string | null }

const sinNube = () => new Error('Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_KEY en .env.local).');
const traducir = (m: string) =>
  /Invalid login credentials/i.test(m) ? 'Correo o contraseña incorrectos.'
  : /Email not confirmed/i.test(m) ? 'Falta confirmar el correo: revisa tu bandeja de entrada y abre el enlace de Supabase.'
  : /User already registered/i.test(m) ? 'Ya hay una cuenta con ese correo. Entra con tu contraseña.'
  : /Password should be at least/i.test(m) ? 'La contraseña debe tener al menos 6 caracteres.'
  : /rate limit/i.test(m) ? 'Demasiados intentos seguidos. Espera un momento.'
  : m;
const ok = <T,>(r: { data: T; error: { message: string } | null }): T => { if (r.error) throw new Error(traducir(r.error.message)); return r.data; };

export async function sesionActual(): Promise<Session | null> {
  if (!nube) return null;
  return (await nube.auth.getSession()).data.session;
}
export function alCambiarSesion(f: (s: Session | null) => void) {
  if (!nube) return () => {};
  const { data } = nube.auth.onAuthStateChange((_e, s) => f(s));
  return () => data.subscription.unsubscribe();
}
export async function entrar(correo: string, clave: string) {
  if (!nube) throw sinNube();
  ok(await nube.auth.signInWithPassword({ email: correo.trim(), password: clave }));
}
/** Crea la cuenta; devuelve true si ya quedó con sesión, false si Supabase pide confirmar el correo primero */
export async function registrarse(correo: string, clave: string, nombre: string): Promise<boolean> {
  if (!nube) throw sinNube();
  const d = ok(await nube.auth.signUp({ email: correo.trim(), password: clave, options: { data: { nombre } } }));
  return !!d.session;
}
export async function salir() { await nube?.auth.signOut(); }

export async function listarProyectos(): Promise<Proyecto[]> {
  if (!nube) throw sinNube();
  return ok(await nube.from('proyectos').select('id, cliente, nombre, notas, updated_at').order('updated_at', { ascending: false })) as Proyecto[];
}
export async function crearProyecto(cliente: string, nombre: string): Promise<Proyecto> {
  if (!nube) throw sinNube();
  return ok(await nube.from('proyectos').insert({ cliente, nombre }).select('id, cliente, nombre, notas, updated_at').single()) as Proyecto;
}
export async function borrarProyecto(id: string) {
  if (!nube) throw sinNube();
  ok(await nube.from('proyectos').delete().eq('id', id));
}
export async function listarDisenos(proyectoId: string): Promise<DisenoGuardado[]> {
  if (!nube) throw sinNube();
  return ok(await nube.from('disenos').select('id, proyecto_id, seccion, nombre, ubicacion, cantidad, datos, updated_at, aprobado_at').eq('proyecto_id', proyectoId).order('updated_at', { ascending: false })) as DisenoGuardado[];
}
/** Guarda un producto nuevo del proyecto, o reemplaza su diseño si se da su id (la cantidad y la ubicación se conservan si no se dan) */
export async function guardarDiseno(proyectoId: string, seccion: string, nombre: string, datos: unknown, id?: string, extra?: { cantidad?: number; ubicacion?: string }): Promise<DisenoGuardado> {
  if (!nube) throw sinNube();
  // al cambiar el diseño se pierde la aprobación: hay que volver a aprobarlo para que se rehagan sus documentos
  const fila = { proyecto_id: proyectoId, seccion, nombre, datos, aprobado_at: null, ...(extra?.cantidad ? { cantidad: extra.cantidad } : {}), ...(extra?.ubicacion !== undefined ? { ubicacion: extra.ubicacion } : {}) };
  const q = id ? nube.from('disenos').update(fila).eq('id', id) : nube.from('disenos').insert(fila);
  return ok(await q.select('id, proyecto_id, seccion, nombre, ubicacion, cantidad, datos, updated_at, aprobado_at').single()) as DisenoGuardado;
}
/** Marca el diseño del producto como aprobado (la orden para crear sus documentos) */
export async function marcarAprobado(id: string) {
  if (!nube) throw sinNube();
  ok(await nube.from('disenos').update({ aprobado_at: new Date().toISOString() }).eq('id', id));
}
/** Cambia la cantidad, el nombre o la ubicación de un producto sin tocar su diseño */
export async function ajustarDiseno(id: string, cambios: { cantidad?: number; nombre?: string; ubicacion?: string }) {
  if (!nube) throw sinNube();
  ok(await nube.from('disenos').update(cambios).eq('id', id));
}
export async function borrarDiseno(id: string) {
  if (!nube) throw sinNube();
  ok(await nube.from('disenos').delete().eq('id', id));
}

/** Tabla de costos del usuario y datos de su empresa (para el costeo y la cotización): una fila por usuario */
export async function leerPerfilCostos(): Promise<{ costos: unknown; empresa: unknown } | null> {
  if (!nube) return null;
  const uid = (await nube.auth.getUser()).data.user?.id;
  if (!uid) return null;
  const r = await nube.from('perfil_costos').select('costos, empresa').eq('owner_id', uid).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return r.data as { costos: unknown; empresa: unknown } | null;
}
export async function guardarPerfilCostos(costos: unknown, empresa: unknown) {
  if (!nube) return;
  const uid = (await nube.auth.getUser()).data.user?.id;
  if (!uid) return;
  ok(await nube.from('perfil_costos').upsert({ owner_id: uid, costos, empresa, updated_at: new Date().toISOString() }));
}

/** Biblioteca: diseños aprobados guardados para volver a usarlos en otros proyectos sin rehacer el proceso */
export interface DisenoBiblioteca { id: string; seccion: string; nombre: string; notas: string; datos: unknown; diseno_id: string | null; created_at: string; updated_at: string }
const COLS_BIB = 'id, seccion, nombre, notas, datos, diseno_id, created_at, updated_at';
export async function listarBiblioteca(): Promise<DisenoBiblioteca[]> {
  if (!nube) throw sinNube();
  return ok(await nube.from('biblioteca').select(COLS_BIB).order('updated_at', { ascending: false })) as DisenoBiblioteca[];
}
export async function guardarEnBiblioteca(seccion: string, nombre: string, datos: unknown, disenoId?: string, notas = ''): Promise<DisenoBiblioteca> {
  if (!nube) throw sinNube();
  return ok(await nube.from('biblioteca').insert({ seccion, nombre, datos, notas, diseno_id: disenoId ?? null }).select(COLS_BIB).single()) as DisenoBiblioteca;
}
export async function ajustarBiblioteca(id: string, cambios: { nombre?: string; notas?: string }) {
  if (!nube) throw sinNube();
  ok(await nube.from('biblioteca').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id));
}
export async function borrarDeBiblioteca(id: string) {
  if (!nube) throw sinNube();
  ok(await nube.from('biblioteca').delete().eq('id', id));
}

/**
 * IA por el servidor: la clave de Gemini vive en Supabase (función "gemini") y no dentro de la app.
 * Se usa igual que `ai.models.generateContent` del SDK de Google: { model, contents, config } y devuelve { text, candidates }.
 * Hace falta tener sesión (la función rechaza a quien no haya entrado).
 */
export class ErrorIA extends Error { constructor(msg: string, public codigo: string) { super(msg); } }

export const iaDisponible = (): boolean => nubeConfigurada;

export async function generarIA(p: { model: string; contents: unknown; config?: { responseMimeType?: string; responseSchema?: unknown; temperature?: number } }) {
  if (!nube) throw new ErrorIA('Falta configurar Supabase en .env.local.', 'sin_nube');
  const contents = typeof p.contents === 'string' ? [{ role: 'user', parts: [{ text: p.contents }] }] : p.contents;
  const { data, error } = await nube.functions.invoke('gemini', { body: { model: p.model, contents, generationConfig: p.config } });
  if (error) {
    // el cuerpo del error trae { error, codigo }
    let cuerpo: { error?: string; codigo?: string } = {};
    try { cuerpo = await (error as { context?: Response }).context?.json() ?? {}; } catch { /* sin cuerpo */ }
    const codigo = cuerpo.codigo ?? 'red';
    const msg = codigo === 'sin_sesion' ? 'Entra con tu cuenta (pestaña Proyectos) para usar la IA.'
      : codigo === 'sin_clave' ? 'La clave de Gemini no está puesta en el servidor (Supabase → Edge Functions → Secrets → GEMINI_API_KEY).'
      : codigo === 'cuota' ? '429 quota: la cuenta de Gemini llegó a su límite de uso.'
      : codigo === 'clave' ? 'API key not valid: Gemini rechazó la clave del servidor.'
      : codigo === 'modelo_no_disponible' ? `404: el modelo ${p.model} no está disponible.`
      : cuerpo.error ?? error.message;
    throw new ErrorIA(msg, codigo);
  }
  const candidates = (data as { candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] } }[] })?.candidates ?? [];
  const text = candidates[0]?.content?.parts?.map(x => x.text ?? '').join('') ?? '';
  return { text, candidates };
}
/** Objeto con la misma forma que el cliente del SDK de Google, para cambiar lo mínimo donde ya se usaba */
export const ia = { models: { generateContent: generarIA } };

/* ---------- Documentos de cada producto (almacenamiento privado "documentos": <usuario>/<producto>/<archivo>) ---------- */
export interface Documento { id: string; diseno_id: string; tipo: string; nombre: string; ruta: string; bytes: number; created_at: string }
export interface DocumentoNuevo { tipo: string; nombre: string; archivo: Blob }

const limpio = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 80);

export async function listarDocumentos(disenoId: string): Promise<Documento[]> {
  if (!nube) throw sinNube();
  return ok(await nube.from('documentos').select('id, diseno_id, tipo, nombre, ruta, bytes, created_at').eq('diseno_id', disenoId).order('created_at', { ascending: false })) as Documento[];
}
/** Sube los documentos de un producto. Con `reemplazar`, los de ese mismo tipo que ya tenía se borran (quedan solo los últimos) */
export async function subirDocumentos(disenoId: string, docs: DocumentoNuevo[], reemplazar = true): Promise<number> {
  if (!nube) throw sinNube();
  const uid = (await nube.auth.getUser()).data.user?.id;
  if (!uid) throw new Error('Entra con tu cuenta para guardar documentos.');
  if (reemplazar && docs.length) {
    const viejos = (await listarDocumentos(disenoId)).filter(d => docs.some(n => n.tipo === d.tipo));
    if (viejos.length) {
      await nube.storage.from('documentos').remove(viejos.map(d => d.ruta));
      ok(await nube.from('documentos').delete().in('id', viejos.map(d => d.id)));
    }
  }
  for (const d of docs) {
    const ruta = `${uid}/${disenoId}/${Date.now()}-${limpio(d.nombre)}`;
    const up = await nube.storage.from('documentos').upload(ruta, d.archivo, { contentType: d.archivo.type || 'application/octet-stream', upsert: false });
    if (up.error) throw new Error(`No se pudo subir ${d.nombre}: ${up.error.message}`);
    ok(await nube.from('documentos').insert({ diseno_id: disenoId, tipo: d.tipo, nombre: d.nombre, ruta, bytes: d.archivo.size }));
  }
  return docs.length;
}
/** Enlace temporal (10 minutos) para abrir o descargar un documento */
export async function enlaceDocumento(d: Documento, descargar = false): Promise<string> {
  if (!nube) throw sinNube();
  const r = await nube.storage.from('documentos').createSignedUrl(d.ruta, 600, descargar ? { download: d.nombre } : undefined);
  if (r.error || !r.data) throw new Error('No se pudo abrir el documento.');
  return r.data.signedUrl;
}
export async function borrarDocumento(d: Documento) {
  if (!nube) throw sinNube();
  await nube.storage.from('documentos').remove([d.ruta]);
  ok(await nube.from('documentos').delete().eq('id', d.id));
}
/** Pasa una imagen en data URL (render, foto, boceto) a archivo */
export function archivoDeDataURL(url: string): Blob {
  const [cab, datos] = url.split(',');
  const tipo = /data:([^;]+)/.exec(cab)?.[1] ?? 'image/png';
  const bin = atob(datos); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: tipo });
}
