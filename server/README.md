# Route Sheet API

Backend MVP для PWA «Електронний маршрутний лист»: Express, TypeScript, Prisma, PostgreSQL і локальне файлове сховище фото через Multer.

## Запуск

```bash
cd server
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npm run prisma:migrate:dev
npm run prisma:seed
npm run dev
```

API працює на `http://localhost:4000`. Перевірка стану: `GET /api/health`.

## Тестові дані

Seed створює активних тестових працівників із жетонами `0000001`–`0000005`. Номер жетона має формат рівно 7 цифр (`^\d{7}$`) і зберігається як рядок. Звання в моделі немає.

Тестові PIN:

- `0000001 / 240681`
- `0000002 / 240682`
- `0000003 / 240683`
- `0000004 / 240684`
- `0000005 / 240685`

У `Officer` зберігається тільки bcrypt hash.

Тестові адміністратори для local/staging:

- `owner.test / Owner.Test-2026!`
- `national.test / National.Test-2026!`
- `volyn.admin / Regional.Volyn-2026!`
- `lviv.admin / Regional.Lviv-2026!`

Seed відмовляється працювати з `NODE_ENV=production`.

## Clean reset local/staging

> УВАГА: команда повністю очищає підключену базу даних, застосовує міграції і створює чистий тестовий набір даних.

```bash
npm run db:reset:destructive
```

Команда відмовляється працювати з `NODE_ENV=production`.

Окремі команди:

```bash
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run db:seed
```

Перший `SYSTEM_OWNER` без тестового seed:

```bash
OWNER_USERNAME="owner.company" \
OWNER_FULL_NAME="Власник системи" \
OWNER_PASSWORD="Strong.Owner-2026!" \
npm run admin:create-owner
```

Скрипт не має default credentials. Якщо активний `SYSTEM_OWNER` уже існує, створення іншого буде заблоковано, доки явно не задано `OWNER_REPLACE=true`.

## Endpoints

### Перевірка жетона

```http
POST /api/officers/verify
Content-Type: application/json

{"badgeNumber":"0000001"}
```

### Вхід патрульного

```http
POST /api/officers/login
Content-Type: application/json

{"badgeNumber":"0000001","pin":"240681"}
```

Відповідь містить JWT і публічні дані Officer без `pinHash`. `POST /api/officers/logout`, `POST /api/route-sheets/start` і `POST /api/route-sheets/finish` приймають `Authorization: Bearer TOKEN`. Start/finish ігнорують `badgeNumber` із body та використовують жетон із JWT.

### Довідник патрульних

```http
GET /api/officers?search=Іваненко&department=Волинській&isActive=true
POST /api/officers
PATCH /api/officers/:id
DELETE /api/officers/:id
```

Створення приймає `badgeNumber`, `fullName`, `department`, `pin` і `isActive`; PIN має 4–8 цифр. Під час оновлення порожній/відсутній `pin` не змінює поточний hash. API повертає тільки `hasPin`. `DELETE` виконує soft-disable патрульного.

### Початок зміни

```http
POST /api/route-sheets/start
Content-Type: application/json

{
  "badgeNumber": "0000001",
  "crewNumber": null,
  "vehicleNumber": "АА5200МН",
  "startOdometer": 198234,
  "startOcrValue": 198234,
  "startManualEntry": false,
  "startPhotoId": "optional-photo-id"
}
```

### Завершення зміни

```http
POST /api/route-sheets/finish
Content-Type: application/json

{
  "badgeNumber": "0000001",
  "crewNumber": null,
  "vehicleNumber": "AA5200MH",
  "endOdometer": 198376,
  "endOcrValue": 198376,
  "endManualEntry": false,
  "endPhotoId": "optional-photo-id"
}
```

### Реєстр і деталі

```http
GET /api/route-sheets?status=completed&search=Іваненко
GET /api/route-sheets/:id
```

Список також підтримує `badgeNumber`, `vehicleNumber`, `department`, `from` і `to`.

`crewNumber` є необов’язковим і може позначати екіпаж, групу, сектор або підрозділ. Порожній рядок чи відсутнє поле зберігається як `null`. Під час завершення зміни екіпаж враховується в пошуку лише тоді, коли він переданий; інакше пошук виконується за жетоном, автомобілем і статусом `active`.

