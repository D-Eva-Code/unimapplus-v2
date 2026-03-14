const pool = require('../config/db');

// Get rider dashboard
async function getRiderDashboard(req, res) {
  try {
    const driverId = req.user.id;

    const [rider] = await pool.query('SELECT * FROM drivers_tb WHERE driver_id = ?', [driverId]);
    if (!rider[0]) return res.status(404).json({ success: false, message: 'Rider not found' });

    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_deliveries,
        SUM(CASE WHEN status = 'delivered' THEN rider_amount ELSE 0 END) as total_earnings,
        SUM(CASE WHEN status = 'delivered' AND DATE(created_at) = CURDATE() THEN rider_amount ELSE 0 END) as today_earnings
      FROM orders WHERE driver_id = ? AND status = 'delivered'
    `, [driverId]);

    // Active deliveries (rider can have multiple)
    const [activeOrders] = await pool.query(`
      SELECT o.*, v.vendor_name, v.location_name as vendor_location,
             v.latitude as vendor_lat, v.longitude as vendor_lng,
             s.fullname as student_name, s.phone as student_phone
      FROM orders o
      JOIN vendors_tb v ON o.vendor_id = v.vendor_id
      JOIN students_tb s ON o.student_id = s.st_id
      WHERE o.driver_id = ? AND o.status IN ('rider_assigned','picked_up','on_the_way')
      ORDER BY o.created_at ASC
    `, [driverId]);

    for (const order of activeOrders) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.order_id]);
      order.items = items;
    }

    // Available new orders to accept (from same school, unassigned)
    const [availableOrders] = await pool.query(`
      SELECT o.*, v.vendor_name, v.location_name as vendor_location,
             s.fullname as student_name
      FROM orders o
      JOIN vendors_tb v ON o.vendor_id = v.vendor_id
      JOIN students_tb s ON o.student_id = s.st_id
      WHERE o.driver_id IS NULL AND o.status IN ('ready','paid')
        AND v.school_id = ?
      ORDER BY o.created_at ASC
      LIMIT 10
    `, [rider[0].school_id]);

    for (const order of availableOrders) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.order_id]);
      order.items = items;
    }

    const { passwd: _, ...safeRider } = rider[0];

    return res.json({
      success: true,
      rider: safeRider,
      stats: stats[0],
      activeOrders,
      availableOrders,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error fetching dashboard' });
  }
}

// Toggle availability
async function toggleAvailability(req, res) {
  try {
    const driverId = req.user.id;
    const [rider] = await pool.query('SELECT is_available FROM drivers_tb WHERE driver_id = ?', [driverId]);
    const newStatus = !rider[0].is_available;
    await pool.query('UPDATE drivers_tb SET is_available = ? WHERE driver_id = ?', [newStatus, driverId]);
    return res.json({ success: true, is_available: newStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

// Accept an order
async function acceptOrder(req, res) {
  try {
    const driverId = req.user.id;
    const { order_id } = req.params;

    // Check order is still unassigned and in acceptable state (ready or paid)
    const [order] = await pool.query(
      "SELECT * FROM orders WHERE order_id = ? AND driver_id IS NULL AND status IN ('ready','paid','preparing')",
      [order_id]
    );
    if (!order[0]) return res.status(400).json({ success: false, message: 'Order no longer available' });

    const updated = await pool.query(
      "UPDATE orders SET driver_id = ?, status = 'rider_assigned' WHERE order_id = ? AND driver_id IS NULL",
      [driverId, order_id]
    );
    if (updated[0].affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Order was just taken by another rider' });
    }

    // Notify student
    const io = req.app.get('io');
    if (io) {
      io.to(`order_${order_id}`).emit('order_status_updated', { order_id, status: 'rider_assigned', driver_id: driverId });
    }

    return res.json({ success: true, message: 'Order accepted!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error accepting order' });
  }
}

// Update order status (picked_up, on_the_way)
async function updateDeliveryStatus(req, res) {
  try {
    const driverId = req.user.id;
    const { order_id } = req.params;
    const { status } = req.body;

    const allowed = ['picked_up', 'on_the_way'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [order] = await pool.query('SELECT * FROM orders WHERE order_id = ? AND driver_id = ?', [order_id, driverId]);
    if (!order[0]) return res.status(404).json({ success: false, message: 'Order not found' });

    await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, order_id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`order_${order_id}`).emit('order_status_updated', { order_id, status });
    }

    return res.json({ success: true, status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

// Update rider's live location
async function updateLocation(req, res) {
  try {
    const driverId = req.user.id;
    const { latitude, longitude } = req.body;

    await pool.query(
      'UPDATE drivers_tb SET current_latitude = ?, current_longitude = ? WHERE driver_id = ?',
      [latitude, longitude, driverId]
    );

    // Broadcast to all active orders of this rider
    const [activeOrders] = await pool.query(
      `SELECT order_id FROM orders WHERE driver_id = ? AND status IN ('rider_assigned','picked_up','on_the_way')`,
      [driverId]
    );

    const io = req.app.get('io');
    if (io) {
      for (const order of activeOrders) {
        io.to(`order_${order.order_id}`).emit('rider_location', { order_id: order.order_id, latitude, longitude });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

// Get rider earnings history
async function getEarningsHistory(req, res) {
  try {
    const driverId = req.user.id;
    const [orders] = await pool.query(`
      SELECT o.order_id, o.rider_amount, o.created_at, o.updated_at,
             v.vendor_name, s.fullname as student_name
      FROM orders o
      JOIN vendors_tb v ON o.vendor_id = v.vendor_id
      JOIN students_tb s ON o.student_id = s.st_id
      WHERE o.driver_id = ? AND o.status = 'delivered'
      ORDER BY o.updated_at DESC LIMIT 50
    `, [driverId]);
    return res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

module.exports = { getRiderDashboard, toggleAvailability, acceptOrder, updateDeliveryStatus, updateLocation, getEarningsHistory };
