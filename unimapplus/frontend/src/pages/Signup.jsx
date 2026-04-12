import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TEAL = '#0BBFBF';

const VENDOR_CATEGORIES = [
  { value: 'african_food',  label: '🍲 African Food',       desc: 'Jollof, soups, stews, local dishes' },
  { value: 'fast_food',     label: '🍔 Fast Food',           desc: 'Burgers, shawarma, fried chicken' },
  { value: 'snacks',        label: '🥪 Snacks & Bites',      desc: 'Sandwiches, pies, small chops' },
  { value: 'drinks',        label: '🥤 Drinks & Beverages',  desc: 'Zobo, juices, smoothies, water' },
  { value: 'bakery',        label: '🍞 Bakery & Pastry',     desc: 'Bread, cakes, puff puff, chin chin' },
  { value: 'rice_dishes',   label: '🍚 Rice Dishes',         desc: 'Fried rice, ofada, coconut rice' },
  { value: 'protein',       label: '🍗 Proteins & Grills',   desc: 'Suya, grilled fish, peppered meat' },
  { value: 'vegetarian',    label: '🥗 Vegetarian',          desc: 'Salads, veggies, plant-based meals' },
  { value: 'foodstuff',     label: '🛒 Foodstuff & Grocery', desc: 'Provisions, ingredients, condiments' },
  { value: 'other',         label: '🍽️ Other',               desc: 'Something else entirely' },
];

