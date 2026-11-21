// Mis cuentas — pantallas y lógica de la app
import { createStore, demoRequested } from './store.js';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fmt = (cents) => money.format((cents || 0) / 100);
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const monthName = (y, m) => `${cap(new Date(y, m, 1).toLocaleDateString('es-ES', { month: 'long' }))} ${y}`;
const monthOnly = (y, m) => new Date(y, m, 1).toLocaleDateString('es-ES', { month: 'long' });
const dayLabel = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return cap(new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
};

/** Convierte lo que escribe la persona ("12,50", "1.234,5", "12.5") a céntimos. */
function parseAmount(text) {
  let t = String(text).replace(/[\s€]/g, '');
  if (!t) return null;
  if (t.includes('.') && t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const cents = Math.round(parseFloat(t) * 100);
  return cents > 0 ? cents : null;
}

const EMOJIS = ['💼', '💰', '🏦', '🎁', '👵', '🛒', '🏠', '💡', '💧', '🔥', '📱', '📺', '🚗', '⛽', '🚌',
  '🏥', '💊', '👕', '👟', '✂️', '🍽️', '☕', '🎉', '🎂', '✈️', '🎓', '📚', '🐶', '🐱', '👶',
  '🧹', '🔧', '💳', '❤️', '⛪', '📦'];
const COLORS = ['#2e7d32', '#00897b', '#1565c0', '#3949ab', '#6a1b9a', '#c2185b',
  '#d32f2f', '#ef6c00', '#f9a825', '#6d4c41', '#546e7a'];

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let S = { status: 'loading', sections: [], entries: [] };
const now = new Date();
const view = { y: now.getFullYear(), m: now.getMonth() };
let store;
let installPrompt = null;

const isCurrentMonth = () => view.y === new Date().getFullYear() && view.m === new Date().getMonth();
const sortedSections = () => [...S.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const isIncome = (s) => s.type === 'ingreso';

function monthEntries() {
  const key = monthKey(view.y, view.m);
  return S.entries.filter((e) => typeof e.date === 'string' && e.date.startsWith(key));
}

function monthTotals() {
  const bySection = {};
  for (const e of monthEntries()) bySection[e.sectionId] = (bySection[e.sectionId] || 0) + (e.cents || 0);
  let income = 0;
  let spent = 0;
  for (const s of S.sections) {
    if (isIncome(s)) income += bySection[s.id] || 0;
    else spent += bySection[s.id] || 0;
  }
  return { bySection, income, spent, left: income - spent };
}

// ---------------------------------------------------------------------------
// Aviso flotante
// ---------------------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------------------
// Ventanas (hojas). Usan el historial para que el botón "atrás" del móvil
// cierre la ventana en vez de salir de la app.
// ---------------------------------------------------------------------------
const stack = [];

function openSheet(render, { live = false } = {}) {
  stack.push({ render, live });
  history.pushState({ sheet: stack.length }, '');
  showTop(true);
}

function closeSheet(levels = 1) {
  history.go(-Math.min(levels, stack.length));
}

window.addEventListener('popstate', () => {
  const depth = history.state?.sheet || 0;
  if (stack.length > depth) {
    stack.length = depth;
    showTop(true);
  }
});

function showTop(fresh = false) {
  const el = $('#sheet');
  const back = $('#backdrop');
  if (!stack.length) {
    el.hidden = true;
    back.hidden = true;
    el.innerHTML = '';
    document.body.classList.remove('noscroll');
    return;
  }
  const scroll = el.scrollTop;
  stack[stack.length - 1].render(el);
  el.hidden = false;
  back.hidden = false;
  document.body.classList.add('noscroll');
  el.scrollTop = fresh ? 0 : scroll;
  $$('[data-close]', el).forEach((b) => b.addEventListener('click', () => closeSheet()));
}

$('#backdrop').addEventListener('click', () => closeSheet());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) closeSheet(); });

