# Telegram Member Manager

A web application for scraping Telegram channel members and adding them to target channels. Built with FastAPI (Python) and React (TypeScript).

## Features

- **Multi-account management** - Manage multiple Telegram accounts with session persistence
- **Channel scraping** - Scrape members from source channels with filters (usernames only, recent activity, exclude bots)
- **Member addition** - Add members to target channels with rate limiting and flood wait handling
- **Job queue** - Background job processing with Celery and Redis
- **Real-time progress** - Track job progress with live updates
- **Proxy support** - SOCKS5/HTTP/MTProto proxy support for accounts
- **Dashboard** - Overview statistics and account health monitoring
- **Secure authentication** - JWT-based auth with refresh tokens

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   PostgreSQL    │
│   (React)       │     │   (FastAPI)     │     │   Database      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌───────────┐ ┌───────────┐ ┌───────────┐
             │  Celery   │ │   Redis   │ │ Telethon  │
             │  Workers  │ │  (Broker) │ │  Clients  │
             └───────────┘ └───────────┘ └───────────┘
```

## Prerequisites

- Docker & Docker Compose
- Telegram API credentials (from [my.telegram.org](https://my.telegram.org))
- At least one Telegram account (phone number)

## Quick Start

### 1. Clone and Configure

```bash
cd telegram-member-app
cp backend/.env.example backend/.env
```

### 2. Generate Encryption Key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Add the output to `backend/.env` as `ENCRYPTION_KEY`.

### 3. Add Telegram API Credentials

Edit `backend/.env` and add your credentials from [my.telegram.org](https://my.telegram.org):

```env
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH=your_api_hash_here
```

### 4. Start Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Backend API on port 8000
- Celery worker & beat
- Flower monitoring on port 5555
- Frontend on port 3000

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Flower**: http://localhost:5555

### 6. Create Admin User

Register at http://localhost:3000/register

### 7. Add Telegram Account

1. Go to **Accounts** page
2. Click **Add Account**
3. Enter API ID, API Hash, and phone number
4. Click **Send Code** and enter the code from Telegram
5. If 2FA is enabled, enter your password

### 8. Add Channels

1. Go to **Channels** → **Source Channels**
2. Click **Add Source Channel** and enter channel ID/username
3. Go to **Target Channels** and add target channel
4. Generate invite link for target channel

### 9. Scrape Members

1. Go to **Channels** → **Source Channels**
2. Click **Scrape** on a source channel
3. Configure filters and start scraping

### 10. Create Add Job

1. Go to **Jobs** page
2. Click **Create Job**
3. Select source channel, target channel, and account
3. Configure filters and limits
4. Click **Start** to begin adding members

## Important Rate Limits

Telegram imposes strict limits to prevent spam:

| Action | Limit | Notes |
|--------|-------|-------|
| Direct adds (InviteToChannel) | ~30-50/day/account | High ban risk |
| Invite links | Safer | Users join voluntarily |
| FloodWait | Variable | Must wait specified seconds |

**Best Practices:**
- Use multiple accounts
- Rotate accounts daily
- Prefer invite links over direct adds
- Respect `FloodWaitError` delays
- Don't scrape channels you don't own/admin

## Project Structure

```
telegram-member-app/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routes
│   │   ├── core/          # Config, auth, database, celery
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/
│   │   │   ├── telegram/  # Telethon client management
│   │   │   ├── scraper/   # Member scraping logic
│   │   │   ├── adder/     # Member adding logic
│   │   │   └── scheduler/ # Background tasks
│   │   └── utils/
│   ├── alembic/           # Database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API client
│   │   ├── context/       # React context (auth)
│   │   ├── hooks/         # Custom hooks
│   │   └── types/         # TypeScript types
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Celery Worker

```bash
cd backend
celery -A app.core.celery_app worker --loglevel=info
celery -A app.core.celery_app beat --loglevel=info
```

## Database Migrations

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Async PostgreSQL URL | `postgresql+asyncpg://postgres:postgres@localhost:5432/telegram_app` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT secret key | Required |
| `ENCRYPTION_KEY` | Fernet key for session encryption | Required |
| `TELEGRAM_API_ID` | Telegram API ID | Required |
| `TELEGRAM_API_HASH` | Telegram API Hash | Required |
| `DEFAULT_DAILY_ADD_LIMIT` | Daily add limit per account | 30 |
| `DEFAULT_DELAY_BETWEEN_ADDS` | Delay between adds (seconds) | 60 |

## Legal & Ethical Use

⚠️ **Important**: This tool is for legitimate channel growth only.

- Only scrape channels you own or admin
- Only add users who would reasonably expect to be added
- Respect Telegram's Terms of Service
- No spam, no bulk unsolicited adds
- Consider double-opt-in via invite links
- Comply with GDPR and local privacy laws

## Troubleshooting

### "SessionPasswordNeededError"
Account has 2FA enabled. Enter your 2FA password when prompted.

### "FloodWaitError: X seconds"
Telegram rate limit hit. The system automatically waits and retries. Reduce concurrent jobs or add more accounts.

### "UserPrivacyRestrictedError"
User's privacy settings prevent adding. Skip and continue.

### "ChannelPrivateError"
Bot/account doesn't have access to channel. Ensure account is member/admin.

### Database connection issues
Check PostgreSQL is running and credentials in `.env` are correct.

## Monitoring

- **Flower** (Celery monitoring): http://localhost:5555
- **API Health**: http://localhost:8000/health
- **Logs**: `docker-compose logs -f backend`

## License

MIT License - Use responsibly and ethically.