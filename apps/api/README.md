# SKHPortal — API (`apps/api`)

Express + TypeScript API that owns the website's database (PostgreSQL on Railway) via
**Prisma**. The Next.js site (`apps/web`) calls it. The back office (`apps/admin`) is separate.

## Endpoints
- `GET /health` — liveness check
- `GET /api/vehicles`, `GET /api/vehicles/:slug` — the showroom
- `POST /api/enquiries` — `{ name, email, phone?, division?, message, vehicleId? }`
- `POST /api/reservations` — £99 reservation on a vehicle `{ name, email, phone, vehicleId }`

## Local development
```bash
cd apps/api
npm install
cp .env.example .env          # set DATABASE_URL (and CORS_ORIGIN)
npx prisma migrate dev        # create the schema in your database
npm run seed                  # optional: sample vehicles
npm run dev                   # http://localhost:3001
```

`npm run prisma:studio` opens Prisma's table viewer; pgAdmin can connect to the same
`DATABASE_URL` for full SQL access.

## Production (Railway)
- Service root directory `apps/api`; builds the `Dockerfile`.
- Start runs `prisma migrate deploy` then `node dist/index.js`.
- Variables: `DATABASE_URL` (from the Railway Postgres), `CORS_ORIGIN` (the website's URL).
  `PORT` is provided by Railway.
