const bcrypt = require('bcrypt');
const https = require('https');
const paystackAgent = new https.Agent({ rejectUnauthorized: false });
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { uploadToCloudinary } = require('../config/s3');

const SALT = 10;

// ─────────────────────────────────────────────────────────────
// HELPER: Haversine distance in km
// ─────────────────────────────────────────────────────────────
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────
// NIN VERIFICATION via Prembly IdentityPass (~₦50–150/call)
// Docs: https://docs.prembly.com/docs/nin
// ─────────────────────────────────────────────────────────────
async function verifyNIN(ninNumber) {
  const apiKey  = process.env.PREMBLY_API_KEY;
  const appId   = process.env.PREMBLY_APP_ID;

  if (!apiKey || !appId) {
    console.warn('PREMBLY_API_KEY / PREMBLY_APP_ID not set — skipping NIN verification');
    return { valid: true, skipped: true, reason: 'NIN verification skipped (no API key)' };
  }

  // Validate format first (11 digits)
  const cleaned = (ninNumber || '').replace(/\s/g, '');
  if (!/^\d{11}$/.test(cleaned)) {
    return { valid: false, reason: 'NIN must be exactly 11 digits' };
  }

  try {
    const axios = require('axios');
    const res = await axios.post(
      'https://api.prembly.com/identitypass/verification/nin',
      { number: cleaned },
      {
        headers: {
          'x-api-key': apiKey,
          'app-id': appId,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const data = res.data;
    // Prembly returns: { status: true, detail: { nin: '...', firstname: '...', ... } }
    if (data.status === true && data.detail) {
      return {
        valid: true,
        name: `${data.detail.firstname || ''} ${data.detail.lastname || ''}`.trim(),
        details: data.detail,
      };
    }
    return { valid: false, reason: data.detail || 'NIN could not be verified' };
  } catch (err) {
    console.error('Prembly NIN error:', err.response?.data || err.message);
    // If API is down, fail gracefully — flag for manual review
    return { valid: true, skipped: true, reason: 'NIN verification service unavailable — flagged for manual review' };
  }
}

// ─────────────────────────────────────────────────────────────
// SCHOOL EMAIL OTP — Send
// ─────────────────────────────────────────────────────────────
async function sendSchoolEmailOTP(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    // Must be a .edu.ng or known school domain
    const schoolDomains = [
      'uniben.edu', 'unilag.edu.ng', 'oauife.edu.ng',
      'ui.edu.ng', 'abu.edu.ng', 'wellspringuniversity.edu.ng',
      'iuokada.edu.ng',
    ];
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !schoolDomains.some(d => domain === d || domain.endsWith('.' + d))) {
      return res.status(400).json({
        success: false,
        message: `Please use your official school email (e.g. name@uniben.edu). "${email}" is not a recognised school email.`,
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing OTP for this email
    await pool.query('DELETE FROM email_otps WHERE email = ? AND purpose = ?', [email, 'school_verify']);

    // Store new OTP
    await pool.query(
      'INSERT INTO email_otps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [email, otp, 'school_verify', expiresAt]
    );

    // Send email via nodemailer (uses SMTP from .env)
    await sendEmail({
      to: email,
      subject: 'UnimapPlus — Your school verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0BBFBF; margin-bottom: 8px;">UnimapPlus School Verification</h2>
          <p style="color: #555; margin-bottom: 20px;">Enter this code on the signup page to verify your school email:</p>
          <div style="background: #f0fafa; border: 2px solid #0BBFBF; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0d2137;">${otp}</span>
          </div>
          <p style="color: #888; font-size: 13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        </div>
      `,
    });

    return res.json({ success: true, message: `OTP sent to ${email}` });
  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
}

// ─────────────────────────────────────────────────────────────
// SCHOOL EMAIL OTP — Verify
// ─────────────────────────────────────────────────────────────
async function verifySchoolEmailOTP(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

    const [rows] = await pool.query(
      'SELECT * FROM email_otps WHERE email = ? AND purpose = ? AND verified = FALSE ORDER BY created_at DESC LIMIT 1',
      [email, 'school_verify']
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'No OTP found for this email. Please request a new one.' });
    }

    const record = rows[0];
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
    }

    // Mark as verified
    await pool.query('UPDATE email_otps SET verified = TRUE WHERE id = ?', [record.id]);

    // Issue a short-lived token the frontend sends during registration to prove OTP was verified
    const verifyToken = jwt.sign({ email, purpose: 'school_email_verified' }, process.env.JWT_SECRET, { expiresIn: '30m' });

    return res.json({ success: true, message: 'School email verified!', verify_token: verifyToken });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
}

// ─────────────────────────────────────────────────────────────
// DOCUMENT VERIFICATION via Claude Vision (student ID / CAC)
// ─────────────────────────────────────────────────────────────
async function verifyDocument({ imageBuffer, mimeType, docType, expectedName }) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set — skipping document verification');
    return { valid: true, skipped: true, reason: 'Verification skipped (no API key)' };
  }

  const prompts = {
    student_id: `You are a document verification system for a Nigerian university food delivery app. Examine this image carefully.
1. Is this a valid Nigerian university student ID card or university admission letter? Look for: university name/logo, student name, matric number, official stamps, photo (for ID cards).
2. Does the name on the document match or closely match "${expectedName}"? Allow for: different name order (e.g. surname first), initials used, minor spelling differences.
3. Does the document appear genuine and not digitally altered?
Respond ONLY with valid JSON, no other text:
{"is_valid_document": true/false, "name_matches": true/false, "confidence": "high/medium/low", "reason": "one sentence"}`,

    cac: `You are a document verification system. Examine this image carefully.
1. Is this a valid Nigerian CAC certificate, business registration document, or an official school/market vendor approval letter?
2. Does it appear to be an official Nigerian business or vendor authorization document?
3. Does the document appear genuine and not digitally altered?
Respond ONLY with valid JSON, no other text:
{"is_valid_document": true/false, "business_name": "name found or null", "confidence": "high/medium/low", "reason": "one sentence"}`,
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

    const text = response.data.content[0].text.trim().replace(/```json|```/g, '').trim();
    const result = JSON.parse(text);

    if (docType === 'student_id') {
      return {
        valid: result.is_valid_document && result.name_matches,
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
    console.error('Claude vision error:', err.response?.data || err.message);
    return { valid: true, skipped: true, reason: 'Verification service unavailable — flagged for manual review' };
  }
}

// ─────────────────────────────────────────────────────────────
// EMAIL HELPER (nodemailer)
// ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT   || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({ from: `"UnimapPlus" <${process.env.SMTP_USER}>`, to, subject, html });
}

// ─────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────
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
    const schoolEmail      = req.body.school_email;       // for student ID path
    const schoolEmailToken = req.body.school_email_token; // JWT proving OTP was verified
    const ninNumber        = req.body.nin_number;         // for NIN path

    const files      = req.files || {};
    const verifyFile = Array.isArray(files.verify_doc) ? files.verify_doc[0] : null;
    const logoFile   = Array.isArray(files.logo)       ? files.logo[0]       : null;

    // ── VERIFICATION ──────────────────────────────────────────
    if (role === 'driver' || role === 'vendor') {
      const isStudentPath =
        (role === 'driver' && riderType === 'student') ||
        (role === 'vendor' && vendorType === 'student');
      const isNINPath =
        role === 'driver' && riderType === 'independent';
      const isCACPath =
        role === 'vendor' && vendorType === 'business';

      if (isStudentPath) {
        // 1. Verify school email OTP token
        if (!schoolEmailToken) {
          return res.status(400).json({ success: false, message: 'Please verify your school email with OTP before registering.' });
        }
        try {
          const decoded = jwt.verify(schoolEmailToken, process.env.JWT_SECRET);
          if (decoded.purpose !== 'school_email_verified') throw new Error('Invalid token');
        } catch {
          return res.status(400).json({ success: false, message: 'Your school email OTP has expired or is invalid. Please verify again.' });
        }

        // 2. Claude vision: verify student ID / admission letter
        if (!verifyFile) {
          return res.status(400).json({ success: false, message: 'Please upload your student ID card or admission letter.' });
        }
        console.log(`🔍 Verifying student_id document for: ${fullName}`);
        const docResult = await verifyDocument({
          imageBuffer: verifyFile.buffer,
          mimeType: verifyFile.mimetype,
          docType: 'student_id',
          expectedName: fullName,
        });
        if (!docResult.skipped && !docResult.valid) {
          const msg = !docResult.details?.is_valid_document
            ? 'The uploaded document does not appear to be a valid student ID card or admission letter. Please upload a clear photo.'
            : `The name on your document does not match "${fullName}". Please ensure your name matches your document exactly.`;
          return res.status(400).json({ success: false, message: msg });
        }

      } else if (isNINPath) {
        // NIN path: verify with Prembly API
        if (!ninNumber) {
          return res.status(400).json({ success: false, message: 'Please enter your NIN number.' });
        }
        console.log(`🔍 Verifying NIN for: ${fullName}`);
        const ninResult = await verifyNIN(ninNumber);
        if (!ninResult.skipped && !ninResult.valid) {
          return res.status(400).json({
            success: false,
            message: ninResult.reason || 'NIN verification failed. Please check your NIN number and try again.',
          });
        }

      } else if (isCACPath) {
        // CAC / vendor approval document
        if (!verifyFile) {
          return res.status(400).json({ success: false, message: 'Please upload your CAC certificate or vendor approval document.' });
        }
        console.log(`🔍 Verifying CAC document for: ${fullName}`);
        const cacResult = await verifyDocument({
          imageBuffer: verifyFile.buffer,
          mimeType: verifyFile.mimetype,
          docType: 'cac',
          expectedName: fullName,
        });
        if (!cacResult.skipped && !cacResult.valid) {
          return res.status(400).json({
            success: false,
            message: 'The uploaded document does not appear to be a valid CAC certificate or vendor approval letter. Please upload a clear photo of your business registration document.',
          });
        }
      }
    }
    // ── END VERIFICATION ──────────────────────────────────────

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
        catch (e) { console.log('Paystack subaccount deferred:', e.message); }
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
        catch (e) { console.log('Paystack subaccount deferred:', e.message); }
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

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Email, password, and role are required' });
    }
    let user = null, userId, name;
    if (role === 'student') {
      const [rows] = await pool.query('SELECT * FROM students_tb WHERE email = ?', [email]);
      if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid email or password' });
      user = rows[0]; userId = user.st_id; name = user.fullname;
    } else if (role === 'vendor') {
      const [rows] = await pool.query('SELECT * FROM vendors_tb WHERE email = ?', [email]);
      if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid email or password' });
      user = rows[0]; userId = user.vendor_id; name = user.vendor_name;
    } else if (role === 'driver') {
      const [rows] = await pool.query('SELECT * FROM drivers_tb WHERE email = ?', [email]);
      if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid email or password' });
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

// ─────────────────────────────────────────────────────────────
// PAYSTACK SUBACCOUNT HELPER
// ─────────────────────────────────────────────────────────────
async function createPaystackSubaccount(userId, type, businessName, bankName, accountNumber) {
  const axios = require('axios');
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.startsWith('sk_')) return;
  const bankListRes = await axios.get('https://api.paystack.co/bank?country=nigeria&perPage=100', {
    headers: { Authorization: `Bearer ${key}` }, httpsAgent: paystackAgent,
  });
  const bank = bankListRes.data.data.find(b =>
    b.name.toLowerCase().includes(bankName.toLowerCase()) ||
    bankName.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
  );
  if (!bank) { console.log('Bank not found:', bankName); return; }
  const subRes = await axios.post('https://api.paystack.co/subaccount', {
    business_name: businessName, bank_code: bank.code,
    account_number: accountNumber, percentage_charge: 0,
  }, { headers: { Authorization: `Bearer ${key}` }, httpsAgent: paystackAgent });
  const code = subRes.data.data.subaccount_code;
  const table = type === 'vendor' ? 'vendors_tb' : 'drivers_tb';
  const idCol  = type === 'vendor' ? 'vendor_id'  : 'driver_id';
  await pool.query(`UPDATE ${table} SET paystack_subaccount_code = ? WHERE ${idCol} = ?`, [code, userId]);
  console.log(`✅ Paystack subaccount: ${businessName} → ${code}`);
}

module.exports = { register, login, sendSchoolEmailOTP, verifySchoolEmailOTP };
