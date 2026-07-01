# Backend

Backend для MVP «Електронний маршрутний лист»: Express, TypeScript, Prisma і PostgreSQL.

Основні інструкції запуску, міграцій, seed/reset, env-змінних і production deployment описані в кореневому [`README.md`](../README.md) та [`DEPLOY_DEBIAN.md`](../DEPLOY_DEBIAN.md).

Швидкий локальний запуск:

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run db:seed
npm run dev
```

Перевірка:

```bash
npm run build
npx prisma validate --schema=prisma/schema.prisma
npx prisma generate
```

Небезпечний reset local/staging:

```bash
npm run db:reset:destructive
```

Команда reset має production guard і не запускається з `NODE_ENV=production`.
