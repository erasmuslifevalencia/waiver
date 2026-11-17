// URL of the Google Apps Script web app (Deploy → Web app → URL ending in /exec)
window.API_URL = 'PASTE_APPS_SCRIPT_EXEC_URL_HERE';

window.api = async function (action, data) {
  const res = await fetch(window.API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ action: action }, data || {})), // text/plain → no CORS preflight
  });
  if (!res.ok) throw new Error('Server error ' + res.status);
  return res.json();
};
window.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
