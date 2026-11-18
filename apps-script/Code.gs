/**
 * Erasmus Life – Trip check & online waiver (Morocco Dec 2026)
 * One public link: participant searches their name → confirms their passport number →
 * sees their trip (options, insurance, bus, payment) → signs the right waiver.
 * A signed PDF is saved to Drive and logged in the WAIVERS tab.
 */

const CONFIG = {
  TRIP_ES: 'Viaje a Marruecos',
  TRIP_EN: 'Morocco Trip',
  TRIP_DATES: '04/12/2026 – 13/12/2026',

  // Sheet with options / insurance / payments (master list of participants)
  OPTIONS_SHEET_ID: '1wSlxuRyMCjFyK112mm5X6F8Xpz2tiTDvU1HsY59u4k0',
  OPTIONS_TAB: 'DEC2026',
  OPTIONS_HEADER_ROW: 3,
  INSURANCE_COLUMNS: ['Seguro Basic', 'Seguro Student', 'Seguro Gold'],
  OPTION_COLUMNS: ['Food pack', 'Mosque', '4X4', 'SIM card'],

  // Sheet with personal info (passport, phone, bus…)
  INFO_SHEET_ID: '1GI4TDfe1tU19IXlSc8vxXtiPcTJ5m2cJ8-1dCgq__Jc',
  INFO_TAB_GID: 1921456608,

  // Where signatures are logged (tab created in the OPTIONS spreadsheet)
  LOG_TAB: 'WAIVERS',
  PDF_FOLDER_NAME: 'Morocco Dec 2026 – Signed waivers',

  // Legal identity shown in the waiver
  ORGANIZER: 'HOLA TRIP (agencia de viajes CV-m20-22V), marca de HOME TRIP & SERVICES S.L., CIF B98890767',
  ORGANIZER_EN: 'HOLA TRIP (travel agency CV-m20-22V), a brand of HOME TRIP & SERVICES S.L., CIF B98890767',
  BRAND: 'Erasmus Life',
  INSURER: 'INNOVAC',
  PRIVACY_EMAIL: 'vlc.erasmuslife@gmail.com', // ← check: contact for data-protection requests

  // "Something wrong?" button – WhatsApp number in international format without + (empty = button hidden)
  CONTACT_WHATSAPP: '',

  // Insurance can still be added until this date (YYYY-MM-DD, inclusive)
  INSURANCE_DEADLINE: '2026-11-26',

  // Waiver signing switch. While false, people can still check their trip.
  SIGNING_OPEN: false,
  SIGNING_OPENS_ES: '27 de noviembre',
  SIGNING_OPENS_EN: '27 November',

  // Manual fixes when the options sheet name differs from the personal-info form (form name prevails)
  // Keep real values ONLY in the private Apps Script project (this repo is public): { '36': { name: '…', phone: '+…' } }
  OVERRIDES: {},

  // Fake participants to try the flow. Empty this list before going live.
  TEST_PARTICIPANTS: [],

  MAX_ATTEMPTS: 5,       // wrong passport attempts per participant before a 15 min block
};

/* ------------------------------------------------------------------ */
/* Web entry points                                                    */
/* ------------------------------------------------------------------ */

/** Health check (opening the script URL in a browser). */
function doGet() {
  return json_({ ok: true, app: 'waivers', trip: CONFIG.TRIP_EN });
}

