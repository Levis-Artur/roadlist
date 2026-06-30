# Електронний маршрутний лист

MVP PWA для обліку зміни патрульного екіпажу: патрульний входить за номером жетона і PIN, починає або завершує зміну, завантажує фото одометра, вносить кілометраж і за потреби фіксує заправку. Адміністративна панель керує патрульними, автомобілями, підрозділами, адміністраторами, місячними маршрутними листами, фото, аудитом і простим обліком пального.

Backend є основним джерелом даних. Frontend не створює production-критичні маршрутні листи, довідники, фото або audit logs локально, якщо API недоступне.

## Стек

- Frontend: React, TypeScript, Vite, PWA.
- Backend: Express, TypeScript, Prisma, PostgreSQL.
- Auth: JWT для патрульних і адміністраторів, обов’язкова 2FA для admin roles.
- Deployment: Docker Compose production profile з nginx, backend і PostgreSQL.

## Основні можливості MVP

- Вхід патрульного за жетоном і PIN.
- Початок і завершення зміни з фото одометра.
- Нормалізація номерів автомобілів.
- Місячні маршрутні листи службових автомобілів.
- Облік заправки та розрахунковий блок `Облік пального`.
- Адмін-панель `/admin` з ролями `SYSTEM_OWNER`, `NATIONAL_ADMIN`, `REGIONAL_ADMIN`.
- Відновлення доступу адміністратора власником системи: скидання пароля і/або 2FA без показу старих секретів.
- Audit log для ключових дій.

## Локальний запуск

Backend:

```bash
cd server
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run db:seed
npm run dev
```

Frontend:

```bash
npm install
npm run dev
```

Типово frontend очікує API за `VITE_API_URL` із `.env.example`, а backend читає налаштування з `server/.env`.

## Тестові дані local/staging

Seed створює тестових адміністраторів і патрульних тільки для local/staging. Він відмовляється працювати з `NODE_ENV=production`.

Приклади тестових облікових даних описані в `server/README.md`. Після першого входу адміністратора система вимагає змінити тимчасовий пароль і налаштувати 2FA.

## Небезпечний reset бази

Команда нижче повністю видаляє дані в підключеній базі, застосовує міграції заново і запускає seed:

```bash
cd server
npm run db:reset:destructive
```

Скрипт має production guard і не запускається з `NODE_ENV=production`.

## Prisma

Основні команди:

```bash
cd server
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npx prisma validate --schema=prisma/schema.prisma
```

Для production/staging після pull застосовуйте:

```bash
cd server
npx prisma migrate deploy
```

Не видаляйте наявні Prisma migrations: вони потрібні для відтворення схеми PostgreSQL.

## Production deployment

Production-like розгортання описане в `DEPLOY_DEBIAN.md`. Короткий цикл оновлення:

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Або використайте:

```bash
chmod +x deploy.sh
./deploy.sh
```

## Env overview

Не комітьте реальні `.env` файли. У репозиторії мають бути тільки приклади:

- `.env.example`
- `.env.production.example`
- `server/.env.example`

Ключові змінні:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `UPLOAD_DIR`
- `ADMIN_JWT_EXPIRES_IN`
- `OFFICER_JWT_EXPIRES_IN`
- `VITE_API_URL`

У production не використовуйте `CHANGE_ME...`, тестові паролі або seed credentials.

## Безпека MVP

- Паролі та PIN зберігаються тільки як bcrypt hash.
- Старі паролі, hash пароля і секретний ключ 2FA не показуються.
- Тимчасовий пароль для відновлення доступу генерується backend-ом і показується `SYSTEM_OWNER` один раз.
- Admin endpoints перевіряють актуальний стан адміністратора в базі: `isActive`, `isDeleted`, `mustChangePassword` і 2FA.
- Повної системи token versioning поки немає, тому вже видані JWT не відкликаються окремим списком сесій.

## Перевірка перед push

```bash
npm run build
cd server && npm run build
cd server && npx prisma validate --schema=prisma/schema.prisma
cd server && npx prisma generate
git status
```
