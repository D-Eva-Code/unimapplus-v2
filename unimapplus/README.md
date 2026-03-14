# UnimapPlus v2.0 – Campus Food Delivery

## Quick Start (Local Dev)

### 1. Backend setup
```bash
cd backend
npm install
cp .env.example .env      # Fill in all values (see below)
npm run dev               # Starts on :5000
```

### 2. Frontend setup
```bash
cd frontend
npm install
cp .env.example .env      # Set VITE_API_URL
npm run dev               # Starts on :3000
```

### 3. Database
Run `schema.sql` in your MySQL instance:
```bash
mysql -u root -p < schema.sql
```

---

## Environment Variables

### Backend `.env`

| Variable | Where to get it |
|---|---|
| `DB_HOST` | Railway MySQL plugin |
| `DB_USER` | Railway MySQL plugin |
| `DB_PASSWORD` | Railway MySQL plugin |
| `DB_NAME` | Railway MySQL plugin |
| `JWT_SECRET` | Any random string, e.g. `openssl rand -hex 32` |
| `AWS_ACCESS_KEY_ID` | AWS IAM console |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM console |
| `AWS_REGION` | e.g. `eu-west-1` |
| `AWS_S3_BUCKET` | Create: `unimapplus-food-images` |
| `PAYSTACK_SECRET_KEY` | paystack.com → Settings → API Keys |
| `PAYSTACK_PUBLIC_KEY` | paystack.com → Settings → API Keys |
| `FRONTEND_URL` | Your Vercel URL after deploy |
| `BACKEND_URL` | Your Railway URL after deploy |

### Frontend `.env`
```
VITE_API_URL=https://your-railway-url.up.railway.app/api
VITE_SOCKET_URL=https://your-railway-url.up.railway.app
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
```

---

## Deployment (15 minutes)

### Step 1 – Deploy Backend to Railway
1. Push `backend/` folder to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add **MySQL** plugin → Railway auto-fills `DATABASE_URL`
   - Get individual DB vars from the MySQL plugin's **Variables** tab
4. Add all env vars in Railway → **Variables**
5. Deploy → copy your Railway URL

### Step 2 – Set up AWS S3 (for food photos)
1. [AWS Console](https://console.aws.amazon.com) → S3 → Create bucket: `unimapplus-food-images`
2. Block Public Access: **OFF** (uncheck all 4 boxes)
3. Bucket Policy → paste:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::unimapplus-food-images/*"
  }]
}
```
4. IAM → Create user → Attach `AmazonS3FullAccess` → Create Access Key → copy to Railway env vars

### Step 3 – Deploy Frontend to Vercel
1. Push `frontend/` folder to GitHub
2. [vercel.com](https://vercel.com) → Import → select repo
3. Add env vars: `VITE_API_URL`, `VITE_SOCKET_URL`
4. Deploy!

### Step 4 – Set Paystack Webhook
In your Paystack dashboard → **Settings → Webhooks**:
```
https://your-railway-url.up.railway.app/api/paystack/webhook
```

---

## Architecture

```
Student (Browser)
    │  HTTP/REST + Socket.io
    ▼
Express API (Railway)
    ├── Auth (JWT)
    ├── Vendors + Menu (S3 images)
    ├── Orders → Paystack (split payments)
    ├── Riders (live GPS via Socket.io)
    └── Search (MySQL JSON_CONTAINS)
    │
    ├── MySQL (Railway plugin)
    ├── AWS S3 (food images)
    └── Paystack (payments)
```

## Key Features
- 🔐 JWT auth for students, vendors, riders
- 🍽️ Vendor menu with real food photos (AWS S3)
- 💳 Paystack payment with automatic vendor split
- 🏍️ Real-time rider GPS tracking via Socket.io
- 📍 Campus map with OpenStreetMap + UNIBEN locations
- 🔍 Search by food name, eatery name, or tag (spicy, vegetarian, etc.)
- ✅ Delivery verification: rider must be within 300m of destination
- ⭐ Rating system for vendors and riders
- 🔄 Reorder past orders

## User Flows

### Student
1. Signup (select UNIBEN from school dropdown)
2. Browse eateries → open menu → add to cart
3. Checkout → Paystack → payment confirmed → order tracked live
4. Rate vendor and rider after delivery

### Vendor
1. Signup with bank details → Paystack subaccount created
2. Add menu items with photos and tags
3. Toggle open/closed
4. Accept/reject incoming orders → update to preparing → ready

### Rider
1. Signup with bank details → Paystack subaccount created
2. Toggle Available → browse unassigned orders → Accept
3. Mark Picked Up → On the Way → Confirm Delivery (GPS verified)
4. Earnings auto-credited via Paystack split
