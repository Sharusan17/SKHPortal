# SKHPortal — Backend

Express + TypeScript API that owns the application database (standalone PostgreSQL on
Railway) via **Prisma**. The Next.js `frontend/` calls this service; Supabase handles
auth separately.

## Endpoints
- `GET /health` — liveness check
- `POST /api/enquiries` — create an enquiry (`{ name, email, phone?, division?, message }`)

## Local development
```bash
npm install
cp .env.example .env          # set DATABASE_URL (and CORS_ORIGIN)
npx prisma migrate dev        # create the schema in your database
npm run dev                   # http://localhost:3001
```

`npm run prisma:studio` opens Prisma's table viewer; pgAdmin can connect to the same
`DATABASE_URL` for full SQL access.

## Production (Railway)
- Build: `npm run build` (runs `prisma generate` then `tsc`)
- Start: `npm start` (runs `prisma migrate deploy` then `node dist/index.js`)
- Required env: `DATABASE_URL` (from the Railway Postgres), `CORS_ORIGIN` (the
  frontend's URL). `PORT` is provided by Railway.
