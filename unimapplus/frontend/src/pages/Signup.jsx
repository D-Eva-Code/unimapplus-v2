import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    role: 'student', school_id: '', phone: '',
    bank_name: '', account_number: '', account_name: '',
    category: '', description: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/schools').then(r => setSchools(r.data.schools || [])).catch(() => {});
  }, []);

  const roleConfig = {
    student: { color: '#0BBFBF' },
    vendor:  { color: '#E87C2A' },
    driver:  { color: '#2D6A4F' },
  };
  const cfg = roleConfig[form.role];
  const isVendor = form.role === 'vendor';
  const isVendorOrRider = form.role === 'vendor' || form.role === 'driver';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (isVendor && !form.category) return setError('Please select your eatery category');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('fullName',       form.fullName);
      fd.append('email',          form.email);
      fd.append('password',       form.password);
      fd.append('role',           form.role);
      if (form.school_id)      fd.append('school_id',      form.school_id);
      if (form.phone)          fd.append('phone',          form.phone);
      if (form.bank_name)      fd.append('bank_name',      form.bank_name);
      if (form.account_number) fd.append('account_number', form.account_number);
      if (form.account_name)   fd.append('account_name',   form.account_name);
      if (form.category)       fd.append('category',       form.category);
      if (form.description)    fd.append('description',    form.description);
      if (logoFile)            fd.append('logo',           logoFile);

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

        {/* MVP Note */}
        <div style={{ background: '#fff8e1', borderBottom: '1px solid #ffe082', padding: '10px 20px' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
            📋 <strong>MVP Note:</strong> Vendor & rider verification coming in final version.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', maxHeight: '72vh', overflowY: 'auto' }}>

          {/* Role tabs */}
          <div style={{ display: 'flex', background: '#F2F4F8', borderRadius: 12, padding: 4, marginBottom: 20 }}>
            {['student','vendor','driver'].map(r => (
              <button key={r} type="button"
                onClick={() => setForm(f => ({ ...f, role: r, category: '', description: '' }))}
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
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{isVendor ? 'Eatery / Business Name' : 'Full Name'}</label>
            <input type="text" required placeholder={isVendor ? 'e.g. Mama Put Kitchen' : 'Your full name'}
              value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} style={inp}/>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Email</label>
            <input type="email" required placeholder="your@email.com"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inp}/>
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Phone Number {cfg.role==='student'&&<span style={{color:'#e74c3c',fontSize:12}}>*</span>}{cfg.role!=='student'&&<span style={{ fontSize: 11, color: '#7a7a9a', fontWeight: 400 }}>(required)</span>}</label>
            <input type="tel" placeholder="e.g. 08012345678" required={cfg.role==='student'}
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

          {/* ── VENDOR ONLY ── */}
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
                    <p style={{ margin:'4px 0 0', fontSize:11, color:'#7a90a4' }}>Shown as your eatery cover on the student dashboard</p>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>
                  Eatery Category <span style={{ color: '#e74c3c' }}>*</span>
                  <span style={{ fontSize: 11, color: '#7a7a9a', fontWeight: 400, marginLeft: 4 }}>— shown on student dashboard</span>
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
                <input type="text" placeholder="e.g. Best jollof rice on campus 🔥" maxLength={100}
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
                { label: 'Bank Name',       key: 'bank_name',      placeholder: 'e.g. GTBank, Access, Zenith' },
                { label: 'Account Number',  key: 'account_number', placeholder: '10-digit account number' },
                { label: 'Account Name',    key: 'account_name',   placeholder: 'Name on account' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={lbl}>{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp}/>
                </div>
              ))}
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#7a7a9a' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: cfg.color, fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
