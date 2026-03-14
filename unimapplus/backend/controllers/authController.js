const bcrypt = require('bcrypt');
const https = require('https');
const paystackAgent = new https.Agent({ rejectUnauthorized: false });
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { uploadToCloudinary } = require('../config/s3');

const SALT = 10;

async function register(req, res) {
  try {
    const { fullName, email, password, role, school_id, phone, bank_name, account_number, account_name } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }

    const validRoles = ['student', 'vendor', 'driver'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const hash = await bcrypt.hash(password, SALT);
    let userId;

    if (role === 'student') {
      const [existing] = await pool.query('SELECT st_id FROM students_tb WHERE email = ?', [email]);
      if (existing.length > 0) return res.status(409).json({ success: false, message: 'Email already registered' });

      const [result] = await pool.query(
        'INSERT INTO students_tb (fullname, email, passwd, school_id, phone) VALUES (?, ?, ?, ?, ?)',
        [fullName, email, hash, school_id || null, phone || null]
      );
      userId = result.insertId;

    } else if (role === 'vendor') {
      const [existing] = await pool.query('SELECT vendor_id FROM vendors_tb WHERE email = ?', [email]);
      if (existing.length > 0) return res.status(409).json({ success: false, message: 'Email already registered' });

      const { category, description: vendorDesc } = req.body;

      // Upload logo if provided
      let logo_url = null;
      if (req.file) {
        try { logo_url = await uploadToCloudinary(req.file.buffer, 'unimapplus/logos'); } catch (e) { console.log('Logo upload failed:', e.message); }
      }

      const [result] = await pool.query(
        'INSERT INTO vendors_tb (vendor_name, email, passwd, school_id, phone, bank_name, account_number, account_name, category, description, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [fullName, email, hash, school_id || null, phone || null, bank_name || null, account_number || null, account_name || null, category || null, vendorDesc || null, logo_url]
      );
      userId = result.insertId;

      // Create Paystack subaccount if banking info provided
      if (bank_name && account_number && account_name) {
        try {
          await createPaystackSubaccount(userId, 'vendor', fullName, bank_name, account_number);
        } catch (e) {
          console.log('Paystack subaccount creation deferred:', e.message);
        }
      }

    } else if (role === 'driver') {
      const [existing] = await pool.query('SELECT driver_id FROM drivers_tb WHERE email = ?', [email]);
      if (existing.length > 0) return res.status(409).json({ success: false, message: 'Email already registered' });

      const [result] = await pool.query(
        'INSERT INTO drivers_tb (fullname, email, passwd, school_id, phone, bank_name, account_number, account_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [fullName, email, hash, school_id || null, phone || null, bank_name || null, account_number || null, account_name || null]
      );
      userId = result.insertId;

      if (bank_name && account_number && account_name) {
        try {
          await createPaystackSubaccount(userId, 'driver', fullName, bank_name, account_number);
        } catch (e) {
          console.log('Paystack subaccount creation deferred:', e.message);
        }
      }
    }

    const token = jwt.sign({ id: userId, role, name: fullName, school_id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      message: `${role} registered successfully`,
      token,
      user: { id: userId, name: fullName, email, role, school_id }
    });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Email, password, and role are required' });
    }

    let user = null;
    let userId, name;

    if (role === 'student') {
      const [rows] = await pool.query('SELECT * FROM students_tb WHERE email = ?', [email]);
      if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });
      user = rows[0]; userId = user.st_id; name = user.fullname;
    } else if (role === 'vendor') {
      const [rows] = await pool.query('SELECT * FROM vendors_tb WHERE email = ?', [email]);
      if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });
      user = rows[0]; userId = user.vendor_id; name = user.vendor_name;
    } else if (role === 'driver') {
      const [rows] = await pool.query('SELECT * FROM drivers_tb WHERE email = ?', [email]);
      if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });
      user = rows[0]; userId = user.driver_id; name = user.fullname;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const valid = await bcrypt.compare(password, user.passwd);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = jwt.sign({ id: userId, role, name, school_id: user.school_id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const { passwd: _, ...safeUser } = user;
    return res.json({ success: true, token, user: { ...safeUser, role } });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function createPaystackSubaccount(userId, type, businessName, bankName, accountNumber) {
  const axios = require('axios');
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.startsWith('sk_')) return;

  // Get bank list and find matching bank code
  const bankListRes = await axios.get('https://api.paystack.co/bank?country=nigeria&perPage=100', {
    headers: { Authorization: `Bearer ${key}` },
    httpsAgent: paystackAgent,
  });
  const bank = bankListRes.data.data.find(b =>
    b.name.toLowerCase().includes(bankName.toLowerCase()) ||
    bankName.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
  );
  if (!bank) { console.log('Bank not found:', bankName); return; }

  // percentage_charge = 0 because we handle split manually in checkout
  // Paystack subaccount just needs to exist so we can send money there
  const subRes = await axios.post('https://api.paystack.co/subaccount', {
    business_name: businessName,
    bank_code: bank.code,
    account_number: accountNumber,
    percentage_charge: 0,
  }, {
    headers: { Authorization: `Bearer ${key}` },
    httpsAgent: paystackAgent,
  });

  const code = subRes.data.data.subaccount_code;
  const table = type === 'vendor' ? 'vendors_tb' : 'drivers_tb';
  const idCol = type === 'vendor' ? 'vendor_id' : 'driver_id';
  await pool.query(`UPDATE ${table} SET paystack_subaccount_code = ? WHERE ${idCol} = ?`, [code, userId]);
  console.log(`✅ Paystack subaccount created for ${type}: ${businessName} → ${code}`);
}

module.exports = { register, login };
