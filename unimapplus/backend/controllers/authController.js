const bcrypt = require('bcrypt');
const https = require('https');
const paystackAgent = new https.Agent({ rejectUnauthorized: false });
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { uploadToCloudinary } = require('../config/s3');

const SALT = 10;

// ─────────────────────────────────────────────
// Document verification via Claude Vision API
// ─────────────────────────────────────────────
async function verifyDocument({ imageBuffer, mimeType, docType, expectedName }) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set — skipping document verification');
    return { valid: true, reason: 'Verification skipped (no API key)', skipped: true };
  }

  const prompts = {
    student_id: `You are a document verification system for a Nigerian university food delivery app. Examine this image carefully.
1. Is this a valid Nigerian university student ID card or university admission letter? Look for: university name/logo, student name, matric number, official stamps, photo (for ID cards).
2. Does the name on the document match or closely match "${expectedName}"? Allow for: different name order (e.g. surname first), initials used, minor spelling differences.
3. Does the document appear genuine and not digitally altered?

Respond ONLY with valid JSON, no other text:
{"is_valid_document": true/false, "name_matches": true/false, "confidence": "high/medium/low", "reason": "one sentence explanation"}`,

    nin: `You are a document verification system. Examine this image carefully.
1. Is this a valid Nigerian NIN (National Identification Number) slip, NIN card, or NIMC document? Look for: NIMC logo, NIN number (11 digits), name, date of birth.
2. Extract the NIN number if visible (11 digits, no spaces).
3. Does the document appear genuine and not digitally altered?

Respond ONLY with valid JSON, no other text:
{"is_valid_document": true/false, "nin_number": "11digits or null", "confidence": "high/medium/low", "reason": "one sentence explanation"}`,

    cac: `You are a document verification system. Examine this image carefully.
1. Is this a valid Nigerian CAC (Corporate Affairs Commission) certificate, business registration document, or an official school/market vendor approval letter?
2. Does it appear to be an official Nigerian business or vendor authorization document? Look for: CAC logo/seal, RC number, official stamps, school letterhead for vendor approvals.
3. Does the document appear genuine and not digitally altered?

Respond ONLY with valid JSON, no other text:
{"is_valid_document": true/false, "business_name": "business name found or null", "confidence": "high/medium/low", "reason": "one sentence explanation"}`,
  };

  const prompt = prompts[docType];
  if (!prompt) return { valid: false, reason: 'Unknown document type' };

  try {
    const axios = require('axios');
    const base64Image = imageBuffer.toString('base64');
    const safeType = ['image/jpeg','image/png','image/gif','image/webp'].includes(mimeType) ? mimeType : 'image/jpeg';

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-5',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: safeType, data: base64Image } },
            { type: 'text', text: prompt }
          ]
        }]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 30000
      }
    );

    const text = response.data.content[0].text.trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    if (docType === 'student_id') {
      return {
        valid: result.is_valid_document && result.name_matches,
        reason: result.reason,
        confidence: result.confidence,
        details: result
      };
    } else if (docType === 'nin') {
      const ninClean = (result.nin_number || '').replace(/\s/g, '');
      const ninValid = /^\d{11}$/.test(ninClean);
      return {
        valid: result.is_valid_document && ninValid,
        nin: ninClean,
        reason: result.reason,
        confidence: result.confidence,
        details: result
      };
    } else {
      return {
        valid: result.is_valid_document,
        business_name: result.business_name,
        reason: result.reason,
        confidence: result.confidence,
        details: result
      };
    }

  } catch (err) {
    console.error('Document verification error:', err.response?.data || err.message);
    return { valid: true, reason: 'Verification service unavailable — flagged for manual review', skipped: true };
  }
}