const roleConfig = {
  student: { color: '#0BBFBF' },
  vendor:  { color: '#E87C2A' },
  driver:  { color: '#2D6A4F' },
};

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    role: 'student', school_id: '', phone: '',
    bank_name: '', account_number: '', account_name: '',
    category: '', description: '',
    vendor_type: 'student',   // 'student' | 'business'
    rider_type: 'student',    // 'student' | 'independent'
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyPreview, setVerifyPreview] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/schools').then(r => setSchools(r.data.schools || [])).catch(() => {});
  }, []);

  const cfg = roleConfig[form.role];
  const isVendor = form.role === 'vendor';
  const isDriver = form.role === 'driver';
  const isVendorOrRider = isVendor || isDriver;

  // What doc does this person need to upload?
  function getDocInfo() {
    if (isDriver) {
      return form.rider_type === 'student'
        ? { label: 'Student ID Card or Admission Letter', hint: 'Upload a clear photo of your student ID card or UNIBEN admission letter. Your name on the document must match the name you entered above.', accept: 'image/*', icon: '🎓' }
        : { label: 'NIN Slip or NIMC Card', hint: 'Upload a clear photo of your NIN slip or NIMC national ID card. Your 11-digit NIN number must be clearly visible.', accept: 'image/*', icon: '🪪' };
    }
    if (isVendor) {
      return form.vendor_type === 'student'
        ? { label: 'Student ID Card or Admission Letter', hint: 'Upload a clear photo of your student ID card or UNIBEN admission letter. Your name on the document must match the name you entered above.', accept: 'image/*', icon: '🎓' }
        : { label: 'CAC Certificate or Vendor Approval Letter', hint: 'Upload your CAC business registration certificate or a letter from the school/market authority approving you to operate as a vendor on campus.', accept: 'image/*', icon: '📋' };
    }
    return null;
  }

  const docInfo = getDocInfo();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (isVendor && !form.category) return setError('Please select your eatery category');
    if (isVendorOrRider && !verifyFile) return setError(`Please upload your ${docInfo.label}`);

    setLoading(true);
    if (isVendorOrRider) setVerifying(true);

    try {
      const fd = new FormData();
      fd.append('fullName',    form.fullName);
      fd.append('email',       form.email);
      fd.append('password',    form.password);
      fd.append('role',        form.role);
      if (form.school_id)      fd.append('school_id',      form.school_id);
      if (form.phone)          fd.append('phone',          form.phone);
      if (form.bank_name)      fd.append('bank_name',      form.bank_name);
      if (form.account_number) fd.append('account_number', form.account_number);
      if (form.account_name)   fd.append('account_name',   form.account_name);
      if (form.category)       fd.append('category',       form.category);
      if (form.description)    fd.append('description',    form.description);
      if (isVendor)            fd.append('vendor_type',    form.vendor_type);
      if (isDriver)            fd.append('rider_type',     form.rider_type);
      if (logoFile)            fd.append('logo',           logoFile);
      if (verifyFile)          fd.append('verify_doc',     verifyFile);

      const { data } = await api.post('/auth/register', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        login(data.user, data.token);
        const routes = { student: '/student', vendor: '/vendor', driver: '/rider' };
        navigate(routes[data.user.role]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  }

  const inp = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #e4e6ef',
    borderRadius: 12, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const lbl = { fontSize: 12, fontWeight: 600, color: '#1a1a2e', display: 'block', marginBottom: 6 };

  return (
    <div style={{ minHeight: '100vh', background: '#F2F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ background: cfg.color, padding: '24px 28px', textAlign: 'center', transition: 'background .2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.2)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#fff' }}>U+</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>Unimap+</span>
          </div>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', maxHeight: '78vh', overflowY: 'auto' }}>

          {/* Role tabs */}
          <div style={{ display: 'flex', background: '#F2F4F8', borderRadius: 12, padding: 4, marginBottom: 20 }}>
            {['student','vendor','driver'].map(r => (
              <button key={r} type="button"
                onClick={() => setForm(f => ({ ...f, role: r, category: '', description: '', vendor_type: 'student', rider_type: 'student' }))}
                style={{
                  flex: 1, padding: '8px 4px', border: 'none', borderRadius: 10, cursor: 'pointer',
                  background: form.role === r ? '#fff' : 'transparent',
                  fontWeight: form.role === r ? 700 : 500, fontSize: 12,
                  color: form.role === r ? roleConfig[r].color : '#7a7a9a',
                  boxShadow: form.role === r ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all .15s', fontFamily: 'inherit',
                }}>
                {r === 'driver' ? 'Rider' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{isVendor ? 'Eatery / Business Name' : 'Full Name'}</label>
            <input type="text" required placeholder={isVendor ? 'e.g. Mama Put Kitchen' : 'Your full name as on your ID'}
              value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} style={inp}/>
            {isVendorOrRider && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#7a7a9a' }}>
                ⚠️ This must match your name exactly as it appears on your verification document
              </p>
            )}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Email</label>
            <input type="email" required placeholder="your@email.com"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inp}/>
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Phone Number <span style={{ fontSize: 11, color: '#7a7a9a', fontWeight: 400 }}>(required)</span></label>
            <input type="tel" placeholder="e.g. 08012345678" required
              value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inp}/>
          </div>

          {/* School */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>University / School</label>
            <select value={form.school_id} onChange={e => setForm(p => ({ ...p, school_id: e.target.value }))}
              style={{ ...inp, background: '#fff', cursor: 'pointer' }} required>
              <option value="">Select your school</option>
              {schools.map(s => <option key={s.school_id} value={s.school_id}>{s.name}</option>)}
            </select>
          </div>

          {/* ── RIDER: type selector ── */}
          {isDriver && (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Are you a student rider or independent?</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['student','🎓 Student Rider','I am a student at this school'],['independent','🏍️ Independent Rider','I am not a student']].map(([val, label, desc]) => (
                  <div key={val} onClick={() => { setForm(p => ({ ...p, rider_type: val })); setVerifyFile(null); setVerifyPreview(null); }}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: `2px solid ${form.rider_type === val ? '#2D6A4F' : '#e4e6ef'}`, background: form.rider_type === val ? '#f0faf4' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.rider_type === val ? '#2D6A4F' : '#1a1a2e' }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#7a7a9a', marginTop: 2 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VENDOR: type selector ── */}
          {isVendor && (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Are you a student vendor or a registered business?</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['student','🎓 Student Vendor','I am a student selling on campus'],['business','🏪 School Buka / Business','I am a registered business or school canteen']].map(([val, label, desc]) => (
                  <div key={val} onClick={() => { setForm(p => ({ ...p, vendor_type: val })); setVerifyFile(null); setVerifyPreview(null); }}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: `2px solid ${form.vendor_type === val ? '#E87C2A' : '#e4e6ef'}`, background: form.vendor_type === val ? '#fff7f0' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: form.vendor_type === val ? '#E87C2A' : '#1a1a2e' }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#7a7a9a', marginTop: 2, lineHeight: 1.3 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VENDOR ONLY: logo + category + description ── */}
          {isVendor && (
            <>
              {/* Logo upload */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>
                  Eatery Logo / Cover Photo
                  <span style={{ fontSize: 11, color: '#7a90a4', fontWeight: 400, marginLeft: 4 }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 12, border: '1.5px dashed #e4e6ef', background: '#f9fafb', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <span style={{ color: '#e4e6ef' }}>+</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" id="logo-upload" style={{ display:'none' }}
                      onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setLogoFile(file);
                        setLogoPreview(URL.createObjectURL(file));
                      }}/>
                    <label htmlFor="logo-upload"
                      style={{ display:'inline-block', padding:'8px 14px', background:'#f0f8f8', border:`1px solid ${cfg.color}55`, borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:600, color:cfg.color }}>
                      {logoFile ? '✓ Change photo' : 'Choose photo'}
                    </label>
                    {logoFile && <p style={{ margin:'4px 0 0', fontSize:11, color:'#7a90a4' }}>{logoFile.name}</p>}
                  </div>
                </div>
              </div>

              {/* Category */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>
                  Eatery Category <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {VENDOR_CATEGORIES.map(cat => {
                    const selected = form.category === cat.value;
                    return (
                      <button key={cat.value} type="button"
                        onClick={() => setForm(p => ({ ...p, category: cat.value }))}
                        style={{
                          padding: '10px 10px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                          border: `1.5px solid ${selected ? '#E87C2A' : '#e4e6ef'}`,
                          borderRadius: 12, background: selected ? '#fff6ee' : '#fff',
                          transition: 'all .15s', outline: 'none',
                        }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: selected ? '#E87C2A' : '#1a1a2e' }}>{cat.label}</div>
                        <div style={{ fontSize: 10, color: '#7a7a9a', marginTop: 2, lineHeight: 1.3 }}>{cat.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>
                  Short Description
                  <span style={{ fontSize: 11, color: '#7a7a9a', fontWeight: 400, marginLeft: 4 }}>(optional)</span>
                </label>
                <input type="text" placeholder="e.g. Best jollof rice on campus" maxLength={100}
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inp}/>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#7a7a9a' }}>{form.description.length}/100</p>
              </div>
            </>
          )}

          {/* Banking details */}
          {isVendorOrRider && (
            <div style={{ background: '#f8fffe', border: '1px solid #e0f7f7', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#089898' }}>💰 Banking Details (for payments)</p>
              {[
                { label: 'Bank Name',      key: 'bank_name',      placeholder: 'e.g. GTBank, Access, Zenith' },
                { label: 'Account Number', key: 'account_number', placeholder: '10-digit account number' },
                { label: 'Account Name',   key: 'account_name',   placeholder: 'Name on account' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={lbl}>{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp}/>
                </div>
              ))}
            </div>
          )}

          {/* ── VERIFICATION DOCUMENT ── */}
          {isVendorOrRider && docInfo && (
            <div style={{ marginBottom: 16, background: '#f8faff', border: '1.5px solid #c7d7ff', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{docInfo.icon}</span>
                <label style={{ ...lbl, margin: 0, color: '#1a1a2e' }}>
                  {docInfo.label} <span style={{ color: '#e74c3c' }}>*</span>
                </label>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 11, color: '#5a6a8a', lineHeight: 1.5 }}>{docInfo.hint}</p>

              {/* Preview */}
              {verifyPreview && (
                <div style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', border: '1px solid #e4e6ef', maxHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}>
                  <img src={verifyPreview} alt="Document preview" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain' }}/>
                </div>
              )}

              <input type="file" accept="image/*" id="verify-upload" style={{ display:'none' }}
                onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setVerifyFile(file);
                  setVerifyPreview(URL.createObjectURL(file));
                }}/>
              <label htmlFor="verify-upload"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: verifyFile ? '#e6fafa' : '#fff', border: `1.5px dashed ${verifyFile ? TEAL : '#c7d7ff'}`, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: verifyFile ? TEAL : '#3a5abf' }}>
                <span style={{ fontSize: 18 }}>{verifyFile ? '✅' : '📤'}</span>
                {verifyFile ? `${verifyFile.name}` : `Upload ${docInfo.label}`}
              </label>
              {verifyFile && (
                <button type="button" onClick={() => { setVerifyFile(null); setVerifyPreview(null); }}
                  style={{ marginTop: 6, background: 'none', border: 'none', color: '#e74c3c', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  ✕ Remove and re-upload
                </button>
              )}

              {/* What we verify info box */}
              <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e0e8ff', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: '#5a6a8a', lineHeight: 1.6 }}>
                🔒 <strong>How verification works:</strong> Your document is checked by our AI system to confirm it's genuine
                {(isDriver && form.rider_type === 'student') || (isVendor && form.vendor_type === 'student')
                  ? ' and that your name matches.'
                  : isDriver
                  ? ' and that your NIN number is valid (11 digits).'
                  : '.'
                } Documents are not stored after verification.
              </div>
            </div>
          )}

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Password</label>
            <input type="password" required placeholder="Min. 6 characters"
              value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} style={inp}/>
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={lbl}>Confirm Password</label>
            <input type="password" required placeholder="Repeat password"
              value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} style={inp}/>
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 13, background: cfg.color, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit', transition: 'background .2s' }}>
            {verifying ? '🔍 Verifying your document...' : loading ? 'Creating account...' : 'Create Account'}
          </button>

          {loading && verifying && (
            <p style={{ textAlign: 'center', fontSize: 12, color: '#7a7a9a', marginTop: 8 }}>
              This may take up to 15 seconds while we verify your document.
            </p>
          )}

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#7a7a9a' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: cfg.color, fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </form>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');`}</style>
    </div>
  );
}
