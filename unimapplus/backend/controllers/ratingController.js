const pool = require('../config/db');

async function submitRating(req, res) {
  try {
    const studentId = req.user.id;
    const { order_id, vendor_rating, driver_rating, vendor_review, driver_review } = req.body;

    const [order] = await pool.query('SELECT * FROM orders WHERE order_id = ? AND student_id = ? AND status = ?', [order_id, studentId, 'delivered']);
    if (!order[0]) return res.status(400).json({ success: false, message: 'Cannot rate this order' });

    await pool.query(
      `INSERT INTO ratings (order_id, student_id, vendor_id, driver_id, vendor_rating, driver_rating, vendor_review, driver_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vendor_rating=VALUES(vendor_rating), driver_rating=VALUES(driver_rating),
       vendor_review=VALUES(vendor_review), driver_review=VALUES(driver_review)`,
      [order_id, studentId, order[0].vendor_id, order[0].driver_id, vendor_rating, driver_rating, vendor_review, driver_review]
    );

    // Update vendor average rating
    if (vendor_rating) {
      await pool.query(`
        UPDATE vendors_tb SET
          rating = (SELECT AVG(vendor_rating) FROM ratings WHERE vendor_id = ? AND vendor_rating IS NOT NULL),
          total_ratings = (SELECT COUNT(*) FROM ratings WHERE vendor_id = ? AND vendor_rating IS NOT NULL)
        WHERE vendor_id = ?
      `, [order[0].vendor_id, order[0].vendor_id, order[0].vendor_id]);
    }

    // Update driver average rating
    if (driver_rating && order[0].driver_id) {
      await pool.query(`
        UPDATE drivers_tb SET
          rating = (SELECT AVG(driver_rating) FROM ratings WHERE driver_id = ? AND driver_rating IS NOT NULL),
          total_ratings = (SELECT COUNT(*) FROM ratings WHERE driver_id = ? AND driver_rating IS NOT NULL)
        WHERE driver_id = ?
      `, [order[0].driver_id, order[0].driver_id, order[0].driver_id]);
    }

    return res.json({ success: true, message: 'Rating submitted!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

module.exports = { submitRating };