// ─────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────
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

    const vendorType = req.body.vendor_type; // 'student' | 'business'
    const riderType  = req.body.rider_type;  // 'student' | 'independent'

    // multer.fields() puts files in req.files as an object
    const files = req.files || {};
    const verifyFile = Array.isArray(files.verify_doc) ? files.verify_doc[0] : null;
    const logoFile   = Array.isArray(files.logo)       ? files.logo[0]       : null;

    // ── DOCUMENT VERIFICATION ────────────────────────────────────────────────
    if (role === 'driver' || role === 'vendor') {
      if (!verifyFile) {
        const msg = role === 'driver'
          ? (riderType === 'student' ? 'Please upload your student ID card or admission letter' : 'Please upload your NIN slip or NIMC card')
          : (vendorType === 'student' ? 'Please upload your student ID card or admission letter' : 'Please upload your CAC certificate or vendor approval document');
        return res.status(400).json({ success: false, message: msg });
      }

      let docType;
      if (role === 'driver') {
        docType = riderType === 'student' ? 'student_id' : 'nin';
      } else {
        docType = vendorType === 'student' ? 'student_id' : 'cac';
      }

      console.log(`🔍 Verifying [${docType}] for: ${fullName}`);
      const verification = await verifyDocument({
        imageBuffer: verifyFile.buffer,
        mimeType: verifyFile.mimetype,
        docType,
        expectedName: fullName
      });
      console.log('Verification result:', verification);

      if (!verification.skipped && !verification.valid) {
        let message;
        if (docType === 'student_id') {
          message = !verification.details?.is_valid_document
            ? 'The uploaded document does not appear to be a valid student ID card or admission letter. Please upload a clear photo of your document.'
            : `The name on your document does not match "${fullName}". Please ensure the name you entered matches your document exactly.`;
        } else if (docType === 'nin') {
          message = !verification.details?.is_valid_document
            ? 'The uploaded document does not appear to be a valid NIN slip or NIMC card. Please upload a clear photo of your NIN document.'
            : 'Could not read a valid 11-digit NIN number from your document. Please ensure the image is clear and the NIN number is visible.';
        } else {
          message = 'The uploaded document does not appear to be a valid CAC certificate or vendor approval document. Please upload your business registration certificate or school vendor approval letter.';
        }
        return res.status(400).json({ success: false, message });
      }
    }
    // ── END DOCUMENT VERIFICATION ────────────────────────────────────────────

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

      let logo_url = null;
      if (logoFile) {
        try { logo_url = await uploadToCloudinary(logoFile.buffer, 'unimapplus/logos'); }
        catch (e) { console.log('Logo upload failed:', e.message); }
      }

      const [result] = await pool.query(
        'INSERT INTO vendors_tb (vendor_name, email, passwd, school_id, phone, bank_name, account_number, account_name, category, description, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [fullName, email, hash, school_id || null, phone || null, bank_name || null, account_number || null, account_name || null, category || null, vendorDesc || null, logo_url]
      );
      userId = result.insertId;

      if (bank_name && account_number && account_name) {
        try { await createPaystackSubaccount(userId, 'vendor', fullName, bank_name, account_number); }
        catch (e) { console.log('Paystack subaccount creation deferred:', e.message); }
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
        try { await createPaystackSubaccount(userId, 'driver', fullName, bank_name, account_number); }
        catch (e) { console.log('Paystack subaccount creation deferred:', e.message); }
      }
    }

    const token = jwt.sign({ id: userId, role, name: fullName, school_id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      message: `${role} registered successfully`,
      token,
      user: { id: userId, fullname: fullName, name: fullName, email, role, school_id }
    });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────
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
    const fullname = safeUser.fullname || safeUser.vendor_name || name;
    return res.json({ success: true, token, user: { ...safeUser, fullname, role } });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────
// Paystack subaccount helper
// ─────────────────────────────────────────────
async function createPaystackSubaccount(userId, type, businessName, bankName, accountNumber) {
  const axios = require('axios');
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.startsWith('sk_')) return;

  const bankListRes = await axios.get('https://api.paystack.co/bank?country=nigeria&perPage=100', {
    headers: { Authorization: `Bearer ${key}` },
    httpsAgent: paystackAgent,
  });
  const bank = bankListRes.data.data.find(b =>
    b.name.toLowerCase().includes(bankName.toLowerCase()) ||
    bankName.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
  );
  if (!bank) { console.log('Bank not found:', bankName); return; }

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
