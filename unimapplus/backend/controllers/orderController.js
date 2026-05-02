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
    const { vendor_id, cart, delivery_address, delivery_latitude, delivery_longitude, special_instructions, payment_option } = req.body;
    const paymentOption = payment_option === 'pay_on_delivery' ? 'pay_on_delivery' : 'pay_together';

    if (!cart || cart.length === 0) return res.status(400).json({ success: false, message: 'Cart is empty' });

    // Fetch vendor first so we can determine packing fee from category
    const [vendor] = await pool.query('SELECT * FROM vendors_tb WHERE vendor_id = ?', [vendor_id]);
    if (!vendor[0]) return res.status(404).json({ success: false, message: 'Vendor not found' });
    if (!vendor[0].is_open) return res.status(400).json({ success: false, message: 'This eatery is currently closed. Please try again later.' });

    // Packing fee: free for bakery, drinks, foodstuff — ₦200 for food vendors
    // Also free if ALL items in cart are drinks (item_type='drink')
    const vendorPackingExempt = NO_PACKING_CATEGORIES.includes(vendor[0].category);
    // We'll check allDrinks after verifying items below
    let packingFee = vendorPackingExempt ? 0 : PACKING_FEE; // may be overridden below

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
      // Use custom_price if provided (includes toppings/variants), else use DB price
      const unitPrice = cartItem.custom_price && Number(cartItem.custom_price) > 0
        ? Number(cartItem.custom_price)
        : item.price;
      subtotal += unitPrice * cartItem.quantity * portions;
      verifiedItems.push({ ...item, price: unitPrice, quantity: cartItem.quantity, portions, design_note: cartItem.design_note || '' });
    }

    // If not already exempt and all items are drinks or snacks/pastries, waive packing fee
    if (!vendorPackingExempt) {
      const allNoPackItems = verifiedItems.every(i => i.item_type === 'drink' || i.item_type === 'snacks_pastries');
      if (allNoPackItems) packingFee = 0;
    }

    // Use dynamic delivery fee sent from frontend (location-based), fallback to constant
    const requestedFee = req.body.delivery_fee ? Number(req.body.delivery_fee) : null;
    const effectiveDeliveryFee = (requestedFee && requestedFee >= 600 && requestedFee <= 3000)
      ? requestedFee
      : DELIVERY_FEE;

    // Fee breakdown:
    // Student pays: subtotal + packing + delivery + service fee (7% of subtotal)
    // Vendor gets:  subtotal + packing fee
    // Rider gets:   delivery fee
    // Unimap keeps: service fee (7% of subtotal)
    const platformFee  = Math.round(subtotal * PLATFORM_FEE_PCT * 100) / 100;
    const vendorAmount = subtotal + packingFee; // vendor gets food + packing
    const riderAmount  = effectiveDeliveryFee;
    // pay_together: student pays everything in-app (food + packing + delivery + platform fee)
    // pay_on_delivery: student pays only food + packing + platform fee in-app; delivery fee paid cash to rider
    const totalAmount  = paymentOption === 'pay_on_delivery'
      ? subtotal + packingFee + platformFee
      : subtotal + effectiveDeliveryFee + packingFee + platformFee;

    const [student] = await pool.query('SELECT * FROM students_tb WHERE st_id = ?', [studentId]);
    const orderId    = uuidv4();
    const paymentRef = `UNIMAP-${orderId.slice(0, 8).toUpperCase()}`;

    // Validate Paystack key
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey || paystackKey.includes('your_paystack') || !paystackKey.startsWith('sk_')) {
      return res.status(500).json({ success: false, message: 'Paystack not configured. Add your PAYSTACK_SECRET_KEY to .env' });
    }

    // Full amount goes into Unimap's main Paystack account.
    // Vendor and rider are paid out via Paystack Transfers after delivery is confirmed.
    const paystackBody = {
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

    // Initialize Paystack transaction
    const paystackRes = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, paystackBody, {
      headers: { Authorization: `Bearer ${paystackKey}` },
      httpsAgent: paystackAgent,
    });

    // Create order in DB
    await pool.query(
      `INSERT INTO orders (order_id, student_id, vendor_id, total_amount, delivery_fee, vendor_amount, rider_amount,
       payment_reference, delivery_address, delivery_latitude, delivery_longitude, special_instructions, payment_option, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [orderId, studentId, vendor_id, totalAmount, DELIVERY_FEE + packingFee, vendorAmount, riderAmount,
       paymentRef, delivery_address, delivery_latitude, delivery_longitude, special_instructions, paymentOption]
    );

    // Save order items (with portions note in item_name)
    for (const item of verifiedItems) {
      const portionLabel = item.portions > 1 ? ` (${item.portions} portions)` : '';
      const noteLabel = item.design_note ? ` [Note: ${item.design_note}]` : '';
      const itemName = item.item_name + portionLabel + noteLabel;
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
      breakdown: { subtotal, delivery: paymentOption === 'pay_on_delivery' ? 0 : effectiveDeliveryFee, packing: packingFee, platform: platformFee },
      payment_option: paymentOption,
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

      const io = req.app.get('io');
      if (io) {
        io.to(`vendor_${order[0]?.vendor_id}`).emit('new_order', { order_id });
        io.to(`order_${order_id}`).emit('order_status_updated', { order_id, status: 'paid' });
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
        if (io) {
          io.to(`vendor_${order[0]?.vendor_id}`).emit('new_order', { order_id });
          io.to(`order_${order_id}`).emit('order_status_updated', { order_id, status: 'paid' });
        }
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

// Paystack Transfer helper — sends money from Unimap's balance to a recipient
async function paystackTransfer(recipientCode, amountNaira, reason) {
  try {
    const res = await axios.post(`${PAYSTACK_BASE}/transfer`, {
      source: 'balance',
      amount: Math.round(amountNaira * 100), // kobo
      recipient: recipientCode,
      reason,
    }, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      httpsAgent: paystackAgent,
    });
    return { success: true, data: res.data };
  } catch (err) {
    console.error('Paystack transfer error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data || err.message };
  }
}

// Rider confirms delivery with location verification
async function confirmDelivery(req, res) {
  try {
    const driverId = req.user.id;
    const { order_id } = req.params;
    const { latitude, longitude } = req.body;

    const [order] = await pool.query('SELECT * FROM orders WHERE order_id = ? AND driver_id = ?', [order_id, driverId]);
    if (!order[0]) return res.status(404).json({ success: false, message: 'Order not found' });

    // GPS is required
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location required to confirm delivery. Please enable GPS and try again.',
      });
    }

    // Store rider delivery location for audit
    await pool.query(
      'UPDATE orders SET rider_latitude = ?, rider_longitude = ? WHERE order_id = ?',
      [latitude, longitude, order_id]
    );

    // Enforce proximity check — delivery coordinates are required
    if (!order[0].delivery_latitude || !order[0].delivery_longitude) {
      return res.status(400).json({
        success: false,
        message: 'This order has no delivery coordinates on record. Cannot confirm delivery location.',
      });
    }
    const dist = getDistanceKm(latitude, longitude, order[0].delivery_latitude, order[0].delivery_longitude);
    if (dist > 0.5) {
      return res.status(400).json({
        success: false,
        message: `You are ${(dist * 1000).toFixed(0)}m from the delivery location. Get within 500m to confirm.`,
        distance_meters: Math.round(dist * 1000),
      });
    }

    // Mark delivered
    await pool.query(`UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE order_id = ?`, [order_id]);

    // Update rider DB stats
    await pool.query(
      `UPDATE drivers_tb SET 
        total_earnings = total_earnings + ?,
        today_earnings = today_earnings + ?,
        total_deliveries = total_deliveries + 1
       WHERE driver_id = ?`,
      [order[0].rider_amount, order[0].rider_amount, driverId]
    );

    // Fire socket update to student
    const io = req.app.get('io');
    if (io) {
      io.to(`order_${order_id}`).emit('order_status_updated', { order_id, status: 'delivered' });
    }

    // ── PAYSTACK TRANSFERS ────────────────────────────────────────────────
    // For pay_on_delivery orders, the rider already collected the delivery fee in cash.
    // Only transfer to vendor (and skip rider transfer entirely).
    const isPOD = order[0].payment_option === 'pay_on_delivery';

    if (!isPOD) {
      // Transfer rider's delivery fee — only for pay_together orders
      const [rider] = await pool.query(
        'SELECT paystack_recipient_code, fullname FROM drivers_tb WHERE driver_id = ?',
        [driverId]
      );
      if (rider[0]?.paystack_recipient_code) {
        const riderTransfer = await paystackTransfer(
          rider[0].paystack_recipient_code,
          order[0].rider_amount,
          `Delivery fee - Order ${order_id.slice(0, 8).toUpperCase()}`
        );
        if (!riderTransfer.success) {
          console.error(`Rider transfer failed for order ${order_id}:`, riderTransfer.error);
          await pool.query(
            `INSERT INTO failed_transfers (order_id, recipient_type, recipient_id, amount, error, created_at)
             VALUES (?, 'rider', ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE error = VALUES(error), created_at = NOW()`,
            [order_id, driverId, order[0].rider_amount, JSON.stringify(riderTransfer.error)]
          );
        }
      } else {
        console.warn(`Rider ${driverId} has no paystack_recipient_code — payout skipped, log for manual transfer`);
        await pool.query(
          `INSERT INTO failed_transfers (order_id, recipient_type, recipient_id, amount, error, created_at)
           VALUES (?, 'rider', ?, ?, 'No recipient code', NOW())
           ON DUPLICATE KEY UPDATE error = VALUES(error)`,
          [order_id, driverId, order[0].rider_amount]
        ).catch(() => {});
      }
    }
    // For pay_on_delivery: rider collected delivery fee in cash — no transfer needed

    // Transfer vendor's amount to the vendor
    const [vendor] = await pool.query(
      'SELECT paystack_recipient_code, vendor_name FROM vendors_tb WHERE vendor_id = ?',
      [order[0].vendor_id]
    );
    if (vendor[0]?.paystack_recipient_code) {
      const vendorTransfer = await paystackTransfer(
        vendor[0].paystack_recipient_code,
        order[0].vendor_amount,
        `Order payment - Order ${order_id.slice(0, 8).toUpperCase()}`
      );
      if (!vendorTransfer.success) {
        console.error(`Vendor transfer failed for order ${order_id}:`, vendorTransfer.error);
        await pool.query(
          `INSERT INTO failed_transfers (order_id, recipient_type, recipient_id, amount, error, created_at)
           VALUES (?, 'vendor', ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE error = VALUES(error), created_at = NOW()`,
          [order_id, order[0].vendor_id, order[0].vendor_amount, JSON.stringify(vendorTransfer.error)]
        ).catch(() => {});
      }
    } else {
      console.warn(`Vendor ${order[0].vendor_id} has no paystack_recipient_code — payout skipped`);
      await pool.query(
        `INSERT INTO failed_transfers (order_id, recipient_type, recipient_id, amount, error, created_at)
         VALUES (?, 'vendor', ?, ?, 'No recipient code', NOW())
         ON DUPLICATE KEY UPDATE error = VALUES(error)`,
        [order_id, order[0].vendor_id, order[0].vendor_amount]
      ).catch(() => {});
    }
    // ─────────────────────────────────────────────────────────────────────

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
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const studentId = req.user.id;
    const { vendor_id, items, delivery_address } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    const orderId = uuidv4();

    await connection.query(
      `INSERT INTO orders (order_id, student_id, vendor_id, delivery_address, status, payment_status)
       VALUES (?, ?, ?, ?, 'pending_review', 'pending')`,
      [orderId, studentId, vendor_id, delivery_address]
    );

    for (const item of items) {
      const [menuRow] = await connection.query(
        'SELECT item_name FROM menu_items WHERE menu_id = ?',
        [item.menu_id]
      );

      if (!menuRow.length) {
        throw new Error(`Menu item not found: ${item.menu_id}`);
      }

      const baseName = menuRow[0].item_name;
      const itemName = item.design_note
        ? `${baseName} [Design: ${item.design_note}]`
        : baseName;

      await connection.query(
        `INSERT INTO order_items (order_id, menu_id, item_name, quantity, price)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.menu_id, itemName, item.quantity, item.price || 0]
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Order sent for vendor review',
      order_id: orderId
    });

  } catch (err) {
    await connection.rollback();
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to request review'
    });

  } finally {
    connection.release();
  }
}
// async function requestReview(req, res) {
//   try {
//     const studentId = req.user.id;
//     const { vendor_id, items, delivery_address } = req.body;

