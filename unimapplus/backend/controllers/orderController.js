const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const https = require('https');

// Fix SSL/TLS issues with Paystack on Windows Node.js
const paystackAgent = new https.Agent({ rejectUnauthorized: false });

const PAYSTACK_BASE = 'https://api.paystack.co';
const DELIVERY_FEE = 300;    // ₦300 delivery fee
const PACKING_FEE  = 200;    // ₦200 packing fee (one pack) for food vendors (not bakery/foodstuff)
const PLATFORM_FEE_PCT = 0.07; // 7% platform fee goes to Unimap
const VENDOR_SHARE_PCT = 0.93;  // vendor gets 93% of food subtotal
const NO_PACKING_CATEGORIES = ['bakery', 'foodstuff', 'drinks']; // these don't get packing fee

// Initialize checkout / create order + payment
async function checkout(req, res) {
  try {
    const studentId = req.user.id;
    const { vendor_id, cart, delivery_address, delivery_latitude, delivery_longitude, special_instructions } = req.body;

    if (!cart || cart.length === 0) return res.status(400).json({ success: false, message: 'Cart is empty' });

    // Fetch vendor first so we can determine packing fee from category
    const [vendor] = await pool.query('SELECT * FROM vendors_tb WHERE vendor_id = ?', [vendor_id]);
    if (!vendor[0]) return res.status(404).json({ success: false, message: 'Vendor not found' });
    if (!vendor[0].is_open) return res.status(400).json({ success: false, message: 'This eatery is currently closed. Please try again later.' });

    // Packing fee: free for bakery, drinks, foodstuff — ₦200 for food vendors
    const packingFee = NO_PACKING_CATEGORIES.includes(vendor[0].category) ? 0 : PACKING_FEE;

    // Verify all items and calculate subtotal (portions multiplied in)
    let subtotal = 0;
    const verifiedItems = [];

    for (const cartItem of cart) {
      const [menuRows] = await pool.query(
        'SELECT * FROM menu_items WHERE menu_id = ? AND vendor_id = ? AND is_available = TRUE',
        [cartItem.menu_id, vendor_id]
      );
      if (menuRows.length === 0) return res.status(400).json({ success: false, message: `Item ${cartItem.menu_id} not available` });
      const item = menuRows[0];
      const portions = cartItem.portions || 1;
      subtotal += item.price * cartItem.quantity * portions;
      verifiedItems.push({ ...item, quantity: cartItem.quantity, portions });
    }

    // Fee breakdown:
    // Student pays: subtotal + packing + delivery + service fee (7% of subtotal)
    // Vendor gets:  subtotal + packing fee
    // Rider gets:   delivery fee
    // Unimap keeps: service fee (7% of subtotal)
    const platformFee  = Math.round(subtotal * PLATFORM_FEE_PCT * 100) / 100;
    const vendorAmount = subtotal + packingFee; // vendor gets food + packing
    const riderAmount  = DELIVERY_FEE;
    const totalAmount  = subtotal + DELIVERY_FEE + packingFee + platformFee;

    const [student] = await pool.query('SELECT * FROM students_tb WHERE st_id = ?', [studentId]);
    const orderId    = uuidv4();
    const paymentRef = `UNIMAP-${orderId.slice(0, 8).toUpperCase()}`;

    // Validate Paystack key
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey || paystackKey.includes('your_paystack') || !paystackKey.startsWith('sk_')) {
      return res.status(500).json({ success: false, message: 'Paystack not configured. Add your PAYSTACK_SECRET_KEY to .env' });
    }

    // Get rider subaccount if one is assigned to this order's school
    const [availableRider] = await pool.query(
      'SELECT * FROM drivers_tb WHERE is_available = TRUE AND school_id = ? AND paystack_subaccount_code IS NOT NULL LIMIT 1',
      [vendor[0].school_id]
    );

    // Build Paystack split:
    // - Vendor gets vendorAmount (93% of subtotal)
    // - Rider gets riderAmount (₦300 delivery)  
    // - Unimap keeps the rest (7% platform fee) in main Paystack account
    // We use Paystack's "split" feature with flat amounts
    const splits = [];

    if (vendor[0].paystack_subaccount_code) {
      splits.push({
        subaccount: vendor[0].paystack_subaccount_code,
        share: Math.round(vendorAmount * 100), // kobo
      });
    }

    if (availableRider[0]?.paystack_subaccount_code) {
      splits.push({
        subaccount: availableRider[0].paystack_subaccount_code,
        share: Math.round(riderAmount * 100), // kobo
      });
    }

    let paystackBody = {
      email: student[0].email,
      amount: Math.round(totalAmount * 100), // kobo
      reference: paymentRef,
      callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
      metadata: {
        order_id: orderId,
        student_id: studentId,
        vendor_id,
        packing_fee: packingFee,
        vendor_amount: vendorAmount,
        rider_amount: riderAmount,
        platform_fee: platformFee,
      },
    };

    // Add split if we have subaccounts
    if (splits.length > 0) {
      paystackBody.split = {
        type: 'flat',
        bearer_type: 'account', // Unimap (main account) bears Paystack fees
        subaccounts: splits,
      };
    }

    // Initialize Paystack transaction
    const paystackRes = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, paystackBody, {
      headers: { Authorization: `Bearer ${paystackKey}` },
      httpsAgent: paystackAgent,
    });

    // Create order in DB
    await pool.query(
      `INSERT INTO orders (order_id, student_id, vendor_id, total_amount, delivery_fee, vendor_amount, rider_amount,
       payment_reference, delivery_address, delivery_latitude, delivery_longitude, special_instructions, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [orderId, studentId, vendor_id, totalAmount, DELIVERY_FEE + packingFee, vendorAmount, riderAmount,
       paymentRef, delivery_address, delivery_latitude, delivery_longitude, special_instructions]
    );

    // Save order items (with portions note in item_name)
    for (const item of verifiedItems) {
      const itemName = item.portions > 1 ? `${item.item_name} (${item.portions} portions)` : item.item_name;
      await pool.query(
        'INSERT INTO order_items (order_id, menu_id, item_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.menu_id, itemName, item.quantity, item.price * item.portions]
      );
    }

    return res.json({
      success: true,
      order_id: orderId,
      payment_url: paystackRes.data.data.authorization_url,
      reference: paymentRef,
      total: totalAmount,
      breakdown: { subtotal, delivery: DELIVERY_FEE, packing: packingFee, platform: platformFee },
    });

  } catch (err) {
    console.error('Checkout error:', err.response?.data || err);
    return res.status(500).json({ success: false, message: 'Checkout failed' });
  }
}

// Verify payment after Paystack redirect
async function verifyPayment(req, res) {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ success: false, message: 'Reference required' });

    const paystackRes = await axios.get(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      httpsAgent: paystackAgent,
    });

    const { status, metadata } = paystackRes.data.data;

    if (status === 'success') {
      const { order_id } = metadata;

      await pool.query(
        `UPDATE orders SET payment_status = 'paid', status = 'paid' WHERE order_id = ? AND payment_reference = ?`,
        [order_id, reference]
      );

      // Auto-assign available rider from same school
      const [order] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
      // Don't auto-assign rider - vendor must accept first, then mark ready, then riders are notified

      // Notify vendor via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`vendor_${order[0]?.vendor_id}`).emit('new_order', { order_id });
      }

      return res.json({ success: true, message: 'Payment verified', order_id });
    } else {
      await pool.query(`UPDATE orders SET payment_status = 'failed' WHERE payment_reference = ?`, [reference]);
      return res.status(400).json({ success: false, message: 'Payment failed' });
    }
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
}

// Paystack webhook (server-to-server)
async function paystackWebhook(req, res) {
  try {
    const hash = require('crypto')
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      const { reference, metadata } = data;
      const order_id = metadata?.order_id;
      if (order_id) {
        await pool.query(
          `UPDATE orders SET payment_status = 'paid', status = 'paid' WHERE order_id = ? AND payment_reference = ?`,
          [order_id, reference]
        );
        const [order] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
        // Don't auto-assign rider - vendor must accept first, then mark ready, then riders are notified

        const io = req._io;
        if (io) io.to(`vendor_${order[0]?.vendor_id}`).emit('new_order', { order_id });
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    return res.sendStatus(500);
  }
}

// Auto-assign nearest available rider
async function autoAssignRider(order) {
  const [vendor] = await pool.query('SELECT school_id FROM vendors_tb WHERE vendor_id = ?', [order.vendor_id]);
  const schoolId = vendor[0]?.school_id;

  const [riders] = await pool.query(
    'SELECT * FROM drivers_tb WHERE is_available = TRUE AND school_id = ? ORDER BY total_deliveries ASC LIMIT 5',
    [schoolId]
  );

  if (riders.length > 0) {
    // Pick rider with fewest active orders
    const rider = riders[0];
    await pool.query(
      `UPDATE orders SET driver_id = ?, status = 'rider_assigned' WHERE order_id = ?`,
      [rider.driver_id, order.order_id]
    );
    return rider;
  }
  return null;
}

// Rider confirms delivery with location verification
async function confirmDelivery(req, res) {
  try {
    const driverId = req.user.id;
    const { order_id } = req.params;
    const { rider_latitude, rider_longitude } = req.body;

    const [order] = await pool.query('SELECT * FROM orders WHERE order_id = ? AND driver_id = ?', [order_id, driverId]);
    if (!order[0]) return res.status(404).json({ success: false, message: 'Order not found' });

    // GPS is optional — store for audit trail if provided
    // Only enforce proximity check if delivery has stored coordinates
    if (rider_latitude && rider_longitude) {
      // Store rider location as audit trail
      await pool.query(
        'UPDATE orders SET rider_latitude = ?, rider_longitude = ? WHERE order_id = ?',
        [rider_latitude, rider_longitude, order_id]
      );

      // If delivery also has stored coords, verify proximity
      if (order[0].delivery_latitude && order[0].delivery_longitude) {
        const dist = getDistanceKm(rider_latitude, rider_longitude, order[0].delivery_latitude, order[0].delivery_longitude);
        if (dist > 0.5) {
          return res.status(400).json({
            success: false,
            message: `You are ${(dist * 1000).toFixed(0)}m from the delivery location. Get closer to confirm.`,
            distance_meters: Math.round(dist * 1000)
          });
        }
      }
    }
    // If no GPS provided, allow delivery — rider tapped the button manually

    await pool.query(`UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE order_id = ?`, [order_id]);

    // Update rider stats
    const [o] = await pool.query('SELECT rider_amount FROM orders WHERE order_id = ?', [order_id]);
    await pool.query(
      `UPDATE drivers_tb SET 
        total_earnings = total_earnings + ?,
        today_earnings = today_earnings + ?,
        total_deliveries = total_deliveries + 1
       WHERE driver_id = ?`,
      [o[0].rider_amount, o[0].rider_amount, driverId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`order_${order_id}`).emit('order_status_updated', { order_id, status: 'delivered' });
    }

    return res.json({ success: true, message: 'Delivery confirmed!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error confirming delivery' });
  }
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Get student orders
async function getStudentOrders(req, res) {
  try {
    const studentId = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT o.*, v.vendor_name, v.logo_url, v.location_name as vendor_location,
             d.fullname as driver_name, d.phone as driver_phone,
             d.current_latitude as rider_lat, d.current_longitude as rider_lng
      FROM orders o
      JOIN vendors_tb v ON o.vendor_id = v.vendor_id
      LEFT JOIN drivers_tb d ON o.driver_id = d.driver_id
      WHERE o.student_id = ?
    `;
    const params = [studentId];

    if (status === 'active') {
      query += ` AND o.status NOT IN ('delivered','cancelled')`;
    } else if (status === 'history') {
      query += ` AND o.status IN ('delivered','cancelled')`;
    }

    query += ' ORDER BY o.created_at DESC LIMIT 50';

    const [orders] = await pool.query(query, params);
    for (const order of orders) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.order_id]);
      order.items = items;
    }

    return res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

