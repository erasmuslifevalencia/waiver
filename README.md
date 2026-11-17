# Erasmus Life – online waiver signing

Static front-end (GitHub Pages) + Google Apps Script back-end (Sheets, Drive PDFs).

- `index.html` – public page: one link for the whole group (search name → last 3 digits of WhatsApp → read → sign).
- `admin.html` – team view: open `admin.html#ADMIN_KEY` (signed / not signed / to re-sign, PDF links, reset).
- `config.js` – `API_URL` = Apps Script web-app URL (`…/exec`).
- `apps-script/` – back-end code (copy into a script.google.com project; `Code.gs` + `Texts.gs`).

## Back-end setup
1. script.google.com → New project → paste `Code.gs` and add a script file `Texts` with `Texts.gs`.
2. Run `setup()` once → Execution log gives the admin key, the PDF Drive folder and participants without phone match.
3. Deploy → New deployment → Web app → Execute as **Me**, access **Anyone** → copy the `/exec` URL into `config.js`.
4. After any code change: Deploy → Manage deployments → Edit → New version (URL unchanged).

## Data
- Participants + insurance: options sheet, tab `DEC2026` (insurance read live at signing time).
- Phones: personal-info form responses.
- Signatures: tab `WAIVERS` in the options sheet + one PDF per person in Drive (team-only folder: contains passport numbers).

Settings (trip, dates, organizer, privacy e-mail, open/closed) are at the top of `apps-script/Code.gs`.
Texts are drafts to be validated by a lawyer / the insurer.