// ---------------------------------------------------------------------------
// Pantalla principal
// ---------------------------------------------------------------------------
function render() {
  const root = $('#app');

  if (S.status === 'loading') {
    root.innerHTML = '<div class="center"><div class="spinner"></div><p>Cargando…</p></div>';
    return;
  }
  if (S.status === 'error') {
    root.innerHTML = `
      <div class="center">
        <div style="font-size:3rem">📶</div>
        <h2>No se ha podido abrir</h2>
        <p>Comprueba que tienes internet y vuelve a intentarlo.</p>
        <button class="btn-primary" id="retry" style="max-width:320px">Volver a intentarlo</button>
      </div>`;
    $('#retry').onclick = () => location.reload();
    return;
  }
  if (S.status === 'signedOut') {
    renderLogin(root);
    return;
  }

  renderMain(root);
  const top = stack[stack.length - 1];
  if (top?.live) showTop(false);
}

function renderLogin(root) {
  root.innerHTML = `
    <div class="login">
      <div class="logo">💶</div>
      <h1>Mis cuentas</h1>
      <p>Apunta lo que entra y lo que gastas,<br>y mira cuánto te queda cada mes.</p>
      <button class="btn-primary big" id="signin">Entrar con mi cuenta de Google</button>
      <p class="small">Usa tu Gmail de siempre. No hace falta crear ninguna contraseña.</p>
      <p class="error" id="loginErr" hidden></p>
    </div>`;
  $('#signin').onclick = async () => {
    try {
      await store.signIn();
    } catch (err) {
      console.error(err);
      const e = $('#loginErr');
      e.textContent = 'No se ha podido entrar. Vuelve a intentarlo.';
      e.hidden = false;
    }
  };
}

function card(s, cents) {
  return `
    <button class="card" data-sec="${esc(s.id)}" style="--c:${esc(s.color)}">
      <span class="card-emoji">${esc(s.emoji)}</span>
      <span class="card-name">${esc(s.name)}</span>
      <span class="card-amount">${fmt(cents)}</span>
      <span class="card-hint">Toca para apuntar</span>
    </button>`;
}