/**
 * JSON API used by the GitHub Pages front-end.
 * The page sends POST with a text/plain JSON body (no CORS preflight).
 */
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    switch (b.action) {
      case 'config': return json_(publicConfig_());
      case 'search': return json_(apiSearch(b.q));
      case 'verify': return json_(apiVerify(b.enr, b.passport));
      case 'submit': return json_(apiSubmit(b.token, b.form));
      case 'adminList': return json_(apiAdminList(b.key));
      case 'adminReset': return json_(apiAdminReset(b.key, b.enr));
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function publicConfig_() {
  return {
    trip: CONFIG.TRIP_EN, tripEs: CONFIG.TRIP_ES, dates: CONFIG.TRIP_DATES,
    signingOpen: CONFIG.SIGNING_OPEN, opensEn: CONFIG.SIGNING_OPENS_EN, opensEs: CONFIG.SIGNING_OPENS_ES,
    contact: CONFIG.CONTACT_WHATSAPP,
  };
}

/** Run once from the editor: creates the log tab, the Drive folder and the admin key. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  getLogSheet_();
  if (!props.getProperty('FOLDER_ID')) {
    props.setProperty('FOLDER_ID', DriveApp.createFolder(CONFIG.PDF_FOLDER_NAME).getId());
  }
  if (!props.getProperty('ADMIN_KEY')) {
    props.setProperty('ADMIN_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 16));
  }
  Logger.log('Admin page = https://erasmuslifevalencia.github.io/waiver/admin.html#' + props.getProperty('ADMIN_KEY'));
  Logger.log('PDF folder: https://drive.google.com/drive/folders/' + props.getProperty('FOLDER_ID'));
  Logger.log(matchReport());
}

/** Lists participants with no personal-info row / passport (they cannot verify online). */
function matchReport() {
  const parts = getParticipants_(true);
  const info = getInfoRows_();
  const missing = parts.filter(p => !(infoFor_(p, info) || {}).passport);
  return 'Participants: ' + parts.length + ' – without passport on file: ' + missing.length +
    (missing.length ? '\n  ' + missing.map(p => '#' + p.enr + ' ' + p.name).join('\n  ') : '');
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function apiSearch(query) {
  const q = normalize_(query).trim();
  if (q.length < 3) return { results: [] };
  const qTokens = q.split(' ').filter(Boolean);
  const results = getParticipants_(false)
    .filter(p => {
      const toks = normalize_(p.name).split(' ');
      return qTokens.every(qt => toks.some(t => t.indexOf(qt) === 0));
    })
    .slice(0, 8)
    .map(p => ({ enr: p.enr, name: p.name }));
  return { results: results };
}

function apiVerify(enr, passport) {
  enr = String(enr);
  const cache = CacheService.getScriptCache();
  const attemptsKey = 'att_' + enr;
  const attempts = Number(cache.get(attemptsKey) || 0);
  if (attempts >= CONFIG.MAX_ATTEMPTS) return { ok: false, error: 'blocked' };

  const p = getParticipants_(true).find(x => x.enr === enr);
  if (!p) return { ok: false, error: 'notfound' };
  const info = infoFor_(p, getInfoRows_());
  if (!info || !info.passport) return { ok: false, error: 'nodata' };
  if (passportKey_(passport) !== passportKey_(info.passport)) {
    cache.put(attemptsKey, String(attempts + 1), 900);
    return { ok: false, error: 'passport', left: CONFIG.MAX_ATTEMPTS - attempts - 1 };
  }
  cache.remove(attemptsKey);

  const version = p.insurances.length ? 'CON' : 'SIN';
  const signed = getSignedMap_()[enr] || null;
  const token = Utilities.getUuid();
  cache.put('tok_' + token, JSON.stringify({ enr: enr }), 1800);
  return {
    ok: true,
    token: token,
    trip: tripView_(p, info, new Date()),
    signing: {
      open: CONFIG.SIGNING_OPEN,
      signedAt: signed ? signed.at : '',
      needsResign: !!(signed && signed.version !== version),
      version: version,
      prefill: { dob: toIsoDate_(info.dob), passport: info.passport.trim().toUpperCase() },
      texts: { es: waiverText_(version, 'es', p.insurances), en: waiverText_(version, 'en', p.insurances) },
    },
  };
}

/** Pure function (tested): what the participant sees about their trip. */
function tripView_(p, info, now) {
  const deadline = new Date(CONFIG.INSURANCE_DEADLINE + 'T23:59:59');
  return {
    name: p.name,
    bus: info.bus || '',
    departure: info.departure || '',
    options: CONFIG.OPTION_COLUMNS.map(c => ({ key: c, taken: p.options.indexOf(c) >= 0 })),
    insurances: p.insurances,
    insuranceStillPossible: now <= deadline,
    insuranceDeadline: CONFIG.INSURANCE_DEADLINE,
    paid: p.status.toUpperCase() === 'PAID' && moneyValue_(p.balance) <= 0,
    balance: moneyValue_(p.balance) > 0 ? p.balance : '',
  };
}

function apiSubmit(token, form) {
  if (!CONFIG.SIGNING_OPEN) return { ok: false, error: 'closed' };
  const cache = CacheService.getScriptCache();
  const raw = cache.get('tok_' + token);
  if (!raw) return { ok: false, error: 'expired' };
  const sess = JSON.parse(raw);

  const err = validateForm_(form);
  if (err) return { ok: false, error: err };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (getSignedMap_()[sess.enr]) return { ok: false, error: 'already' };
    const p = getParticipants_(true).find(x => x.enr === sess.enr);
    if (!p) return { ok: false, error: 'notfound' };
    const version = p.insurances.length ? 'CON' : 'SIN';
    const now = new Date();
    const pdf = buildPdf_(p, version, form, now);
    const file = getFolder_().createFile(pdf);
    getLogSheet_().appendRow([
      now, p.enr, p.name, version, p.insurances.join(' + ') || '—',
      form.fullName.trim(), form.dob, "'" + form.passport.trim().toUpperCase(),
      form.lang, 'PASSPORT', file.getUrl(), 'VALID',
    ]);
    cache.remove('tok_' + token);
    return { ok: true, signedAt: Utilities.formatDate(now, 'Europe/Madrid', 'dd/MM/yyyy HH:mm') };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Admin API                                                           */
/* ------------------------------------------------------------------ */

function apiAdminList(key) {
  checkAdmin_(key);
  const parts = getParticipants_(true);
  const info = getInfoRows_();
  const signed = getSignedMap_();
  const rows = parts.map(p => {
    const s = signed[p.enr];
    const nowVersion = p.insurances.length ? 'CON' : 'SIN';
    let status = 'NOT SIGNED';
    if (s) status = s.version !== nowVersion ? 'RE-SIGN (insurance changed)' : 'SIGNED';
    const inf = infoFor_(p, info) || {};
    return {
      enr: p.enr, name: p.name, version: nowVersion, insurances: p.insurances.join(' + '),
      status: status, signedAt: s ? s.at : '', verified: s ? s.verified : '',
      pdf: s ? s.pdf : '', hasPhone: !!inf.passport, bus: inf.bus || '',
    };
  });
  return { rows: rows };
}

function apiAdminReset(key, enr) {
  checkAdmin_(key);
  const sh = getLogSheet_();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(enr) && data[i][11] === 'VALID') {
      sh.getRange(i + 1, 12).setValue('RESET ' + Utilities.formatDate(new Date(), 'Europe/Madrid', 'dd/MM HH:mm'));
    }
  }
  CacheService.getScriptCache().remove('att_' + enr);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

function getParticipants_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) {
    const c = cache.get('participants');
    if (c) return JSON.parse(c);
  }
  const sh = SpreadsheetApp.openById(CONFIG.OPTIONS_SHEET_ID).getSheetByName(CONFIG.OPTIONS_TAB);
  const values = sh.getDataRange().getDisplayValues();
  const list = applyOverrides_(parseParticipants_(values, CONFIG.OPTIONS_HEADER_ROW, CONFIG.INSURANCE_COLUMNS,
    CONFIG.OPTION_COLUMNS), CONFIG.OVERRIDES)
    .concat(CONFIG.TEST_PARTICIPANTS || []);
  cache.put('participants', JSON.stringify(list), 120);
  return list;
}

