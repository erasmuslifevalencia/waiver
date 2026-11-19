/**
 * Erasmus Life – Guide app (any trip).
 * Everything is set up in ONE Google Sheet "Erasmus Life – App guides" (created by setupGuides):
 *   TRIPS   one row per trip   (options sheet, tab, header row, option columns, local currency)
 *   BUSES   one row per bus    (trip, bus number, colour, guide name, guide PIN)
 *   EXTRAS  one row per extra  (trip, name, price in €, choices, ask for a day)
 *   CASH    filled by the app  (sales, money in, money out, cancellations)
 *   ATTEND  filled by the app  (attendance lists: who is here / has eaten, sub-groups)
 * A trip's options sheet needs a "Name" column; a "Bus" column (1, 2…) is optional (no column = bus 1).
 */

const G = {
  PROP_SHEET: 'GUIDES_SHEET_ID',
  TRIPS: 'TRIPS', BUSES: 'BUSES', EXTRAS: 'EXTRAS', CASH: 'CASH', ATTEND: 'ATTEND',
  TRIPS_HDR: ['Trip ID', 'Name', 'Dates', 'Options sheet ID', 'Options tab', 'Header row', 'Option columns (comma separated)', 'Active (yes/no)', 'Local currency', 'Local currency per 1 €', 'Deposit buttons € (e.g. 20, 50 – empty = no deposit)'],
  BUSES_HDR: ['Trip ID', 'Bus', 'Colour', 'Guide', 'PIN (4–6 digits)'],
  EXTRAS_HDR: ['Trip ID', 'Extra', 'Price €', 'Choices (comma separated, own price with ":", e.g. Single:40, Double:60)', 'Ask for a day (yes/no)'],
  ATTEND_HDR: ['Trip ID', 'Bus', 'Date', 'List', 'Traveller ID', 'Traveller', 'Present', 'Group', 'Updated', 'By'],
  CASH_HDR: ['Entry ID', 'Created', 'Trip ID', 'Bus', 'Guide', 'Type', 'Traveller ID', 'Traveller', 'Extra', 'Choice', 'For day', 'Description', 'Paid to / from', 'Amount', 'Currency', 'Amount €', 'Status', 'Cancelled'],
};

/* ------------------------------------------------------------------ */
/* Setup (run once from the editor)                                    */
/* ------------------------------------------------------------------ */

function setupGuides() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  if (props.getProperty(G.PROP_SHEET)) {
    ss = SpreadsheetApp.openById(props.getProperty(G.PROP_SHEET));
  } else {
    ss = SpreadsheetApp.create('Erasmus Life – App guides');
    props.setProperty(G.PROP_SHEET, ss.getId());
  }
  const pin = () => String(Math.floor(1000 + Math.random() * 9000));
  const tab = (name, hdr, rows) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold').setBackground('#F3E6EE');
      sh.setFrozenRows(1);
      if (rows && rows.length) sh.getRange(2, 1, rows.length, hdr.length).setValues(rows);
      sh.autoResizeColumns(1, hdr.length);
    }
    return sh;
  };
  tab(G.TRIPS, G.TRIPS_HDR, [
    ['MOROCCO-DEC26', 'Morocco', '4–13 Dec 2026', '1wSlxuRyMCjFyK112mm5X6F8Xpz2tiTDvU1HsY59u4k0', 'DEC2026', 3,
      'Food pack, Mosque, 4X4, SIM card, Seguro: Seguro Basic | Seguro Student | Seguro Gold', 'yes', 'MAD', 10],
    ['PORTUGAL-DEC26', 'Portugal', 'Dec 2026', '19nfHSwGUjru3e7JJoTIQhFU5pRcrvi8LvMcddk-YETQ', 'DEC2026', 3,
      'Castle Sao Jorge, Sintra day excursion, Pubcrawl, Boat tour', 'yes', '', ''],
  ]);
  tab(G.BUSES, G.BUSES_HDR, [
    ['MOROCCO-DEC26', 1, 'Red', 'Eszter', pin()],
    ['MOROCCO-DEC26', 2, 'Blue', 'Taoufik', pin()],
    ['PORTUGAL-DEC26', 1, '', 'Guide Portugal', pin()],
  ]);
  tab(G.EXTRAS, G.EXTRAS_HDR, [
    ['MOROCCO-DEC26', 'Desert lunch', 5, 'Chicken, Kefta, Omelette, Veggie', 'yes'],
    ['MOROCCO-DEC26', 'Todgha lunch', 12, 'Classic, Veggie', 'no'],
    ['MOROCCO-DEC26', 'Quad', 40, 'Single:40, Double:60', 'no'],
  ]);
  tab(G.CASH, G.CASH_HDR, []);
  ['Sheet1', 'Feuille 1', 'Hoja 1'].forEach(n => { const s = ss.getSheetByName(n); if (s && ss.getSheets().length > 1) ss.deleteSheet(s); });
  if (!props.getProperty('ADMIN_KEY')) props.setProperty('ADMIN_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 16));
  Logger.log('Guide app sheet: ' + ss.getUrl());
  Logger.log('Office page = https://erasmuslifevalencia.github.io/waiver/office.html#' + props.getProperty('ADMIN_KEY'));
}