function renderMain(root) {
  const t = monthTotals();
  const secs = sortedSections();
  const incomes = secs.filter(isIncome);
  const expenses = secs.filter((s) => !isIncome(s));
  const current = isCurrentMonth();

  const bars = expenses
    .map((s) => ({ s, cents: t.bySection[s.id] || 0 }))
    .filter((x) => x.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const maxBar = bars[0]?.cents || 1;

  root.innerHTML = `
    <header class="topbar">
      <h1>💶 Mis cuentas</h1>
      <button class="btn-ghost" id="menu">⚙️ Opciones</button>
    </header>

    ${S.mode === 'demo' ? '<div class="demo-banner"><strong>Modo prueba:</strong> los datos solo se guardan en este navegador.</div>' : ''}

    <nav class="monthbar" aria-label="Cambiar de mes">
      <button class="round" id="prev" aria-label="Mes anterior">◀</button>
      <div class="month">
        <div class="month-name">${monthName(view.y, view.m)}</div>
        ${current ? '' : '<button class="link" id="today">Volver a este mes</button>'}
      </div>
      <button class="round" id="next" aria-label="Mes siguiente" ${current ? 'disabled' : ''}>▶</button>
    </nav>

    <section class="summary" aria-label="Resumen del mes">
      <div class="row"><span>Ha entrado</span><strong class="pos">${fmt(t.income)}</strong></div>
      <div class="row"><span>He gastado</span><strong class="neg">${fmt(t.spent)}</strong></div>
      <div class="row big ${t.left >= 0 ? 'pos' : 'neg'}">
        <span>${t.left >= 0 ? 'Me queda' : 'Me he pasado'}</span>
        <strong>${fmt(Math.abs(t.left))}</strong>
      </div>
    </section>

    <h2 class="group-title">💰 Lo que entra</h2>
    ${incomes.length
      ? `<div class="grid">${incomes.map((s) => card(s, t.bySection[s.id])).join('')}</div>`
      : '<p class="empty-group">Aún no tienes ninguna sección de dinero que entra.</p>'}

    <h2 class="group-title">🧾 Lo que gasto</h2>
    ${expenses.length
      ? `<div class="grid">${expenses.map((s) => card(s, t.bySection[s.id])).join('')}</div>`
      : '<p class="empty-group">Aún no tienes ninguna sección de gastos.</p>'}

    <button class="btn-dashed" id="newSection">➕ Crear una sección nueva</button>

    <section class="chart">
      <h2>¿En qué se me va el dinero en ${monthOnly(view.y, view.m)}?</h2>
      ${bars.length ? bars.map(({ s, cents }) => `
        <div class="bar-row" style="--c:${esc(s.color)}">
          <div class="bar-label">
            <span>${esc(s.emoji)} ${esc(s.name)}</span>
            <strong>${fmt(cents)} · ${Math.round((cents / t.spent) * 100)}%</strong>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${(cents / maxBar) * 100}%"></div></div>
        </div>`).join('') : '<p class="empty">Todavía no has apuntado gastos este mes.</p>'}
    </section>
  `;

  $('#menu').onclick = () => openSheet(optionsSheet);
  $('#prev').onclick = () => changeMonth(-1);
  $('#next').onclick = () => changeMonth(1);
  if ($('#today')) $('#today').onclick = () => { view.y = new Date().getFullYear(); view.m = new Date().getMonth(); render(); };
  $('#newSection').onclick = () => openSheet(sectionFormSheet(null));
  $$('[data-sec]', root).forEach((b) => {
    b.onclick = () => openSheet(sectionSheet(b.dataset.sec), { live: true });
  });
}

function changeMonth(delta) {
  const d = new Date(view.y, view.m + delta, 1);
  if (d > new Date()) return;
  view.y = d.getFullYear();
  view.m = d.getMonth();
  render();
}

// ---------------------------------------------------------------------------
// Ventana: una sección con sus apuntes del mes
// ---------------------------------------------------------------------------
function sectionSheet(id) {
  return (el) => {
    const s = S.sections.find((x) => x.id === id);
    if (!s) { el.innerHTML = ''; return; }
    const list = monthEntries()
      .filter((e) => e.sectionId === id)
      .sort((a, b) => (b.date.localeCompare(a.date)) || ((b.createdAt || 0) - (a.createdAt || 0)));
    const total = list.reduce((t, e) => t + (e.cents || 0), 0);
    const word = isIncome(s) ? 'ingreso' : 'gasto';

    el.innerHTML = `
      <div class="sheet-head">
        <span class="big-emoji" style="--c:${esc(s.color)}">${esc(s.emoji)}</span>
        <h2>${esc(s.name)}</h2>
        <button class="close" data-close aria-label="Cerrar">✕</button>
      </div>
      <p class="sheet-total">En ${monthOnly(view.y, view.m)} llevas: <strong style="color:${esc(s.color)}">${fmt(total)}</strong></p>

      <button class="btn-primary big" id="add">➕ Apuntar ${word}</button>

      <h3>Lo apuntado en ${monthOnly(view.y, view.m)}</h3>
      ${list.length ? `
        <ul class="entries">
          ${list.map((e) => `
            <li><button class="entry" data-entry="${esc(e.id)}">
              <span class="e-date">${dayLabel(e.date)}</span>
              <span class="e-note ${e.note ? '' : 'none'}">${e.note ? esc(e.note) : 'Sin nota'}</span>
              <span class="e-amt">${fmt(e.cents)}</span>
            </button></li>`).join('')}
        </ul>
        <p class="tip">Si te has equivocado, toca el apunte para cambiarlo o borrarlo.</p>`
        : '<p class="empty">Todavía no hay nada apuntado este mes.</p>'}

      <button class="btn-secondary" id="editSec" style="margin-top:24px">✏️ Cambiar nombre, dibujo o color</button>
    `;

    $('#add', el).onclick = () => openSheet(entrySheet(id, null));
    $('#editSec', el).onclick = () => openSheet(sectionFormSheet(id));
    $$('[data-entry]', el).forEach((b) => { b.onclick = () => openSheet(entrySheet(id, b.dataset.entry)); });
  };
}

// ---------------------------------------------------------------------------
// Ventana: apuntar o cambiar un apunte
// ---------------------------------------------------------------------------
function entrySheet(sectionId, entryId) {
  return (el) => {
    const s = S.sections.find((x) => x.id === sectionId);
    const e = entryId ? S.entries.find((x) => x.id === entryId) : null;
    if (!s) { el.innerHTML = ''; return; }
    const income = isIncome(s);
    const defDate = e?.date || (isCurrentMonth() ? todayStr() : `${monthKey(view.y, view.m)}-01`);
    const amountText = e ? (e.cents / 100).toFixed(2).replace('.', ',') : '';

    el.innerHTML = `
      <div class="sheet-head">
        <span class="big-emoji" style="--c:${esc(s.color)}">${esc(s.emoji)}</span>
        <h2>${e ? 'Cambiar apunte' : `Apuntar en ${esc(s.name)}`}</h2>
        <button class="close" data-close aria-label="Cerrar">✕</button>
      </div>
      <form id="f" novalidate>
        <label class="field">
          <span>¿Cuánto ${income ? 'ha entrado' : 'has gastado'}?</span>
          <div class="money-input">
            <input id="amt" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(amountText)}">
            <span class="euro">€</span>
          </div>
        </label>
        <p class="error" id="err" hidden>Escribe una cantidad. Por ejemplo: 12,50</p>

        <label class="field">
          <span>Nota <small style="font-weight:400">(si quieres)</small></span>
          <input id="note" type="text" maxlength="80" autocomplete="off"
            placeholder="${income ? 'Por ejemplo: nómina' : 'Por ejemplo: Mercadona'}" value="${esc(e?.note || '')}">
        </label>

        <label class="field">
          <span>¿Qué día?</span>
          <input id="date" type="date" value="${esc(defDate)}" max="${todayStr()}">
        </label>

        <button class="btn-primary big" type="submit">✓ Guardar</button>
        <button class="btn-secondary" type="button" data-close>Cancelar</button>
        ${e ? '<button class="btn-danger" type="button" id="del">🗑️ Borrar este apunte</button>' : ''}
      </form>
    `;

    const amt = $('#amt', el);
    if (!e) setTimeout(() => amt.focus(), 250);
    amt.addEventListener('input', () => { $('#err', el).hidden = true; });

    $('#f', el).onsubmit = (ev) => {
      ev.preventDefault();
      const cents = parseAmount(amt.value);
      if (!cents) {
        $('#err', el).hidden = false;
        amt.focus();
        return;
      }
      const date = $('#date', el).value || todayStr();
      const note = $('#note', el).value.trim();
      if (e) store.updateEntry(e.id, { cents, note, date, sectionId });
      else store.addEntry({ cents, note, date, sectionId });

      const [y, m] = date.split('-').map(Number);
      const otherMonth = y !== view.y || m - 1 !== view.m;
      toast(otherMonth ? `✓ Guardado en ${monthName(y, m - 1)}` : `✓ Guardado: ${fmt(cents)}`);
      closeSheet();
    };

    if (e) {
      $('#del', el).onclick = () => openSheet(confirmSheet({
        title: '¿Borrar este apunte?',
        text: `${fmt(e.cents)}${e.note ? ` · ${esc(e.note)}` : ''}<br>${dayLabel(e.date)}`,
        yes: 'Sí, borrarlo',
        onYes: () => {
          store.deleteEntry(e.id);
          toast('🗑️ Apunte borrado');
          closeSheet(2);
        },
      }));
    }
  };
}

// ---------------------------------------------------------------------------
// Ventana: crear o cambiar una sección
// ---------------------------------------------------------------------------
function sectionFormSheet(id) {
  return (el) => {
    const s = id ? S.sections.find((x) => x.id === id) : null;
    const d = {
      name: s?.name || '',
      emoji: s?.emoji || '🛒',
      color: s?.color || COLORS[7],
      type: s?.type || 'gasto',
    };

    el.innerHTML = `
      <div class="sheet-head">
        <h2>${s ? 'Cambiar sección' : 'Nueva sección'}</h2>
        <button class="close" data-close aria-label="Cerrar">✕</button>
      </div>
      <form id="f" novalidate>
        <label class="field">
          <span>¿Cómo se llama?</span>
          <input id="name" type="text" maxlength="30" autocomplete="off" placeholder="Por ejemplo: Farmacia" value="${esc(d.name)}">
        </label>
        <p class="error" id="err" hidden>Escribe un nombre para la sección.</p>

        <div class="field">
          <span class="field-label">¿Es dinero que entra o que sale?</span>
          <div class="toggle">
            <button type="button" data-type="ingreso">💰 Entra<br><small>nómina, pensión…</small></button>
            <button type="button" data-type="gasto">🧾 Sale<br><small>compra, recibos…</small></button>
          </div>
        </div>

        <div class="field">
          <span class="field-label">Elige un dibujo</span>
          <div class="emoji-grid">
            ${EMOJIS.map((em) => `<button type="button" data-emoji="${em}" aria-label="${em}">${em}</button>`).join('')}
          </div>
        </div>

        <div class="field">
          <span class="field-label">Elige un color</span>
          <div class="color-grid">
            ${COLORS.map((c) => `<button type="button" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}
          </div>
        </div>

        <div class="field">
          <span class="field-label">Así se verá:</span>
          <div class="card preview" id="preview"></div>
        </div>

        <button class="btn-primary big" type="submit">✓ Guardar</button>
        <button class="btn-secondary" type="button" data-close>Cancelar</button>
        ${s ? '<button class="btn-danger" type="button" id="del">🗑️ Borrar esta sección</button>' : ''}
      </form>
    `;

    const nameInput = $('#name', el);
    const refresh = () => {
      $$('[data-type]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === d.type)));
      $$('[data-emoji]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.emoji === d.emoji)));
      $$('[data-color]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === d.color)));
      const p = $('#preview', el);
      p.style.setProperty('--c', d.color);
      p.innerHTML = `
        <span class="card-emoji">${esc(d.emoji)}</span>
        <span class="card-name">${esc(nameInput.value.trim() || 'Nombre')}</span>
        <span class="card-amount">${fmt(0)}</span>`;
    };
    refresh();
    if (!s) setTimeout(() => nameInput.focus(), 250);

    nameInput.addEventListener('input', () => { $('#err', el).hidden = true; refresh(); });
    $$('[data-type]', el).forEach((b) => { b.onclick = () => { d.type = b.dataset.type; refresh(); }; });
    $$('[data-emoji]', el).forEach((b) => { b.onclick = () => { d.emoji = b.dataset.emoji; refresh(); }; });
    $$('[data-color]', el).forEach((b) => { b.onclick = () => { d.color = b.dataset.color; refresh(); }; });

    $('#f', el).onsubmit = (ev) => {
      ev.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        $('#err', el).hidden = false;
        nameInput.focus();
        return;
      }
      const data = { name, emoji: d.emoji, color: d.color, type: d.type };
      if (s) store.updateSection(s.id, data);
      else store.addSection(data);
      toast(s ? '✓ Sección cambiada' : `✓ Sección "${name}" creada`);
      closeSheet();
    };

    if (s) {
      $('#del', el).onclick = () => {
        const n = S.entries.filter((e) => e.sectionId === s.id).length;
        openSheet(confirmSheet({
          title: `¿Borrar la sección "${esc(s.name)}"?`,
          text: n
            ? `También se borrarán sus <strong>${n} apunte${n === 1 ? '' : 's'}</strong> (de todos los meses). Esto no se puede deshacer.`
            : 'No tiene ningún apunte.',
          yes: 'Sí, borrar la sección',
          onYes: () => {
            store.deleteSection(s.id);
            toast('🗑️ Sección borrada');
            closeSheet(3);
          },
        }));
      };
    }
  };
}

// ---------------------------------------------------------------------------
// Ventana: confirmar antes de borrar
// ---------------------------------------------------------------------------
function confirmSheet({ title, text, yes, onYes }) {
  return (el) => {
    el.innerHTML = `
      <div class="sheet-head"><h2>${title}</h2></div>
      <p style="font-size:1.05rem">${text}</p>
      <button class="btn-danger solid" id="yes">${yes}</button>
      <button class="btn-secondary" data-close>No, volver atrás</button>
    `;
    $('#yes', el).onclick = onYes;
  };
}

// ---------------------------------------------------------------------------
// Ventana: opciones
// ---------------------------------------------------------------------------
function optionsSheet(el) {
  const demo = S.mode === 'demo';
  const standalone = matchMedia('(display-mode: standalone)').matches;

  el.innerHTML = `
    <div class="sheet-head">
      <h2>Opciones</h2>
      <button class="close" data-close aria-label="Cerrar">✕</button>
    </div>
    <div class="who">
      ${demo
        ? 'Estás en <strong>modo prueba</strong>. Los datos se guardan solo en este navegador.'
        : `Has entrado como<br><strong>${esc(S.user?.name || '')}</strong><br><span style="color:var(--muted)">${esc(S.user?.email || '')}</span>`}
    </div>
    ${installPrompt && !standalone ? '<button class="btn-primary" id="install">📲 Poner la app en la pantalla de inicio</button>' : ''}
    <button class="btn-secondary" id="csv">📥 Descargar mis apuntes (para Excel)</button>
    ${demo && demoRequested ? '<a class="btn-secondary" href="./" style="text-decoration:none">🚪 Salir del modo prueba</a>' : ''}
    ${demo
      ? '<button class="btn-danger" id="reset">🧹 Borrar todos los datos de prueba</button>'
      : '<button class="btn-secondary" id="logout">🚪 Salir de mi cuenta</button>'}
    <button class="btn-secondary" data-close>Cerrar</button>
  `;

  if ($('#install', el)) {
    $('#install', el).onclick = async () => {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      closeSheet();
    };
  }
  $('#csv', el).onclick = downloadCsv;
  if (demo) {
    $('#reset', el).onclick = () => openSheet(confirmSheet({
      title: '¿Borrar todos los datos de prueba?',
      text: 'Se borrarán todas las secciones y apuntes de este navegador.',
      yes: 'Sí, borrar todo',
      onYes: () => store.resetDemo(),
    }));
  } else {
    $('#logout', el).onclick = () => openSheet(confirmSheet({
      title: '¿Salir de tu cuenta?',
      text: 'Tus apuntes no se borran. Para volver a verlos tendrás que entrar otra vez con Google.',
      yes: 'Sí, salir',
      onYes: () => { closeSheet(2); store.signOut(); },
    }));
  }
}

function downloadCsv() {
  const secs = Object.fromEntries(S.sections.map((s) => [s.id, s]));
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Fecha', 'Sección', 'Tipo', 'Cantidad (€)', 'Nota']];
  [...S.entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((e) => {
      const s = secs[e.sectionId];
      rows.push([
        e.date,
        s?.name || '',
        s && isIncome(s) ? 'Ingreso' : 'Gasto',
        (e.cents / 100).toFixed(2).replace('.', ','),
        e.note || '',
      ]);
    });
  const csv = '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mis-cuentas-${todayStr()}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('📥 Archivo descargado');
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});

if (history.state?.sheet) history.replaceState({ sheet: 0 }, '');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Sin modo offline', err));
}

store = await createStore((state) => {
  S = state;
  render();
});
render();