/** Pure function (tested): rows of display values → participants. */
function parseParticipants_(values, headerRow, insuranceCols, optionCols) {
  const hdr = values[headerRow - 1].map(h => String(h).trim());
  const col = name => hdr.indexOf(name);
  const iEnr = col('Enr'), iName = col('Name');
  const iIns = insuranceCols.map(col), iOpt = (optionCols || []).map(col);
  const iBal = col('Balance'), iStatus = col('Status');
  if (iEnr < 0 || iName < 0 || iIns.some(i => i < 0) || iOpt.some(i => i < 0)) {
    throw new Error('Options sheet: header not found');
  }
  const out = [];
  for (let r = headerRow; r < values.length; r++) {
    const row = values[r];
    const enr = String(row[iEnr] || '').trim();
    const name = String(row[iName] || '').trim();
    if (!/^\d+$/.test(enr) || !name || /cancel/i.test(name)) continue;
    const ticked = i => String(row[i] || '').trim() !== '';
    out.push({
      enr: enr,
      name: name,
      insurances: insuranceCols.filter((c, k) => ticked(iIns[k])).map(c => c.replace(/^Seguro\s+/i, '')),
      options: (optionCols || []).filter((c, k) => ticked(iOpt[k])),
      balance: iBal >= 0 ? String(row[iBal] || '').trim() : '',
      status: iStatus >= 0 ? String(row[iStatus] || '').trim() : '',
    });
  }
  return out;
}