### Фото та mock OCR

```http
POST /api/photos/upload
Content-Type: multipart/form-data

photo=<file>
type=start
```

```http
GET /api/photos/:id
POST /api/photos/:id/ocr
Content-Type: application/json

{"type":"start"}
```

Файли зберігаються в `uploads/`, метадані — у PostgreSQL. Строк зберігання фото становить 30 днів.

### Автомобілі

```http
GET /api/vehicles/available
GET /api/vehicles
POST /api/vehicles
PATCH /api/vehicles/:id
DELETE /api/vehicles/:id
```

`GET /api/vehicles/available` повертає всі активні автомобілі для патрульного інтерфейсу. `GET /api/vehicles` підтримує `search`, `department` та `isActive`. Backend нормалізує `displayPlateNumber` під час створення й оновлення; `DELETE` встановлює `isActive=false`, не видаляючи історію.

### Адміністратор і журнал

```http
POST /api/admin/login
Content-Type: application/json

{"username":"owner.test","password":"Owner.Test-2026!"}
```

```http
GET /api/audit-logs
Authorization: Bearer ADMIN_JWT
```

Відповідь містить `temporaryToken`, ознаки `mustChangePassword` / `requiresTwoFactorSetup` і public-профіль адміністратора. Seed створює тестового `SYSTEM_OWNER`: `owner.test / Owner.Test-2026!`. Ці credentials призначені лише для local/staging; owner створюється з `mustChangePassword=true`.

Ролі:

- `SYSTEM_OWNER` — власник системи, бачить усі дані, створює `NATIONAL_ADMIN` і `REGIONAL_ADMIN`; не редагується і не деактивується через API/UI.
- `NATIONAL_ADMIN` — бачить усю Україну, створює тільки `REGIONAL_ADMIN`.
- `REGIONAL_ADMIN` — бачить і змінює тільки дані свого УПП; backend застосовує це обмеження до патрульних, автомобілів, маршрутних листів, місячних листів і audit logs.

Додаткові endpoint-и безпеки:

```http
POST /api/admin/change-password
POST /api/admin/2fa/setup
POST /api/admin/2fa/enable
POST /api/admin/2fa/verify
PATCH /api/admin/users/:id/password
PATCH /api/admin-users/:id/password
POST /api/admin-users/:id/2fa/reset
GET /api/admin/me
POST /api/admin/logout
```

Адміністраторські паролі зберігаються тільки як bcrypt hash і не повертаються в API. Новий пароль має містити мінімум 12 символів, велику і малу літеру, цифру та спецсимвол. Після 5 невдалих спроб акаунт блокується на 15 хвилин; також діє базовий IP rate limit для admin login.

2FA через Google Authenticator / TOTP є обов’язковою для `SYSTEM_OWNER`, `NATIONAL_ADMIN` і `REGIONAL_ADMIN`. `POST /api/admin/login` після правильного пароля повертає короткий `temporaryToken`; повний admin JWT видається тільки після `POST /api/admin/2fa/enable` або `POST /api/admin/2fa/verify`. TOTP secret не повертається у звичайних API responses і не логується.

## Налаштування

Змінні середовища описані в [.env.example](./.env.example). Docker Compose створює PostgreSQL:

- database: `route_sheet_db`;
- user: `route_sheet_user`;
- password: `route_sheet_password`;
- port: `5432`.

```env
JWT_SECRET="CHANGE_ME_SECRET"
ADMIN_JWT_EXPIRES_IN="2h"
ADMIN_2FA_PENDING_EXPIRES_IN="5m"
OFFICER_JWT_EXPIRES_IN="12h"
```

У production `JWT_SECRET` обов’язково потрібно замінити на сильний секрет; сервер навмисно відмовляється стартувати з `CHANGE_ME_SECRET` у production mode.

Seed створює два тестові УПП, внутрішні підрозділи, тестових адміністраторів, п’ять активних патрульних і чотири активні службові автомобілі. Hyundai Sonata має номер `АА5200МН` для відображення та нормалізований `AA5200MH` для збереження й пошуку.

Frontend підключений до цих endpoint-ів через власний service layer. Якщо API недоступне, клієнт показує помилку і не створює production-критичні дані локально.
