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

  C.uid = function () {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  /** Cash summary for a set of entries (status OK only). */
  C.cash = function (entries) {
    const ok = entries.filter(e => e.status !== 'CANCELLED');
    const sum = f => ok.filter(f).reduce((a, e) => a + (+e.eur || 0), 0);
    const byCur = {};
    ok.forEach(e => {
      const cur = e.currency || 'EUR';
      const sign = e.type === 'OUT' ? -1 : 1;
      byCur[cur] = (byCur[cur] || 0) + sign * (+e.amount || 0);
    });
    const sales = sum(e => e.type === 'SALE'), inn = sum(e => e.type === 'IN'), out = sum(e => e.type === 'OUT');
    return { sales: sales, in: inn, out: out, balance: sales + inn - out, byCur: byCur };
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
