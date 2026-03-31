const pool = require('../config/db');

// Get all vendors for a school
async function getVendors(req, res) {
  try {
    const { school_id, search } = req.query;
    let query = `
      SELECT v.vendor_id, v.vendor_name, v.description, v.category, v.logo_url, 
             v.location_name, v.latitude, v.longitude, v.is_open,
             v.rating, v.total_ratings, s.name as school_name
      FROM vendors_tb v
      LEFT JOIN schools s ON v.school_id = s.school_id
      WHERE 1=1
    `;
    const params = [];

    if (school_id) {
      query += ' AND v.school_id = ?';
      params.push(school_id);
    }
    if (search) {
      query += ' AND (v.vendor_name LIKE ? OR v.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY v.is_open DESC, v.rating DESC';

    const [vendors] = await pool.query(query, params);
    return res.json({ success: true, vendors });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error fetching vendors' });
  }
}

// Get vendor menu
async function getVendorMenu(req, res) {
  // try {
  //   const { vendor_id } = req.params;
  //   const { tag, search } = req.query;

  //   let query = `
  //     SELECT * FROM menu_items WHERE vendor_id = ? AND is_available = TRUE
  //   `;
  //   const params = [vendor_id];

  //   if (tag) {
  //     query += ` AND JSON_CONTAINS(tags, JSON_QUOTE(?))`;
  //     params.push(tag);
  //   }
  //   if (search) {
  //     query += ' AND (item_name LIKE ? OR description LIKE ?)';
  //     params.push(`%${search}%`, `%${search}%`);
  //   }
  //   query += ' ORDER BY item_name';

  //   const [items] = await pool.query(query, params);
  //   return res.json({ success: true, items });
  // } catch (err) {
  //   console.error(err);
  //   return res.status(500).json({ success: false, message: 'Error fetching menu' });
  // }
  try {
    const { vendor_id } = req.params;
    const { tag, search } = req.query;

    let query = `
      SELECT * FROM menu_items WHERE vendor_id = ? AND is_available = TRUE
    `;
    const params = [vendor_id];

    if (tag) {
      query += ` AND JSON_CONTAINS(tags, JSON_QUOTE(?))`;
      params.push(tag);
    }
    if (search) {
      query += ' AND (item_name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY item_name';

    const [items] = await pool.query(query, params);

    // FIX: Manually parse the JSON columns if they come back as strings
    const formattedItems = items.map(item => {
      return {
        ...item,
        tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags,
        variants: typeof item.variants === 'string' ? JSON.parse(item.variants || '[]') : item.variants,
        toppings: typeof item.toppings === 'string' ? JSON.parse(item.toppings || '[]') : item.toppings
      };
    });

    return res.json({ success: true, items: formattedItems });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error fetching menu' });
  }
}

// Add menu item (vendor only)
async function addMenuItem(req, res) {
  try {
    const vendorId = req.user.id;
    const { uploadToCloudinary } = require('../config/s3');
    const { item_name, description, price, tags, prep_time, item_type, variants, toppings, allow_design_notes } = req.body;
    const image_url = req.file ? await uploadToCloudinary(req.file.buffer, 'unimapplus/menu') : null;

    if (!item_name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price required' });
    }

    const tagsArray = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [];
    const allowDesignNotes =
    allow_design_notes === true || allow_design_notes === "1" || allow_design_notes === 1
      ? 1
      : 0;
    const [result] = await pool.query(
      'INSERT INTO menu_items (vendor_id, item_name, description, price, image_url, tags, prep_time, item_type, variants, toppings, allow_design_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [vendorId, item_name, description || '', price, image_url, JSON.stringify(tagsArray), prep_time || 15, item_type || 'food', variants || '[]', toppings || '[]', allowDesignNotes]
    );

    const [item] = await pool.query('SELECT * FROM menu_items WHERE menu_id = ?', [result.insertId]);
    return res.status(201).json({ success: true, item: item[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error adding menu item' });
  }
}

// Update menu item
async function updateMenuItem(req, res) {
  try {
    const vendorId = req.user.id;
    const { menu_id } = req.params;
    const { item_name, description, price, tags, is_available, prep_time, item_type, variants, toppings, allow_design_notes } = req.body;
    const image_url = req.file ? await uploadToCloudinary(req.file.buffer, 'unimapplus/menu') : undefined;

    // Ensure this item belongs to the vendor
    const [check] = await pool.query('SELECT * FROM menu_items WHERE menu_id = ? AND vendor_id = ?', [menu_id, vendorId]);
    if (check.length === 0) return res.status(403).json({ success: false, message: 'Not authorized' });

    const tagsArray = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : check[0].tags;

    const updates = { item_name, description, price, tags: JSON.stringify(tagsArray), is_available };
    if (prep_time !== undefined) updates.prep_time = prep_time;
    if (item_type !== undefined) updates.item_type = item_type;
    if (variants !== undefined) {
    updates.variants = typeof variants === 'string' ? variants : JSON.stringify(variants);
      }
      if (toppings !== undefined) {
          updates.toppings = typeof toppings === 'string' ? toppings : JSON.stringify(toppings);
      }
      if (allow_design_notes !== undefined) {
          updates.allow_design_notes =
          allow_design_notes === true ||
          allow_design_notes === "1" ||
          allow_design_notes === 1
            ? 1
            : 0;
            }
    if (image_url) updates.image_url = image_url;

    const setClauses = Object.keys(updates).filter(k => updates[k] !== undefined).map(k => `${k} = ?`).join(', ');
    const vals = Object.keys(updates).filter(k => updates[k] !== undefined).map(k => updates[k]);

    await pool.query(`UPDATE menu_items SET ${setClauses} WHERE menu_id = ?`, [...vals, menu_id]);
    const [updated] = await pool.query('SELECT * FROM menu_items WHERE menu_id = ?', [menu_id]);
    return res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error updating item' });
  }
}

// Delete menu item
async function deleteMenuItem(req, res) {
  try {
    const vendorId = req.user.id;
    const { menu_id } = req.params;
    const [check] = await pool.query('SELECT * FROM menu_items WHERE menu_id = ? AND vendor_id = ?', [menu_id, vendorId]);
    if (check.length === 0) return res.status(403).json({ success: false, message: 'Not authorized' });
    await pool.query('DELETE FROM menu_items WHERE menu_id = ?', [menu_id]);
    return res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error deleting item' });
  }
}

// Vendor dashboard stats
async function getVendorDashboard(req, res) {
  try {
    const vendorId = req.user.id;

    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'delivered' THEN vendor_amount ELSE 0 END) as total_earnings,
        SUM(CASE WHEN status = 'delivered' AND DATE(created_at) = CURDATE() THEN vendor_amount ELSE 0 END) as today_earnings,
        SUM(CASE WHEN status IN ('paid','accepted','preparing','ready','rider_assigned','picked_up','on_the_way') THEN 1 ELSE 0 END) as pending_orders
      FROM orders WHERE vendor_id = ?
    `, [vendorId]);

    const [activeOrders] = await pool.query(`
      SELECT o.*, s.fullname as student_name, s.phone as student_phone,
             d.fullname as driver_name, d.phone as driver_phone
      FROM orders o
      JOIN students_tb s ON o.student_id = s.st_id
      LEFT JOIN drivers_tb d ON o.driver_id = d.driver_id
      WHERE o.vendor_id = ? AND o.status IN ('paid','accepted','preparing','rider_assigned','picked_up','on_the_way')
      ORDER BY o.created_at DESC
    `, [vendorId]);

    // Attach items to each order
    for (const order of activeOrders) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.order_id]);
      order.items = items;
    }

    const [vendor] = await pool.query('SELECT * FROM vendors_tb WHERE vendor_id = ?', [vendorId]);

    return res.json({
      success: true,
      stats: stats[0],
      activeOrders,
      vendor: vendor[0]
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error fetching dashboard' });
  }
}

// Toggle vendor open/closed
async function toggleOpen(req, res) {
  try {
    const vendorId = req.user.id;
    const [vendor] = await pool.query('SELECT is_open FROM vendors_tb WHERE vendor_id = ?', [vendorId]);
    const newStatus = !vendor[0].is_open;
    await pool.query('UPDATE vendors_tb SET is_open = ? WHERE vendor_id = ?', [newStatus, vendorId]);
    return res.json({ success: true, is_open: newStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

// Get vendor order history
async function getOrderHistory(req, res) {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [orders] = await pool.query(`
      SELECT o.*, s.fullname as student_name
      FROM orders o
      JOIN students_tb s ON o.student_id = s.st_id
      WHERE o.vendor_id = ? AND o.status IN ('delivered','cancelled')
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [vendorId, parseInt(limit), parseInt(offset)]);

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

// Update order status (vendor: accept → preparing → ready)
async function updateOrderStatus(req, res) {
  try {
    const vendorId = req.user.id;
    const { order_id } = req.params;
    const { status } = req.body;

    const allowed = ['accepted', 'preparing', 'ready', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [order] = await pool.query('SELECT * FROM orders WHERE order_id = ? AND vendor_id = ?', [order_id, vendorId]);
    if (order.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, order_id]);

    const io = req.app.get('io');

    // When vendor marks ready — notify ALL available riders in that school
    if (status === 'ready') {
      const [riders] = await pool.query(
        'SELECT driver_id FROM drivers_tb WHERE is_available = TRUE AND school_id = (SELECT school_id FROM vendors_tb WHERE vendor_id = ?)',
        [vendorId]
      );
      riders.forEach(r => {
        if (io) io.to(`rider_${r.driver_id}`).emit('new_available_order', {
          order_id,
          vendor_name: order[0].vendor_id,
          message: 'New order ready for pickup!'
        });
      });
    }

    // Always notify student of status change
    if (io) io.to(`order_${order_id}`).emit('order_status_updated', { order_id, status });
    // Notify vendor room too
    if (io) io.to(`vendor_${vendorId}`).emit('order_status_updated', { order_id, status });

    return res.json({ success: true, message: `Order ${status}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

async function getFeaturedMenu(req, res) {
  try {
    const { school_id } = req.query;
    let query = `
      SELECT m.menu_id, m.item_name, m.price, m.image_url, m.tags,
             v.vendor_id, v.vendor_name, v.category
      FROM menu_items m
      JOIN vendors_tb v ON m.vendor_id = v.vendor_id
      WHERE m.is_available = 1 AND v.is_open = 1
    `;
    const params = [];
    if (school_id) { query += ' AND v.school_id = ?'; params.push(school_id); }
    query += ' ORDER BY RAND() LIMIT 6';
    const [items] = await pool.query(query, params);
    return res.json({ success: true, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, items: [] });
  }
}

module.exports = { getVendors, getVendorMenu, getFeaturedMenu, addMenuItem, updateMenuItem, deleteMenuItem, getVendorDashboard, toggleOpen, getOrderHistory, updateOrderStatus };
