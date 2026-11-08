# SKHPortal — Admin (`apps/admin`)

The private back office for SKH Prestige Motors, served by the website at **`/admin`**:
stock book, invoices and credit notes, expenses and refunds, Tide bank import, and the
MTD VAT return (margin scheme and VAT-qualifying cars, from the VAT registration date).

It is its own service: **Python (FastAPI) + a SQLite database**, with a **React (Vite)** page.
The website (`apps/web`) forwards every `/admin/...` request to it.

```
apps/admin/
  api/         FastAPI server and all the accounting logic
    server.py        routes, sign-in guard; serves the built page
    core.py          VAT return, stock book, invoices, credit notes, expenses, periods
    auth.py          admin sign-in (hashed password, signed session cookie, lock-out)
    invoice_pdf.py   invoice layout (do not change coordinates, fonts or layout)
    credit_note_pdf.py, lookups.py (Companies House, HMRC VAT check, DVLA/DVSA)
  web/         React page (pages at /admin, /admin/stock, /admin/invoices, /admin/car/12 ...)
  tests/       pytest suite, including the HMRC margin-scheme and sign-in tests
  data/        local data (gitignored): vat.db, receipts/, invoices/, documents/, logo.png
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
cp .env.example .env               # then fill in the sign-in settings
cd web && npm install && npm run build && cd ..
python api/server.py               # http://127.0.0.1:8501/admin
```

With the website too: run the admin as above, then `cd apps/web && npm run dev` and open
http://localhost:3000/admin (the website forwards it to `ADMIN_URL`, default port 8501).

Page development with hot reload: `cd apps/admin/web && npm run dev` (http://localhost:5173/admin/).

Tests: `cd apps/admin && python -m pytest -q`

## Deploy on Railway

1. New service from this repo, **root directory `apps/admin`**, watch paths `apps/admin/**` (it builds the `Dockerfile`).
2. Add a **volume** mounted at **`/data`**: the database, receipts, invoice PDFs and logo live
   there and survive deploys. Without it, data is lost on every deploy.
3. Variables: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, plus any of the lookup keys
   in `.env.example`. (`DATA_DIR=/data` and `COOKIE_SECURE=1` are set by the Dockerfile.)
4. On the **web** service, set `ADMIN_URL` to the admin service's private address, e.g.
   `http://admin.railway.internal:8080` (use the admin's `PORT`), and redeploy it.
5. Open `https://<your site>/admin` and sign in. Fill in the Business page first.

Back up: download `/data` from the volume regularly (it is the whole business record).
