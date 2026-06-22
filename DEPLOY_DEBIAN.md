# Розгортання на Debian

Production-like конфігурація запускає React/nginx, Express API та PostgreSQL в одній внутрішній Docker-мережі. Назовні публікується лише nginx на порту 80. Порти backend `4000` і PostgreSQL `5432` не публікуються.

## 1. Підготовка Debian

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl ufw
```

## 2. Встановлення Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo reboot
```

Після повторного входу перевірте:

```bash
docker --version
docker compose version
```

## 3. Клонування репозиторію

```bash
git clone https://github.com/Levis-Artur/roadlist.git
cd roadlist
```

## 4. Production env

```bash
cp .env.production.example .env.production
nano .env.production
```

Обов’язково змініть `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` і `JWT_SECRET`. Перевірте `PILOT_DEPARTMENT`, `PILOT_START_DATE` та `PILOT_END_DATE`. Пароль у `DATABASE_URL` має точно збігатися з `POSTGRES_PASSWORD`; для URL використовуйте URL-encoded пароль, якщо він містить спеціальні символи.

Реальний `.env.production` ігнорується Git і не повинен потрапляти в репозиторій. Не використовуйте `admin123` або значення `CHANGE_ME...` на сервері. Для JWT створіть довгий випадковий секрет, наприклад:

```bash
openssl rand -hex 32
```

## 5. Запуск

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Після першого запуску застосуйте міграції:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend npx prisma migrate deploy
```

Для першого тестового розгортання створіть seed-дані:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend npm run prisma:seed
```

Seed не потрібно повторювати при кожному оновленні production-сервера.

## 6. Перевірка контейнерів

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f backend
```

Перевірте API через nginx:

```bash
curl http://127.0.0.1/api/health
```

Очікується JSON із `"success":true`. Backend має бачити PostgreSQL за hostname `postgres`.

## 7. Адреса сайту

```bash
hostname -I
```

З телефона або іншого комп’ютера в тій самій мережі відкрийте:

```text
http://SERVER_IP
http://SERVER_IP/admin
```

Для доступу з інтернету потрібні домен, HTTPS і коректні мережеві правила маршрутизатора або хостингу.

## 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Не відкривайте `4000` і `5432`. Backend доступний лише через nginx `/api`, а PostgreSQL — лише всередині Docker network. Порт `443` зарезервований для майбутнього HTTPS reverse proxy; поточна конфігурація слухає HTTP `80`.

## 9. Налаштування ThinkPad як сервера

Відкрийте конфігурацію systemd-logind:

```bash
sudo nano /etc/systemd/logind.conf
```

Додайте або змініть:

```text
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
IdleAction=ignore
```

Застосуйте зміни:

```bash
sudo systemctl restart systemd-logind
```

Також перевірте налаштування енергозбереження BIOS/UEFI та автоматичний запуск після відновлення живлення.

## 10. Backup

PostgreSQL backup:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_dump -U route_sheet_user route_sheet_db > backup_route_sheet.sql
```

Фото зберігаються в named volume `backend_uploads`, а не в локальній папці `server/uploads`. Створіть backup volume через backend-контейнер:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T backend \
  tar -czf - -C /app/uploads . > uploads_backup.tar.gz
```

Зберігайте backup-файли поза сервером і періодично перевіряйте їх відновлення. `docker compose down` не видаляє дані, але `docker compose down -v` видаляє обидва volumes.

## 11. Оновлення сервера після змін у GitHub

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend npx prisma migrate deploy
```

Після оновлення перевірте `ps`, `/api/health`, вхід патрульного, адмінку та завантаження фото.

## 12. Корисні команди

```bash
# Перезапуск без видалення даних
docker compose -f docker-compose.prod.yml --env-file .env.production restart

# Останні 200 рядків логів
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=200 backend

# Зупинка контейнерів без видалення volumes
docker compose -f docker-compose.prod.yml --env-file .env.production down
```
