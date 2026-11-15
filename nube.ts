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
export interface DisenoGuardado { id: string; proyecto_id: string; seccion: string; nombre: string; datos: unknown; updated_at: string }

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
  return ok(await nube.from('disenos').select('id, proyecto_id, seccion, nombre, datos, updated_at').eq('proyecto_id', proyectoId).order('updated_at', { ascending: false })) as DisenoGuardado[];
}
/** Guarda un diseño nuevo, o reemplaza uno existente si se da su id */
export async function guardarDiseno(proyectoId: string, seccion: string, nombre: string, datos: unknown, id?: string): Promise<DisenoGuardado> {
  if (!nube) throw sinNube();
  const fila = { proyecto_id: proyectoId, seccion, nombre, datos };
  const q = id ? nube.from('disenos').update(fila).eq('id', id) : nube.from('disenos').insert(fila);
  return ok(await q.select('id, proyecto_id, seccion, nombre, datos, updated_at').single()) as DisenoGuardado;
}
export async function borrarDiseno(id: string) {
  if (!nube) throw sinNube();
  ok(await nube.from('disenos').delete().eq('id', id));
}