// Get single order details (for tracking)
async function getOrder(req, res) {
  try {
    const { order_id } = req.params;
    const [rows] = await pool.query(`
      SELECT o.*, v.vendor_name, v.logo_url, v.location_name as vendor_location,
             v.latitude as vendor_lat, v.longitude as vendor_lng,
             d.fullname as driver_name, d.phone as driver_phone,
             d.current_latitude as rider_lat, d.current_longitude as rider_lng
      FROM orders o
      JOIN vendors_tb v ON o.vendor_id = v.vendor_id
      LEFT JOIN drivers_tb d ON o.driver_id = d.driver_id
      WHERE o.order_id = ?
    `, [order_id]);

    if (!rows[0]) return res.status(404).json({ success: false, message: 'Order not found' });

    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order_id]);
    rows[0].items = items;

    return res.json({ success: true, order: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}


// Admin: delete a stuck/unpaid order (only pending/failed)
async function deleteOrder(req, res) {
  try {
    const { order_id } = req.params;
    const studentId = req.user.id;
    // Only allow deleting your own pending/unpaid orders
    const [order] = await pool.query(
      "SELECT * FROM orders WHERE order_id = ? AND student_id = ? AND status = 'pending' AND payment_status = 'pending'",
      [order_id, studentId]
    );
    if (!order[0]) return res.status(404).json({ success: false, message: 'Order not found or cannot be deleted' });
    await pool.query('DELETE FROM order_items WHERE order_id = ?', [order_id]);
    await pool.query('DELETE FROM orders WHERE order_id = ?', [order_id]);
    return res.json({ success: true, message: 'Order deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}


// Student sends bakery order for vendor review (NO PAYMENT YET)
async function requestReview(req, res) {
  try {
    const studentId = req.user.id;
    const { vendor_id, items, delivery_address } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    // Create order (NO payment yet)
    const orderId = uuidv4();
    console.log('Creating order with:', {
      orderId,
      studentId,
      vendor_id,
      delivery_address
    });

    try{
    await pool.query(
      `INSERT INTO orders (order_id, student_id, vendor_id, delivery_address, status, payment_status)
       VALUES (?, ?, ?, ?, 'pending_review', 'pending')`,
      [orderId, studentId, vendor_id, delivery_address]
    );
    } catch (err) {
  console.error('Failed to insert order:', err);
  return res.status(500).json({ success: false, message: 'Order creation failed', detail: err.sqlMessage });
}
    // Save items WITH design_note
    for (const item of items) {
  try {
    await pool.query(
      `INSERT INTO order_items (order_id, menu_id, quantity, price, design_note)
       VALUES (?, ?, ?, ?, ?)`,
      [
        orderId,
        item.menu_id,
        item.quantity,
        item.price || 0,
        item.design_note || ''
      ]
    );
  } catch (err) {
    console.error('Failed to insert order item:', item, err);
    return res.status(500).json({ success: false, message: 'Failed to add item', detail: err.sqlMessage });
  }
}
    // Notify vendor (socket)
    const io = req.app.get('io');
    if (io) {
      io.to(`vendor_${vendor_id}`).emit('new_review_order', { order_id: orderId });
    }

    return res.json({
      success: true,
      message: 'Order sent for vendor review',
      order_id: orderId
    });

  } catch (err) {
    console.error('Request review error:', err);
    return res.status(500).json({ success: false, message: 'Failed to request review' });
  }
}

// Vendor updates price after seeing design note
async function updatePrice(req, res) {
  try {
    const vendorId = req.user.id;
    const { order_id, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    // Verify order belongs to vendor
    const [order] = await pool.query(
      'SELECT * FROM orders WHERE order_id = ? AND vendor_id = ?',
      [order_id, vendorId]
    );

    if (!order[0]) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let newTotal = 0;

    // Update each item price
    for (const item of items) {
      await pool.query(
        `UPDATE order_items 
         SET price = ?
         WHERE order_id = ? AND menu_id = ?`,
        [item.price, order_id, item.menu_id]
      );

      newTotal += item.price * item.quantity;
    }

    // Update order total + status
    await pool.query(
      `UPDATE orders 
       SET total_amount = ?, status = 'awaiting_payment'
       WHERE order_id = ?`,
      [newTotal, order_id]
    );

    // Notify student
    const io = req.app.get('io');
    if (io) {
      io.to(`student_${order[0].student_id}`).emit('price_updated', {
        order_id,
        total: newTotal
      });
    }

    return res.json({
      success: true,
      message: 'Price updated, waiting for student payment'
    });

  } catch (err) {
    console.error('Update price error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update price' });
  }
}

module.exports = { checkout, verifyPayment, paystackWebhook, confirmDelivery, getStudentOrders, getOrder, autoAssignRider, deleteOrder, requestReview, updatePrice };
