# Route Sheet API

Backend MVP для PWA «Електронний маршрутний лист»: Express, TypeScript, Prisma, PostgreSQL і локальне файлове сховище фото через Multer.

## Запуск

```bash
cd server
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

API працює на `http://localhost:4000`. Перевірка стану: `GET /api/health`.

## Тестові дані

Seed створює активних працівників із жетонами `0000001`, `0000002` і `0000003`. Номер жетона має формат рівно 7 цифр (`^\d{7}$`) і зберігається як рядок. Старі шестизначні тестові номери деактивуються. Звання в моделі немає.

Тестові PIN: `0000001 / 1111`, `0000002 / 2222`, `0000003 / 3333`. У `Officer` зберігається тільки bcrypt hash.

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

{"badgeNumber":"0000001","pin":"1111"}
```

Відповідь містить JWT і публічні дані Officer без `pinHash`. `POST /api/officers/logout`, `POST /api/route-sheets/start` і `POST /api/route-sheets/finish` приймають `Authorization: Bearer TOKEN`. Start/finish ігнорують `badgeNumber` із body та використовують жетон із JWT.

### Довідник патрульних

```http
GET /api/officers?search=Іваненко&department=Волинській&isActive=true
POST /api/officers
PATCH /api/officers/:id
DELETE /api/officers/:id
```

Створення приймає `badgeNumber`, `fullName`, `department`, `pin`, `isActive` і `isPilotAllowed`; PIN має 4–8 цифр. Під час оновлення порожній/відсутній `pin` не змінює поточний hash. API повертає тільки `hasPin`. `DELETE` виконує soft-disable патрульного та його пілотного доступу.

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

### Пілотний режим і автомобілі

```http
GET /api/pilot/status
GET /api/vehicles/pilot
GET /api/vehicles
POST /api/vehicles
PATCH /api/vehicles/:id
DELETE /api/vehicles/:id
```

`GET /api/vehicles/pilot` повертає тільки активні автомобілі з `PILOT_DEPARTMENT`. У pilot mode перевірка жетона додатково використовує `PilotOfficerAccess`, а нові маршрутні листи отримують `isPilot`, `pilotDepartment` і необов’язковий `pilotComment`.

`GET /api/vehicles` підтримує `search`, `department`, `isPilotActive` та `isActive`. Backend нормалізує `displayPlateNumber` під час створення й оновлення; `DELETE` встановлює `isActive=false` та `isPilotActive=false`, не видаляючи історію.

### Адміністратор і журнал

```http
POST /api/admin/login
Content-Type: application/json

{"password":"admin123"}
```

```http
GET /api/audit-logs
```

Mock token і пароль призначені лише для MVP та не є production-авторизацією.

## Налаштування

Змінні середовища описані в [.env.example](./.env.example). Docker Compose створює PostgreSQL:

- database: `route_sheet_db`;
- user: `route_sheet_user`;
- password: `route_sheet_password`;
- port: `5432`.

Параметри пілоту:

```env
PILOT_MODE=true
PILOT_DEPARTMENT="УПП у Волинській області"
PILOT_START_DATE="2026-06-19"
PILOT_END_DATE="2026-06-26"
JWT_SECRET="CHANGE_ME_SECRET"
JWT_EXPIRES_IN="12h"
```

У production `JWT_SECRET` обов’язково потрібно замінити на сильний секрет; сервер навмисно відмовляється стартувати з `CHANGE_ME_SECRET` у production mode.

Seed створює три записи `PilotOfficerAccess` і один автомобіль: Hyundai Sonata з номером `АА5200МН` для відображення та нормалізованим `AA5200MH` для збереження й пошуку.

Frontend підключений до цих endpoint-ів через власний service layer і має локальний MVP-fallback на випадок мережевої недоступності API.
