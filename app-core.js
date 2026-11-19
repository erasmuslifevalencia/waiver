/* Shared logic for the guide app and the office view. */
(function () {
  const C = {};

  C.money = function (eur, trip, cur) {
    const local = cur && cur !== 'EUR' && trip && trip.localCur === cur && trip.rate > 0;
    const v = local ? eur * trip.rate : eur;
    const s = (Math.round(v * 100) / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 });
    return local ? s + ' ' + cur : s + ' €';
  };

  C.today = function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  C.dayLabel = function (iso) {
    if (!iso) return '';
    const d = new Date(iso.slice(0, 10) + 'T12:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  /** Price of an extra, using the choice's own price when it has one. */
  C.price = function (x, choice) {
    return choice && x.prices && x.prices[choice] != null ? x.prices[choice] : x.price;
  };
  C.priceLabel = function (x, trip, cur) {
    const ps = x.choices.length && x.prices ? x.choices.map(c => C.price(x, c)) : [x.price];
    const lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps);
    return lo === hi ? C.money(lo, trip, cur) : C.money(lo, trip, cur) + ' – ' + C.money(hi, trip, cur);
  };

  C.uid = function () {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  /** Cash effect of one entry in € (deposit lines included; DEP_KEPT is only a note: the hotel already kept that money). */
  C.effect = function (e) {
    const v = +e.eur || 0;
    switch (e.type) {
      case 'SALE': case 'IN': case 'DEP_IN': case 'DEP_BACK': return v;
      case 'OUT': case 'DEP_HOTEL': case 'DEP_RET': return -v;
      default: return 0;
    }
  };
  C.typeLabel = function (e) {
    return { SALE: 'Extra', IN: 'In', OUT: 'Out', DEP_IN: 'Deposit in', DEP_RET: 'Deposit back', DEP_HOTEL: 'Deposits to hotel',
      DEP_BACK: 'Deposits from hotel', DEP_KEPT: 'Kept by hotel' }[e.type] || e.type;
  };
  C.isDeposit = function (e) { return /^DEP_/.test(e.type); };

  /** Cash summary for a set of entries (cancelled ones ignored). Deposits are kept apart from sales and money in/out. */
  C.cash = function (entries) {
    const ok = entries.filter(e => e.status !== 'CANCELLED');
    const sum = f => ok.filter(f).reduce((a, e) => a + (+e.eur || 0), 0);
    const byCur = {};
    ok.forEach(e => {
      const cur = e.currency || 'EUR', eff = C.effect(e);
      if (!eff) return;
      byCur[cur] = (byCur[cur] || 0) + (eff < 0 ? -1 : 1) * Math.abs(+e.amount || 0);
    });
    const sales = sum(e => e.type === 'SALE'), inn = sum(e => e.type === 'IN'), out = sum(e => e.type === 'OUT');
    const dep = ok.filter(C.isDeposit).reduce((a, e) => a + C.effect(e), 0);
    return { sales: sales, in: inn, out: out, deposits: dep, balance: sales + inn - out + dep, byCur: byCur };
  };

  /** Deposit state per traveller and hotel handovers, from one bus's entries. */
  C.depState = function (entries) {
    const ok = entries.filter(e => e.status !== 'CANCELLED' && C.isDeposit(e))
      .sort((a, b) => String(a.created).localeCompare(String(b.created)));
    const per = {}, hotels = [];
    const P = id => (per[id] = per[id] || { gave: 0, kept: 0, ret: null, inIds: [], keptWhy: [] });
    ok.forEach(e => {
      if (e.type === 'DEP_IN') { const p = P(e.travellerId); p.gave += +e.eur || 0; p.inIds.push(e.id); }
      if (e.type === 'DEP_KEPT') { const p = P(e.travellerId); p.kept += +e.eur || 0; if (e.description) p.keptWhy.push(e.description); }
      if (e.type === 'DEP_RET') { P(e.travellerId).ret = e; }
      if (e.type === 'DEP_HOTEL') hotels.push({ name: e.description, out: e, back: null, kept: 0 });
      if (e.type === 'DEP_BACK') { const h = hotels.slice().reverse().find(x => !x.back); if (h) h.back = e; }
    });
    ok.filter(e => e.type === 'DEP_KEPT').forEach(e => { const h = hotels.slice().reverse().find(x => x.back && x.back.created <= e.created); if (h) h.kept += +e.eur || 0; });
    const open = hotels.slice().reverse().find(h => !h.back) || null;
    const pocket = ok.reduce((a, e) => a + C.effect(e), 0);
    const atHotel = open ? +open.out.eur || 0 : 0;
    return { per: per, hotels: hotels, open: open, pocket: pocket, atHotel: atHotel };
  };

  /** Counts per extra / choice / bus (sales OK), optionally for one day. */
  C.extraTotals = function (trip, entries, day) {
    const buses = trip.buses.map(b => b.bus);
    return trip.extras.map(x => {
      const rows = (x.choices.length ? x.choices : ['']).map(ch => {
        const per = {};
        buses.forEach(b => {
          per[b] = entries.filter(e => e.status !== 'CANCELLED' && e.type === 'SALE' && e.extra === x.name &&
            (!x.choices.length || e.choice === ch) && String(e.bus) === b &&
            (!day || (x.askDay ? e.day : String(e.created).slice(0, 10)) === day)).length;
        });
        return { label: ch || 'Sold', per: per, total: buses.reduce((a, b) => a + per[b], 0) };
      });
      return { name: x.name, rows: rows, total: rows.reduce((a, r) => a + r.total, 0) };
    });
  };

  /** Booked options per bus from the options sheet. */
  C.optionTotals = function (trip, travellers) {
    const buses = trip.buses.map(b => b.bus);
    return trip.optionCols.map(o => {
      const per = {};
      buses.forEach(b => { per[b] = travellers.filter(t => t.bus === b && t.options.indexOf(o) >= 0).length; });
      return { label: o, per: per, total: travellers.filter(t => t.options.indexOf(o) >= 0).length };
    });
  };

  /** Days that appear in sales (for the totals filter). */
  C.days = function (trip, entries) {
    const set = {};
    entries.forEach(e => {
      if (e.type !== 'SALE' || e.status === 'CANCELLED') return;
      const x = trip.extras.find(z => z.name === e.extra);
      const d = x && x.askDay ? e.day : String(e.created).slice(0, 10);
      if (d) set[d] = 1;
    });
    return Object.keys(set).sort();
  };

  window.Core = C;
})();