/** Pure function (tested): apply manual name / phone fixes by booking number. */
function applyOverrides_(list, overrides) {
  return list.map(p => {
    const o = (overrides || {})[p.enr];
    return o ? Object.assign({}, p, { name: o.name || p.name, phone: o.phone || '' }) : p;
  });
}

function getInfoRows_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('info');
  if (c) return JSON.parse(c);
  const ss = SpreadsheetApp.openById(CONFIG.INFO_SHEET_ID);
  const sh = ss.getSheets().find(s => s.getSheetId() === CONFIG.INFO_TAB_GID) || ss.getSheets()[0];
  const rows = parseInfo_(sh.getDataRange().getDisplayValues());
  cache.put('info', JSON.stringify(rows), 300);
  return rows;
}

/** Pure function (tested): form responses → [{last, first, phone, passport, dob, departure, bus}] */
function parseInfo_(values) {
  const hdr = values[0].map(String);
  const find = re => hdr.findIndex(h => re.test(h));
  const iL = find(/^last name/i), iF = find(/^first name/i), iP = find(/whatsapp/i);
  const iPass = find(/^passport number/i), iDob = find(/^date of birth/i);
  const iDep = find(/departure and return city/i), iBus = find(/^bus$/i);
  if (iL < 0 || iF < 0 || iP < 0) throw new Error('Info sheet: header not found');
  const v = (r, i) => (i >= 0 ? String(r[i] || '').trim() : '');
  // later answers win (people sometimes fill the form twice)
  return values.slice(1)
    .filter(r => v(r, iL) || v(r, iF))
    .map(r => ({
      last: v(r, iL), first: v(r, iF), phone: v(r, iP), passport: v(r, iPass), dob: v(r, iDob),
      departure: v(r, iDep), bus: v(r, iBus),
    }))
    .reverse();
}

/** Personal-info row of a participant: manual phone override first, otherwise fuzzy name match. */
function infoFor_(p, info) {
  if (p.phone) {
    const d = p.phone.replace(/\D/g, '');
    const hit = info.find(r => r.phone.replace(/\D/g, '') === d);
    if (hit) return hit;
  }
  return findInfo_(p.name, info);
}

/**
 * Pure function (tested): find the personal-info row of a participant by fuzzy name match.
 * Returns the row only if exactly one person matches best (otherwise null).
 */
function findInfo_(name, info) {
  const n = normalize_(name).split(' ').filter(Boolean);
  const scored = info.map(r => ({ r: r, s: nameScore_(n, normalize_(r.last).split(' ').filter(Boolean),
    normalize_(r.first).split(' ').filter(Boolean)) }))
    .filter(x => x.s >= 2);
  if (!scored.length) return null;
  scored.sort((a, b) => b.s - a.s);
  const best = scored.filter(x => x.s === scored[0].s);
  const distinct = best.filter((x, i) => best.findIndex(y => passportKey_(y.r.passport) === passportKey_(x.r.passport)) === i);
  return distinct.length === 1 ? best[0].r : null;
}

function nameScore_(nameTokens, lastTokens, firstTokens) {
  const close = (a, b) => {
    if (a === b) return true;
    const min = Math.min(a.length, b.length);
    if (min < 4) return false;
    return levenshtein_(a, b) <= (min >= 7 ? 2 : 1);
  };
  const lastHit = nameTokens.some(t => lastTokens.some(l => close(t, l)));
  const firstHit = nameTokens.some(t => firstTokens.some(f => close(t, f)));
  const initialHit = nameTokens.some(t => firstTokens.some(f => t[0] === f[0]));
  if (lastHit && firstHit) return 3;
  if (lastHit && initialHit) return 2;
  return 0;
}

