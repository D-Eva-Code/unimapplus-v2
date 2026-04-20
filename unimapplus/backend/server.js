require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const routes = require('./routes/index');

const app = express();
const server = http.createServer(app);


// ── Temporary CORS ORIGIN FUNCTION ──────────────────────────────────────────────────────
const allowedOrigin = (origin, callback) => {
  const production = process.env.FRONTEND_URL;

  if (
    !origin ||
    origin === production ||
    // origin.endsWith('.vercel.app') ||
    origin === 'http://localhost:3000')
 {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// ── Temporary CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// const io = new Server(server, {
//   cors: {
//     origin: process.env.FRONTEND_URL || '*',
//     methods: ['GET', 'POST'],
//     credentials: true,
//   }
// });

//  ── CORS ──────────────────────────────────────────────────────────────────────
// app.use(cors({
//   origin: process.env.FRONTEND_URL || '*',
//   credentials: true,
// }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach io to app so controllers can access it
app.set('io', io);

// Paystack webhook needs raw body
app.use('/api/paystack/webhook', express.raw({ type: 'application/json' }));

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use('/api', routes);

app.get('/', (req, res) => res.json({ message: 'UnimapPlus API v2.0' }));

// ── SOCKET.IO REAL-TIME ───────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Student joins their order room to receive live tracking
  socket.on('join_order', (order_id) => {
    socket.join(`order_${order_id}`);
    console.log(`Socket joined order room: order_${order_id}`);
  });

  // Vendor joins their room
  socket.on('join_vendor', (vendor_id) => {
    socket.join(`vendor_${vendor_id}`);
    console.log(`Vendor joined: vendor_${vendor_id}`);
  });

  // Rider joins their room
  socket.on('join_rider', (driver_id) => {
    socket.join(`rider_${driver_id}`);
    console.log(`Rider joined: rider_${driver_id}`);
  });

  // Rider sends live location
  socket.on('rider_location_update', ({ order_id, latitude, longitude }) => {
    io.to(`order_${order_id}`).emit('rider_location', { order_id, latitude, longitude });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
UnimapPlus server running on port ${PORT}
http://localhost:${PORT}
WebSocket ready
  `);
});
