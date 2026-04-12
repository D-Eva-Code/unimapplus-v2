# UnimapPlus v2.0 – Campus Food Delivery

## Quick Start (Local Dev)

### 1. Backend setup
```bash
cd backend
npm install
cp .env.example .env      
npm run dev               
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
- JWT auth for students, vendors, riders
- Vendor menu with real food photos (AWS S3)
- Paystack payment with automatic vendor split
- Real-time rider GPS tracking via Socket.io
- Campus map with OpenStreetMap + UNIBEN locations
- Search by food name, eatery name, or tag (spicy, vegetarian, etc.)
- Delivery verification: rider must be within 300m of destination
- Rating system for vendors and riders
- Reorder past orders

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