function levenshtein_(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function normalize_(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/ł/g, 'l')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Passport comparison key: uppercase, no spaces/dashes, letter O treated as zero. */
function passportKey_(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0');
}

function moneyValue_(s) {
  let t = String(s || '').replace(/[^\d,.-]/g, '');
  const dec = t.match(/[.,](\d{1,2})$/);
  t = (dec ? t.slice(0, -dec[0].length) : t).replace(/[.,]/g, '') + (dec ? '.' + dec[1] : '');
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

/** dd/mm/yyyy → yyyy-mm-dd (for the date input); anything else → '' */
function toIsoDate_(s) {
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
}

/* ------------------------------------------------------------------ */
/* Log, folder, PDF                                                    */
/* ------------------------------------------------------------------ */

const LOG_HEADERS = ['Timestamp', 'Enr', 'Name (sheet)', 'Version', 'Insurance', 'Signed as',
  'Date of birth', 'Passport', 'Language', 'Verified by', 'PDF', 'Status'];

function getLogSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.OPTIONS_SHEET_ID);
  let sh = ss.getSheetByName(CONFIG.LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.LOG_TAB);
    sh.appendRow(LOG_HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

/** enr → {version, at, pdf, verified} for VALID signatures */
function getSignedMap_() {
  const data = getLogSheet_().getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][11] !== 'VALID') continue;
    map[String(data[i][1])] = {
      version: data[i][3],
      at: Utilities.formatDate(new Date(data[i][0]), 'Europe/Madrid', 'dd/MM/yyyy HH:mm'),
      pdf: data[i][10], verified: data[i][9],
    };
  }
  return map;
}

function getFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!id) throw new Error('Run setup() first');
  return DriveApp.getFolderById(id);
}

function getAdminKey_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '__not_set__';
}

function checkAdmin_(key) {
  if (!key || key !== getAdminKey_()) throw new Error('Not allowed');
}

function validateForm_(f) {
  if (!f) return 'form';
  if (!f.accept) return 'accept';
  if (!f.fullName || f.fullName.trim().length < 3) return 'fullName';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dob || '')) return 'dob';
  if (!f.passport || f.passport.trim().length < 5) return 'passport';
  if (!/^data:image\/png;base64,/.test(f.signature || '') || f.signature.length < 2000) return 'signature';
  if (['es', 'en'].indexOf(f.lang) < 0) return 'lang';
  return null;
}

function buildPdf_(p, version, form, when) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = Utilities.formatDate(when, 'Europe/Madrid', "dd/MM/yyyy HH:mm:ss 'CET'");
  const dob = form.dob.split('-').reverse().join('/');
  const block = (lang) => {
    const t = waiverText_(version, lang, p.insurances);
    return '<h2>' + esc(t.title) + '</h2>' + t.paragraphs.map(x => '<p>' + esc(x) + '</p>').join('');
  };
  const html =
    '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.35;color:#111}' +
    'h1{font-size:14pt;margin:0 0 4px}h2{font-size:11.5pt;margin:18px 0 6px}' +
    'table{border-collapse:collapse;margin:8px 0}td{padding:3px 10px 3px 0;vertical-align:top}' +
    '.box{border:1px solid #999;padding:10px;margin-top:14px}.small{font-size:8.5pt;color:#555}' +
    '</style></head><body>' +
    '<h1>' + esc(CONFIG.TRIP_ES + ' / ' + CONFIG.TRIP_EN + ' – ' + CONFIG.TRIP_DATES) + '</h1>' +
    '<table>' +
    '<tr><td><b>Nombre / Name</b></td><td>' + esc(form.fullName) + '</td></tr>' +
    '<tr><td><b>Fecha de nacimiento / Date of birth</b></td><td>' + esc(dob) + '</td></tr>' +
    '<tr><td><b>Pasaporte / Passport</b></td><td>' + esc(form.passport.toUpperCase()) + '</td></tr>' +
    '<tr><td><b>Seguro / Insurance</b></td><td>' + esc(p.insurances.length ? CONFIG.INSURER + ' ' + p.insurances.join(' + ') : 'NO') + '</td></tr>' +
    '<tr><td><b>Nº inscripción / Booking no.</b></td><td>' + esc(p.enr) + '</td></tr>' +
    '</table>' +
    block('es') + block('en') +
    '<div class="box"><b>Firma del participante / Participant signature</b><br>' +
    '<img src="' + form.signature + '" style="height:110px"><br>' +
    esc(form.fullName) + ' – ' + esc(fmt) + '</div>' +
    '<p class="small">Firmado electrónicamente / Signed electronically. Idioma leído / Language read: ' +
    (form.lang === 'es' ? 'Español' : 'English') + '. Identidad verificada con el número de pasaporte / ' +
    'Identity checked with passport number.</p>' +
    '</body></html>';
  const name = 'Waiver_' + p.enr + '_' + p.name.replace(/[^\w]+/g, '_') + '_' + version + '.pdf';
  return Utilities.newBlob(html, 'text/html', 'w.html').getAs('application/pdf').setName(name);
}
