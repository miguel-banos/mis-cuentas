// Capa de datos: guarda secciones y apuntes.
// - Modo prueba (sin configuración de Firebase): localStorage de este navegador.
// - Modo real: Firebase (entrar con Google + base de datos Firestore).
//   Cada persona solo ve sus propios datos: users/{uid}/sections y users/{uid}/entries.

import { firebaseConfig } from './firebase-config.js';

const FB_CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
const DEMO_KEY = 'mis-cuentas-demo-v1';

// Con "?demo" en la dirección se abre el modo prueba aunque haya Firebase,
// para que cualquiera pueda probar la app sin cuenta (enlace del README).
export const demoRequested = new URLSearchParams(location.search).has('demo');

export const DEFAULT_SECTIONS = [
  { name: 'Nómina', emoji: '💼', color: '#2e7d32', type: 'ingreso' },
  { name: 'Compra', emoji: '🛒', color: '#ef6c00', type: 'gasto' },
  { name: 'Casa', emoji: '🏠', color: '#1565c0', type: 'gasto' },
  { name: 'Luz y agua', emoji: '💡', color: '#f9a825', type: 'gasto' },
  { name: 'Coche', emoji: '🚗', color: '#6a1b9a', type: 'gasto' },
  { name: 'Otros', emoji: '📦', color: '#546e7a', type: 'gasto' },
];

export const newId = () =>
  (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/**
 * Crea el almacén de datos. `onChange(state)` se llama cada vez que algo cambia.
 * state = { mode: 'demo'|'firebase', status: 'loading'|'signedOut'|'ready'|'error',
 *           user, sections, entries, error }
 */
export async function createStore(onChange) {
  const state = {
    mode: firebaseConfig && !demoRequested ? 'firebase' : 'demo',
    status: 'loading',
    user: null,
    sections: [],
    entries: [],
    error: null,
  };
  const emit = () => onChange(state);

  let backend;
  try {
    backend = state.mode === 'demo'
      ? demoBackend(state, emit)
      : await firebaseBackend(state, emit);
  } catch (err) {
    console.error(err);
    state.status = 'error';
    state.error = err;
    emit();
    backend = { put() {}, delMany() {}, signIn() {}, signOut() {} };
  }

  const nextOrder = () => state.sections.reduce((m, s) => Math.max(m, s.order ?? 0), -1) + 1;

  return {
    get state() { return state; },
    signIn: () => backend.signIn(),
    signOut: () => backend.signOut(),
    resetDemo: () => backend.reset && backend.reset(),

    addSection: (data) => backend.put('sections', { ...data, id: newId(), order: nextOrder() }),
    updateSection: (id, data) => {
      const old = state.sections.find((s) => s.id === id);
      return backend.put('sections', { ...old, ...data, id });
    },
    deleteSection: (id) => {
      const ops = state.entries.filter((e) => e.sectionId === id).map((e) => ['entries', e.id]);
      ops.push(['sections', id]);
      return backend.delMany(ops);
    },

    addEntry: (data) => backend.put('entries', { ...data, id: newId(), createdAt: Date.now() }),
    updateEntry: (id, data) => {
      const old = state.entries.find((e) => e.id === id);
      return backend.put('entries', { ...old, ...data, id });
    },
    deleteEntry: (id) => backend.delMany([['entries', id]]),
  };
}

// ---------------------------------------------------------------------------
// Modo prueba: todo en localStorage
// ---------------------------------------------------------------------------
function demoBackend(state, emit) {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { /* sin datos */ }
  if (!data || !Array.isArray(data.sections)) {
    const sections = DEFAULT_SECTIONS.map((s, i) => ({ ...s, id: newId(), order: i }));
    data = { sections, entries: demoRequested ? sampleEntries(sections) : [] };
  }
  state.sections = data.sections;
  state.entries = data.entries || [];
  state.user = { name: 'Modo prueba', email: '' };
  state.status = 'ready';

  const save = () => {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify({ sections: state.sections, entries: state.entries }));
    } catch { /* almacenamiento no disponible */ }
  };
  save();
  queueMicrotask(emit);

  return {
    put(coll, obj) {
      const list = state[coll].filter((x) => x.id !== obj.id);
      list.push(obj);
      state[coll] = list;
      save();
      emit();
      return Promise.resolve();
    },
    delMany(ops) {
      for (const [coll, id] of ops) state[coll] = state[coll].filter((x) => x.id !== id);
      save();
      emit();
      return Promise.resolve();
    },
    signIn() {},
    signOut() {},
    reset() {
      try { localStorage.removeItem(DEMO_KEY); } catch { /* nada */ }
      location.reload();
    },
  };
}

