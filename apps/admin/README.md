# SKHPortal — Admin (`apps/admin`)

The private back office for SKH Prestige Motors, served by the website at **`/admin`**:
stock book, invoices and credit notes, expenses and refunds, Tide bank import, and the
MTD VAT return (margin scheme and VAT-qualifying cars, from the VAT registration date).

It is its own service: **Python (FastAPI)** with a **React (Vite)** page. Its data lives in the
project's **PostgreSQL**, in its own `admin` schema, so it never mixes with the website's Prisma tables.
Receipts, invoice PDFs, car documents and the logo are stored in Postgres too: no volume needed.
The website (`apps/web`) forwards every `/admin/...` request to it.

```
apps/admin/
  api/         FastAPI server and all the accounting logic
    server.py        routes, sign-in guard; serves the built page
    db.py            PostgreSQL connection (DATABASE_URL, `admin` schema)
    core.py          VAT return, stock book, invoices, credit notes, expenses, periods
    auth.py          admin sign-in (hashed password, signed session cookie, lock-out)
    invoice_pdf.py   invoice layout (do not change coordinates, fonts or layout)
    credit_note_pdf.py, lookups.py (Companies House, HMRC VAT check, DVLA/DVSA)
  web/         React page (pages at /admin, /admin/stock, /admin/invoices, /admin/car/12 ...)
  data/        local working copy of stored files (gitignored; rebuilt from Postgres on start)
  Dockerfile   builds the page and runs the API (Railway)
```

## Sign-in

Every page and API call needs the admin sign-in. Make the password hash and session secret:

```bash
cd apps/admin
python api/auth.py        # asks for the password twice, prints ADMIN_PASSWORD_HASH and SESSION_SECRET
```

Put them, with `ADMIN_EMAIL`, in `apps/admin/.env` locally or in the Railway service variables.
Five wrong passwords lock that device out for 15 minutes (20 across all devices locks sign-in).

## Run locally

```bash
cd apps/admin
pip install -r requirements.txt
cp .env.example .env               # set DATABASE_URL and the sign-in settings
cd web && npm install && npm run build && cd ..
python api/server.py               # http://127.0.0.1:8501/admin
```

With the website too: run the admin as above, then `cd apps/web && npm run dev` and open
http://localhost:3000/admin (the website forwards it to `ADMIN_URL`, default port 8501).

Page development with hot reload: `cd apps/admin/web && npm run dev` (http://localhost:5173/admin/).

## Deploy on Railway

1. New service from this repo, **root directory `apps/admin`**, watch paths `apps/admin/**` (it builds the `Dockerfile`).
2. Variables: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (a reference to the project's Postgres),
   `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `PORT=8080`, plus any of the lookup keys in
   `.env.example`. No volume: everything is stored in Postgres. (`COOKIE_SECURE=1` is set by the Dockerfile.)
3. On the **web** service, set `ADMIN_URL` to the admin service's private address, e.g.
   `http://admin.railway.internal:8080` (use the admin's `PORT`), and redeploy it.
4. Open `https://<your site>/admin` and sign in. Fill in the Business page first.

Back up: Railway's Postgres backups cover it. The Business page's **Download backup** also gives a
portable copy (all tables as `vat.db` plus every stored file).