/* ------------------------------------------------------------------ */
/* API router                                                          */
/* ------------------------------------------------------------------ */

function guideApi_(b) {
  switch (b.action) {
    case 'g_login': return gLogin_(b.pin);
    case 'g_data': return gData_(gAuth_(b.pin));
    case 'g_add': return gAdd_(gAuth_(b.pin), b.entries || []);
    case 'g_cancel': return gCancel_(gAuth_(b.pin), b.id);
    case 'g_marks': return gMarks_(gAuth_(b.pin), b.marks || []);
    case 'o_trips': checkAdmin_(b.key); return { ok: true, trips: gTrips_().map(t => ({ id: t.id, name: t.name, dates: t.dates, active: t.active })) };
    case 'o_data': checkAdmin_(b.key); return gData_({ trip: b.trip, bus: null, guide: 'Office' });
    default: return { ok: false, error: 'unknown action' };
  }
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

function gBook_() {
  let id = PropertiesService.getScriptProperties().getProperty(G.PROP_SHEET);
  if (!id) { setupGuides(); id = PropertiesService.getScriptProperties().getProperty(G.PROP_SHEET); }
  return SpreadsheetApp.openById(id);
}

function gRows_(name) {
  const sh = gBook_().getSheetByName(name);
  const v = sh.getDataRange().getDisplayValues();
  return v.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
}

const yes_ = s => /^(y|yes|si|sí|oui|1|true|x)$/i.test(String(s || '').trim());
const list_ = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const num_ = s => { const n = parseFloat(String(s || '').replace(/[^\d,.-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };

function gTrips_() {
  return gRows_(G.TRIPS).map(r => ({
    id: r[0].trim(), name: r[1].trim(), dates: r[2].trim(), sheetId: r[3].trim(), tab: r[4].trim(),
    headerRow: parseInt(r[5], 10) || 1, optionDefs: optionDefs_(r[6]), active: yes_(r[7]),
    localCur: r[8].trim(), rate: num_(r[9]), depositAmounts: depAmounts_(r[10]),
  })).map(t => Object.assign(t, { deposit: t.depositAmounts[0] || 0 }));
}

/** "20, 50" or "20 / 50" → [20, 50] (the buttons a guide taps when collecting deposits). */
function depAmounts_(s) {
  return String(s || '').split(/[,;\/|]/).map(x => num_(x)).filter(n => n > 0).slice(0, 4);
}

/** "Food pack, Seguro: Seguro Basic | Seguro Gold" → [{label:'Food pack', cols:['Food pack']}, {label:'Seguro', cols:[…]}] */
function optionDefs_(s) {
  return list_(s).map(x => {
    const i = x.indexOf(':');
    if (i < 0) return { label: x, cols: [x] };
    return { label: x.slice(0, i).trim(), cols: x.slice(i + 1).split('|').map(c => c.trim()).filter(Boolean) };
  });
}

/** "Single:40, Double:60" → names + own prices */
function choiceDefs_(s, base) {
  const names = [], prices = {};
  list_(s).forEach(x => {
    const i = x.lastIndexOf(':');
    const n = (i < 0 ? x : x.slice(0, i)).trim();
    names.push(n);
    prices[n] = i < 0 ? base : num_(x.slice(i + 1));
  });
  return { names: names, prices: prices };
}

function gTrip_(id) {
  const t = gTrips_().find(x => x.id === id);
  if (!t) throw new Error('Trip not found: ' + id);
  t.buses = gRows_(G.BUSES).filter(r => r[0].trim() === id)
    .map(r => ({ bus: String(r[1]).trim(), colour: r[2].trim(), guide: r[3].trim() }));
  t.extras = gRows_(G.EXTRAS).filter(r => r[0].trim() === id)
    .map(r => { const c = choiceDefs_(r[3], num_(r[2])); return { name: r[1].trim(), price: num_(r[2]), choices: c.names, prices: c.prices, askDay: yes_(r[4]) }; });
  t.optionCols = t.optionDefs.map(d => d.label);
  return t;
}

/** PIN → {trip, bus, guide}. Wrong PINs are rate-limited. */
function gAuth_(pin) {
  pin = String(pin || '').replace(/\D/g, '');
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('gfail') || 0);
  if (fails > 30) throw new Error('blocked');
  const row = gRows_(G.BUSES).find(r => String(r[4]).replace(/\D/g, '') === pin && pin.length >= 4);
  if (!row) { cache.put('gfail', String(fails + 1), 600); throw new Error('pin'); }
  const trip = gTrips_().find(t => t.id === row[0].trim());
  if (!trip || !trip.active) throw new Error('inactive');
  return { trip: trip.id, bus: String(row[1]).trim(), guide: row[3].trim() };
}

function gLogin_(pin) {
  try {
    const s = gAuth_(pin);
    return { ok: true, session: s };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

/** Travellers of a trip from its options sheet: [{id, name, bus, options:[…]}] */
function gTravellers_(t) {
  const sh = SpreadsheetApp.openById(t.sheetId).getSheetByName(t.tab);
  if (!sh) throw new Error('Options tab not found for ' + t.id);
  return parseTravellers_(sh.getDataRange().getDisplayValues(), t.headerRow, t.optionDefs);
}

/** Pure function (tested). */
function parseTravellers_(values, headerRow, defs) {
  const hdr = values[headerRow - 1].map(h => String(h).trim());
  const iName = hdr.indexOf('Name'), iEnr = hdr.indexOf('Enr'), iBus = hdr.indexOf('Bus');
  if (iName < 0) throw new Error('No "Name" column in the options sheet');
  const iOpt = defs.map(d => d.cols.map(c => ({ c: c, i: hdr.indexOf(c) })).filter(x => x.i >= 0));
  const out = [];
  for (let r = headerRow; r < values.length; r++) {
    const row = values[r];
    const name = String(row[iName] || '').replace(/\s+/g, ' ').trim();
    if (!name || /cancel/i.test(name)) continue;
    const id = iEnr >= 0 && String(row[iEnr] || '').trim() ? String(row[iEnr]).trim() : 'R' + (r + 1);
    const busRaw = iBus >= 0 ? String(row[iBus] || '').trim() : '1';
    const options = [], detail = {};
    defs.forEach((d, k) => {
      const hit = iOpt[k].filter(x => String(row[x.i] || '').trim() !== '').map(x => x.c);
      if (hit.length) {
        options.push(d.label);
        if (d.cols.length > 1) detail[d.label] = hit.map(h => h.replace(d.label, '').trim() || h).join(' + ');
      }
    });
    out.push({ id: id, name: name, bus: (busRaw.match(/\d+/) || [''])[0], options: options, detail: detail });
  }
  return out;
}

function gEntries_(tripId) {
  return gRows_(G.CASH).filter(r => r[2] === tripId).map(r => ({
    id: r[0], created: r[1], bus: String(r[3]), guide: r[4], type: r[5], travellerId: r[6], traveller: r[7],
    extra: r[8], choice: r[9], day: r[10], description: r[11], party: r[12],
    amount: num_(r[13]), currency: r[14], eur: num_(r[15]), status: r[16], cancelled: r[17],
  }));
}

function gData_(s) {
  const t = gTrip_(s.trip);
  return {
    ok: true,
    session: s,
    trip: { id: t.id, name: t.name, dates: t.dates, buses: t.buses, extras: t.extras, optionCols: t.optionCols,
      localCur: t.localCur, rate: t.rate, deposit: t.deposit, depositAmounts: t.depositAmounts },
    travellers: gTravellers_(t),
    entries: gEntries_(t.id),
    attend: gAttend_(t.id, s.bus),
    serverTime: Utilities.formatDate(new Date(), 'Europe/Madrid', "yyyy-MM-dd'T'HH:mm:ss"),
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/** Adds entries (sales, money in/out). Each entry carries a client-made id, so an offline retry never doubles it. */
function gAdd_(s, entries) {
  const t = gTrip_(s.trip);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = gBook_().getSheetByName(G.CASH);
    const known = new Set(sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(r => String(r[0])));
    const rows = [], saved = [];
    entries.forEach(e => {
      const id = String(e.id || '').slice(0, 40);
      if (!id || known.has(id)) { saved.push(id); return; }
      const row = gEntryRow_(e, s, t);
      if (row) { rows.push(row); saved.push(id); known.add(id); }
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, G.CASH_HDR.length).setValues(rows);
    return { ok: true, saved: saved };
  } finally {
    lock.releaseLock();
  }
}

/** Pure-ish: validates an entry and returns the CASH row, or null. Prices of extras come from the EXTRAS tab, never from the phone. */
function gEntryRow_(e, s, t) {
  const created = String(e.created || '').slice(0, 19) || Utilities.formatDate(new Date(), 'Europe/Madrid', "yyyy-MM-dd'T'HH:mm:ss");
  const clean = v => String(v == null ? '' : v).replace(/^[=+\-@]/, "'$&").slice(0, 200);
  if (e.type === 'SALE') {
    const x = t.extras.find(z => z.name === e.extra);
    if (!x) return null;
    const choice = x.choices.length ? (x.choices.indexOf(e.choice) >= 0 ? e.choice : '') : '';
    if (x.choices.length && !choice) return null;
    const price = choice && x.prices && x.prices[choice] != null ? x.prices[choice] : x.price;
    return [e.id, created, t.id, s.bus, s.guide, 'SALE', clean(e.travellerId), clean(e.traveller), x.name, choice,
      x.askDay ? clean(e.day) : '', '', '', price, 'EUR', price, 'OK', ''];
  }
  if (/^DEP_(IN|RET|HOTEL|BACK|KEPT)$/.test(e.type)) {
    const v = Math.round(num_(e.amount) * 100) / 100;
    const perPerson = /^DEP_(IN|RET|KEPT)$/.test(e.type);
    if (perPerson && !e.travellerId) return null;
    if (e.type !== 'DEP_RET' && (v < 0 || (v === 0 && e.type !== 'DEP_BACK'))) return null;
    return [e.id, created, t.id, s.bus, s.guide, e.type, perPerson ? clean(e.travellerId) : '', perPerson ? clean(e.traveller) : '', '', '', '',
      clean(e.description), clean(e.party), v, 'EUR', v, 'OK', ''];
  }
  if (e.type === 'IN' || e.type === 'OUT') {
    const amount = Math.abs(num_(e.amount));
    if (!amount) return null;
    const local = t.localCur && e.currency === t.localCur && t.rate > 0;
    const eur = local ? Math.round((amount / t.rate) * 100) / 100 : amount;
    return [e.id, created, t.id, s.bus, s.guide, e.type, '', '', '', '', '', clean(e.description), clean(e.party),
      amount, local ? t.localCur : 'EUR', eur, 'OK', ''];
  }
  return null;
}

/** A guide cancels one of HIS bus's entries: kept, marked CANCELLED. */
function gCancel_(s, id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = gBook_().getSheetByName(G.CASH);
    const v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      if (String(v[i][0]) === String(id)) {
        if (v[i][2] !== s.trip || String(v[i][3]) !== String(s.bus)) return { ok: false, error: 'not yours' };
        if (v[i][16] !== 'CANCELLED') {
          sh.getRange(i + 1, 17, 1, 2).setValues([['CANCELLED',
            Utilities.formatDate(new Date(), 'Europe/Madrid', 'dd/MM HH:mm') + ' by ' + s.guide]]);
        }
        return { ok: true };
      }
    }
    return { ok: false, error: 'not found' };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Attendance lists (ATTEND tab)                                       */
/* ------------------------------------------------------------------ */

function gAttSheet_() {
  const ss = gBook_();
  let sh = ss.getSheetByName(G.ATTEND);
  if (!sh) {
    sh = ss.insertSheet(G.ATTEND);
    sh.getRange(1, 1, 1000, G.ATTEND_HDR.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, G.ATTEND_HDR.length).setValues([G.ATTEND_HDR]).setFontWeight('bold').setBackground('#F3E6EE');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Marks of a trip (one bus, or all buses when bus is null). */
function gAttend_(tripId, bus) {
  const sh = gBook_().getSheetByName(G.ATTEND);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, G.ATTEND_HDR.length).getDisplayValues()
    .filter(r => r[0] === tripId && (!bus || String(r[1]) === String(bus)))
    .map(r => ({ d: r[2], l: r[3], t: r[4], p: r[6] === 'yes' ? 1 : 0, g: parseInt(r[7], 10) || 0, ts: Number(r[8]) || 0 }));
}

/** Saves the latest state of each mark (date + list + traveller). An older state never overwrites a newer one. */
function gMarks_(s, marks) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = gAttSheet_();
    const n = Math.max(sh.getLastRow() - 1, 0);
    const v = n ? sh.getRange(2, 1, n, G.ATTEND_HDR.length).getDisplayValues() : [];
    const idx = {};
    v.forEach((r, i) => { idx[[r[0], r[1], r[2], r[3], r[4]].join('|')] = i; });
    const clean = (x, max) => String(x == null ? '' : x).replace(/^[=+\-@]/, "'$&").slice(0, max);
    const saved = [], add = [], upd = {};
    marks.slice(0, 2000).forEach(m => {
      const d = String(m.d || ''), l = clean(m.l, 60), t = clean(m.t, 40), ts = Number(m.ts) || 0;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !l || !t || !ts) return;
      const row = [s.trip, String(s.bus), d, l, t, clean(m.n, 80), m.p ? 'yes' : '', String(Math.max(0, Math.min(20, parseInt(m.g, 10) || 0)) || ''),
        String(ts), s.guide];
      const key = row.slice(0, 5).join('|');
      if (key in idx) {
        const i = idx[key];
        if ((Number(v[i][8]) || 0) <= ts) { v[i] = row; upd[i] = 1; }
      } else { idx[key] = v.length + add.length; add.push(row); }
      saved.push({ d: d, l: m.l, t: m.t, ts: ts });
    });
    Object.keys(upd).forEach(i => sh.getRange(Number(i) + 2, 1, 1, G.ATTEND_HDR.length).setValues([v[i]]));
    if (add.length) {
      const r0 = sh.getLastRow() + 1;
      sh.getRange(r0, 1, add.length, G.ATTEND_HDR.length).setNumberFormat('@').setValues(add);
    }
    return { ok: true, saved: saved };
  } finally {
    lock.releaseLock();
  }
}