// Apuntes de ejemplo (este mes y el anterior) para la demo pública.
function sampleEntries(sections) {
  const id = (name) => sections.find((s) => s.name === name).id;
  const p = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const out = [];
  [0, 1].forEach((back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const last = back ? new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() : now.getDate();
    const day = (n) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(Math.min(n, last))}`;
    const add = (name, euros, note, n) => out.push({
      id: newId(), sectionId: id(name), cents: Math.round(euros * 100), note, date: day(n), createdAt: Date.now(),
    });
    add('Nómina', 1450, 'Nómina', 1);
    add('Casa', 290, 'Alquiler', 2);
    add('Compra', 86.4, 'Mercadona', 3);
    add('Luz y agua', 64.2, 'Factura de la luz', 6);
    add('Compra', 42.15, 'Frutería', 9);
    add('Coche', 55, 'Gasolina', 12);
    add('Compra', 71.8, 'Mercadona', 16);
    add('Otros', 24.99, 'Regalo cumpleaños', 18);
    if (back) add('Coche', 120, 'Revisión', 24);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Modo real: Firebase
// ---------------------------------------------------------------------------
async function firebaseBackend(state, emit) {
  const [appMod, authMod, fs] = await Promise.all([
    import(FB_CDN + 'firebase-app.js'),
    import(FB_CDN + 'firebase-auth.js'),
    import(FB_CDN + 'firebase-firestore.js'),
  ]);

  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  auth.languageCode = 'es';

  let db;
  try {
    // Caché local: la app abre rápido y permite apuntar sin cobertura.
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }

  let unsubs = [];
  const userDoc = (...path) => fs.doc(db, 'users', state.user.uid, ...path);

  authMod.onAuthStateChanged(auth, async (u) => {
    unsubs.forEach((f) => f());
    unsubs = [];

    if (!u) {
      Object.assign(state, { user: null, sections: [], entries: [], status: 'signedOut' });
      emit();
      return;
    }

    state.user = { uid: u.uid, name: u.displayName || '', email: u.email || '' };
    state.status = 'loading';
    emit();

    // Primera vez que entra esta persona: crear secciones de ejemplo.
    try {
      const profileRef = fs.doc(db, 'users', u.uid);
      const profile = await fs.getDoc(profileRef);
      if (!profile.exists()) {
        const batch = fs.writeBatch(db);
        DEFAULT_SECTIONS.forEach((s, i) => batch.set(userDoc('sections', newId()), { ...s, order: i }));
        batch.set(profileRef, { name: state.user.name, createdAt: Date.now() });
        await batch.commit();
      }
    } catch (err) {
      console.error('No se pudo preparar la cuenta', err);
    }

    let gotSections = false;
    let gotEntries = false;
    const onError = (err) => {
      console.error(err);
      state.status = 'error';
      state.error = err;
      emit();
    };
    const update = () => {
      if (gotSections && gotEntries) state.status = 'ready';
      emit();
    };

    unsubs.push(fs.onSnapshot(fs.collection(db, 'users', u.uid, 'sections'), (snap) => {
      state.sections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      gotSections = true;
      update();
    }, onError));

    unsubs.push(fs.onSnapshot(fs.collection(db, 'users', u.uid, 'entries'), (snap) => {
      state.entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      gotEntries = true;
      update();
    }, onError));
  });

  return {
    // No esperamos a la respuesta del servidor: la caché local actualiza la
    // pantalla al momento y Firebase sincroniza en cuanto hay internet.
    put(coll, obj) {
      const { id, ...rest } = obj;
      fs.setDoc(userDoc(coll, id), rest).catch((err) => console.error(err));
      return Promise.resolve();
    },
    delMany(ops) {
      const batch = fs.writeBatch(db);
      for (const [coll, id] of ops) batch.delete(userDoc(coll, id));
      batch.commit().catch((err) => console.error(err));
      return Promise.resolve();
    },
    async signIn() {
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await authMod.signInWithPopup(auth, provider);
      } catch (err) {
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
          await authMod.signInWithRedirect(auth, provider);
        } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
          throw err;
        }
      }
    },
    signOut() {
      return authMod.signOut(auth);
    },
  };
}