//     if (!items || items.length === 0) {
//       return res.status(400).json({ success: false, message: 'No items provided' });
//     }

//     // Create order (NO payment yet)
//     const orderId = uuidv4();
  
//     try{
//     await pool.query(
//       `INSERT INTO orders (order_id, student_id, vendor_id, delivery_address, status, payment_status)
//        VALUES (?, ?, ?, ?, 'pending_review', 'pending')`,
//       [orderId, studentId, vendor_id, delivery_address]
//     );
//     } catch (err) {
//   console.error('Failed to insert order:', err);
//   return res.status(500).json({ success: false, message: 'Order creation failed', detail: err.sqlMessage, error: err.message, sqlState: err.sqlState });
// }
//     // Save items — embed design_note into item_name since order_items has no design_note column
//     for (const item of items) {
//       try {
//         const [menuRow] = await pool.query('SELECT item_name FROM menu_items WHERE menu_id = ?', [item.menu_id]);
//         const baseName = menuRow[0]?.item_name || 'Item';
//         const itemName = item.design_note ? `${baseName} [Design: ${item.design_note}]` : baseName;
//         await pool.query(
//           'INSERT INTO order_items (order_id, menu_id, item_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
//           [orderId, item.menu_id, itemName, item.quantity, item.price || 0]
//         );
//       } catch (err) {
//         console.error('Failed to insert order item:', item, err);
//         return res.status(500).json({ success: false, message: 'Failed to add item', detail: err.sqlMessage });
//       }
//     }
//     // Notify vendor (socket)
//     const io = req.app.get('io');
//     if (io) {
//       io.to(`vendor_${vendor_id}`).emit('new_review_order', { order_id: orderId });
//     }

