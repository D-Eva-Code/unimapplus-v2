const pool = require('../config/db');

async function getAllLocations(req, res) {
  try {
    const { school_id } = req.query;
    let query = `
      SELECT cl.*, s.name as school_name
      FROM campus_locations cl
      LEFT JOIN schools s ON cl.school_id = s.school_id
      WHERE 1=1
    `;
    const params = [];
    if (school_id) { query += ' AND cl.school_id = ?'; params.push(school_id); }
    query += ' ORDER BY cl.category, cl.name';
    const [locations] = await pool.query(query, params);
    return res.json({ success: true, locations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Global search: foods + eateries + locations
async function globalSearch(req, res) {
  try {
    const { q, school_id, tag } = req.query;
    if (!q && !tag) return res.json({ success: true, vendors: [], foods: [], locations: [] });

    const results = { vendors: [], foods: [], locations: [] };

    if (q) {
      // Search vendors
      let vendorQ = `SELECT v.*, s.name as school_name FROM vendors_tb v LEFT JOIN schools s ON v.school_id = s.school_id WHERE (v.vendor_name LIKE ? OR v.description LIKE ?)`;
      const vendorParams = [`%${q}%`, `%${q}%`];
      if (school_id) { vendorQ += ' AND v.school_id = ?'; vendorParams.push(school_id); }
      const [vendors] = await pool.query(vendorQ, vendorParams);
      results.vendors = vendors;

      // Search campus locations
      let locQ = `SELECT * FROM campus_locations WHERE (name LIKE ? OR description LIKE ?)`;
      const locParams = [`%${q}%`, `%${q}%`];
      if (school_id) { locQ += ' AND school_id = ?'; locParams.push(school_id); }
      const [locations] = await pool.query(locQ, locParams);
      results.locations = locations;
    }

    // Search foods by name or tag
    let foodQ = `
      SELECT m.*, v.vendor_name, v.school_id, v.is_open
      FROM menu_items m
      JOIN vendors_tb v ON m.vendor_id = v.vendor_id
      WHERE m.is_available = TRUE
    `;
    const foodParams = [];

    if (q) {
      // Search by name, description, OR tags (so "spicy" or "sweet" finds tagged items)
      foodQ += ' AND (m.item_name LIKE ? OR m.description LIKE ? OR JSON_CONTAINS(m.tags, JSON_QUOTE(?)))';
      foodParams.push(`%${q}%`, `%${q}%`, q.toLowerCase().trim());
    }
    if (tag) {
      foodQ += ' AND JSON_CONTAINS(m.tags, JSON_QUOTE(?))';
      foodParams.push(tag);
    }
    if (school_id) {
      foodQ += ' AND v.school_id = ?';
      foodParams.push(school_id);
    }
    foodQ += ' ORDER BY v.is_open DESC, m.item_name LIMIT 30';

    const [foods] = await pool.query(foodQ, foodParams);
    results.foods = foods;

    return res.json({ success: true, ...results });
  } catch (err) {
  console.error(err);
  
  return res.status(500).json({ success: false, message: err.message }); 
}
}

async function getSchools(req, res) {
  try {
    const [schools] = await pool.query('SELECT * FROM schools ORDER BY name');
    return res.json({ success: true, schools });
  } catch (err) {
  console.error(err);
  
  return res.status(500).json({ success: false, message: err.message }); 
}
}

async function addLocation(req, res) {
  try {
    const { school_id, name, category, latitude, longitude, description } = req.body;
    const [result] = await pool.query(
      'INSERT INTO campus_locations (school_id, name, category, latitude, longitude, description) VALUES (?,?,?,?,?,?)',
      [school_id, name, category, latitude, longitude, description]
    );
    return res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
  console.error(err);
  
  return res.status(500).json({ success: false, message: err.message }); 
}
}

module.exports = { getAllLocations, globalSearch, getSchools, addLocation };