//     return res.json({
//       success: true,
//       message: 'Order sent for vendor review',
//       order_id: orderId
//     });

//   } catch (err) {
//   console.error('Request review error:', err);
//   if (err.sqlMessage) console.error('SQL Message:', err.sqlMessage);
//   if (err.code) console.error('Error code:', err.code);
//   return res.status(500).json({ success: false, message: 'Failed to request review' });
// }
// }

// Vendor updates price after seeing design note
async function updatePrice(req, res) {
  try {
    const vendorId = req.user.id;
    const { order_id, total } = req.body;

    const [order] = await pool.query(
      'SELECT * FROM orders WHERE order_id = ? AND vendor_id = ?',
      [order_id, vendorId]
    );

    if (!order[0]) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await pool.query(
      `UPDATE orders 
       SET total_amount = ?, vendor_amount = ?, status = 'awaiting_payment'
       WHERE order_id = ?`,
      [total, total, order_id]
    );

    // notify student
    const io = req.app.get('io');
    if (io) {
      io.to(`student_${order[0].student_id}`).emit('price_updated', {
        order_id,
        total
      });
    }

    return res.json({
      success: true,
      message: 'Order approved, awaiting payment'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error approving order' });
  }
}

// async function updatePrice(req, res) {
//   const connection = await pool.getConnection();

//   try {
//     await connection.beginTransaction();

//     const vendorId = req.user.id;
//     const { order_id, items } = req.body;

//     if (!items || items.length === 0) {
//       return res.status(400).json({ success: false, message: 'No items provided' });
//     }

//     // Verify order belongs to vendor
//     const [order] = await connection.query(
//       'SELECT * FROM orders WHERE order_id = ? AND vendor_id = ?',
//       [order_id, vendorId]
//     );

//     if (!order[0]) {
//       throw new Error('Order not found');
//     }

//     let newTotal = 0;

//     // SAFE LOOP
//     for (const item of items) {
//       if (!item.id || item.price == null || item.quantity == null) {
//         throw new Error('Invalid item data');
//       }

//       const [result] = await connection.query(
//         `UPDATE order_items 
//         SET price = ?
//         WHERE id = ?`,
//         [item.price, item.id]
//       );

//       if (result.affectedRows === 0) {
//         throw new Error(`Item not found for id ${item.id}`);
//       }

//       newTotal += item.price * item.quantity;
//     }

//     // Update order total + status
//     await connection.query(
//       `UPDATE orders 
//        SET total_amount = ?, status = 'awaiting_payment'
//        WHERE order_id = ?`,
//       [newTotal, order_id]
//     );

//     // Commit only if EVERYTHING worked
//     await connection.commit();

//     // Notify student (after commit)
//     const io = req.app.get('io');
//     if (io) {
//       io.to(`student_${order[0].student_id}`).emit('price_updated', {
//         order_id,
//         total: newTotal
//       });
//     }

//     return res.json({
//       success: true,
//       message: 'Price updated, waiting for student payment'
//     });

//   } catch (err) {
//     // Rollback EVERYTHING if any error occurs
//     await connection.rollback();

//     console.error('Update price error:', err);

//     return res.status(500).json({
//       success: false,
//       message: err.message || 'Failed to update price'
//     });

//   } finally {
//     connection.release();
//   }
// }


// Initialize Paystack payment for an existing awaiting_payment order (bakery review flow)
async function initializePayment(req, res) {
  try {
    const studentId = req.user.id;
    const { order_id, delivery_fee, delivery_address, delivery_latitude, delivery_longitude, payment_option } = req.body;
    const paymentOption = payment_option === 'pay_on_delivery' ? 'pay_on_delivery' : 'pay_together';

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'order_id required' });
    }

    // Fetch the order
    const [orderRows] = await pool.query(
      `SELECT o.*, v.paystack_subaccount_code as vendor_sub, v.category as vendor_category,
              s.email as student_email
       FROM orders o
       JOIN vendors_tb v ON o.vendor_id = v.vendor_id
       JOIN students_tb s ON o.student_id = s.st_id
       WHERE o.order_id = ? AND o.student_id = ? AND o.status = 'awaiting_payment'`,
      [order_id, studentId]
    );

    if (!orderRows[0]) {
      return res.status(404).json({ success: false, message: 'Order not found or not ready for payment' });
    }

    const order = orderRows[0];
    const vendorAmount = Number(order.total_amount); // vendor-set price is the subtotal
    const platformFee = Math.round(vendorAmount * PLATFORM_FEE_PCT * 100) / 100;

    // Use dynamic delivery fee from request, fallback to saved or default
    const effectiveDeliveryFee = delivery_fee && Number(delivery_fee) >= 600
      ? Number(delivery_fee)
      : (Number(order.delivery_fee) > 0 ? Number(order.delivery_fee) : DELIVERY_FEE);

    // pay_on_delivery: student pays only food + platform fee now; delivery fee paid cash to rider
    const totalAmount = paymentOption === 'pay_on_delivery'
      ? vendorAmount + platformFee
      : vendorAmount + effectiveDeliveryFee + platformFee;

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey || !paystackKey.startsWith('sk_')) {
      return res.status(500).json({ success: false, message: 'Paystack not configured' });
    }

    const paymentRef = `UNIMAP-${order_id.slice(0, 8).toUpperCase()}-R`;

    const paystackBody = {
      email: order.student_email,
      amount: Math.round(totalAmount * 100),
      reference: paymentRef,
      callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
      metadata: {
        order_id,
        student_id: studentId,
        vendor_id: order.vendor_id,
        vendor_amount: vendorAmount,
        rider_amount: effectiveDeliveryFee,
        platform_fee: platformFee,
      },
    };

    // No split — full amount lands in Unimap main account.
    // Vendor and rider are paid out via Paystack Transfers after delivery.

    const paystackRes = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      paystackBody,
      { headers: { Authorization: `Bearer ${paystackKey}` }, httpsAgent: paystackAgent }
    );

    // Update order with final totals, delivery info, and payment option
    const ipExtras = [];
    const ipValues = [totalAmount, effectiveDeliveryFee, effectiveDeliveryFee, paymentRef, paymentOption];
    let ipSql = 'UPDATE orders SET total_amount = ?, delivery_fee = ?, rider_amount = ?, payment_reference = ?, payment_option = ?';
    if (delivery_address) { ipSql += ', delivery_address = ?'; ipValues.push(delivery_address); }
    if (delivery_latitude) { ipSql += ', delivery_latitude = ?'; ipValues.push(delivery_latitude); }
    if (delivery_longitude) { ipSql += ', delivery_longitude = ?'; ipValues.push(delivery_longitude); }
    ipSql += ' WHERE order_id = ?';
    ipValues.push(order_id);
    await pool.query(ipSql, ipValues);

    return res.json({
      success: true,
      payment_url: paystackRes.data.data.authorization_url,
      reference: paymentRef,
      breakdown: {
        subtotal: vendorAmount,
        delivery: effectiveDeliveryFee,
        platform: platformFee,
        total: totalAmount,
      },
    });

  } catch (err) {
    console.error('initializePayment error:', err.response?.data || err);
    return res.status(500).json({ success: false, message: 'Failed to initialize payment' });
  }
}

module.exports = { checkout, verifyPayment, paystackWebhook, confirmDelivery, getStudentOrders, getOrder, autoAssignRider, deleteOrder, requestReview, updatePrice, initializePayment };
