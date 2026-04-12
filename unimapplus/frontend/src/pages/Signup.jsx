import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TEAL = '#0BBFBF';
const DARK = '#0d2137';

const VENDOR_CATEGORIES = [
  { value: 'african_food',  label: 'African Food',       desc: 'Jollof, soups, stews, local dishes' },
  { value: 'fast_food',     label: 'Fast Food',           desc: 'Burgers, shawarma, fried chicken' },
  { value: 'snacks',        label: 'Snacks & Bites',      desc: 'Sandwiches, pies, small chops' },
  { value: 'drinks',        label: 'Drinks & Beverages',  desc: 'Zobo, juices, smoothies, water' },
  { value: 'bakery',        label: 'Bakery & Pastry',     desc: 'Bread, cakes, puff puff, chin chin' },
  { value: 'rice_dishes',   label: 'Rice Dishes',         desc: 'Fried rice, ofada, coconut rice' },
  { value: 'protein',       label: 'Proteins & Grills',   desc: 'Suya, grilled fish, peppered meat' },
  { value: 'vegetarian',    label: 'Vegetarian',          desc: 'Salads, veggies, plant-based meals' },
  { value: 'foodstuff',     label: 'Foodstuff & Grocery', desc: 'Provisions, ingredients, condiments' },
  { value: 'other',         label: 'Other',               desc: 'Something else entirely' },
];

const roleConfig = {
  student: { color: TEAL },
  vendor:  { color: '#E87C2A' },
  driver:  { color: '#2D6A4F' },
};

// OTP input component — 6 boxes
function OTPInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = (value || '').split('');

  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      const next = [...digits];
      if (next[i]) { next[i] = ''; onChange(next.join('')); }
      else if (i > 0) { next[i-1] = ''; onChange(next.join('')); inputs.current[i-1]?.focus(); }
    }
  }
  function handleChange(i, e) {
    const val = e.target.value.replace(/\D/g,'').slice(-1);
    const next = [...digits];
    next[i] = val;
    onChange(next.join(''));
    if (val && i < 5) inputs.current[i+1]?.focus();
  }
  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    onChange(pasted.padEnd(6,'').slice(0,6));
    inputs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  }

  return (
    <div style={{display:'flex',gap:8,justifyContent:'center',margin:'12px 0'}}>
      {[0,1,2,3,4,5].map(i => (
        <input key={i} ref={el => inputs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{width:44,height:52,textAlign:'center',fontSize:22,fontWeight:800,border:`2px solid ${digits[i]?TEAL:'#e4e6ef'}`,borderRadius:12,outline:'none',fontFamily:'inherit',color:DARK,background:digits[i]?'#e6fafa':'#fff',transition:'all .15s'}}
        />
      ))}
    </div>
  );
}

export default function Signup() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [schools, setSchools] = useState([]);

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    role: 'student', school_id: '', phone: '',
    bank_name: '', account_number: '', account_name: '',
    category: '', description: '',
    vendor_type: 'student',    // 'student' | 'business'
    rider_type:  'student',    // 'student' | 'independent'
  });

  // School email OTP state
  const [schoolEmail,      setSchoolEmail]      = useState('');
  const [otpSent,          setOtpSent]          = useState(false);
  const [otpValue,         setOtpValue]         = useState('');
  const [otpVerified,      setOtpVerified]      = useState(false);
  const [schoolEmailToken, setSchoolEmailToken] = useState('');
  const [otpLoading,       setOtpLoading]       = useState(false);
  const [otpError,         setOtpError]         = useState('');
  const [otpCooldown,      setOtpCooldown]      = useState(0);

  // NIN state (for independent riders)
  const [ninNumber, setNinNumber] = useState('');

  // Document upload state
  const [logoFile,     setLogoFile]     = useState(null);
  const [logoPreview,  setLogoPreview]  = useState(null);
  const [verifyFile,   setVerifyFile]   = useState(null);
  const [verifyPreview,setVerifyPreview]= useState(null);

  const [verifying, setVerifying] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    api.get('/schools').then(r => setSchools(r.data.schools || [])).catch(() => {});
  }, []);

  // OTP countdown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const cfg       = roleConfig[form.role];
  const isVendor  = form.role === 'vendor';
  const isDriver  = form.role === 'driver';
  const isVendorOrRider = isVendor || isDriver;

  // Student path = needs school email OTP + ID card
  const isStudentPath =
    (isDriver && form.rider_type === 'student') ||
    (isVendor && form.vendor_type === 'student');
  // NIN path = independent rider
  const isNINPath = isDriver && form.rider_type === 'independent';
  // CAC path = business vendor
  const isCACPath = isVendor && form.vendor_type === 'business';

  function resetVerification() {
    setSchoolEmail(''); setOtpSent(false); setOtpValue('');
    setOtpVerified(false); setSchoolEmailToken(''); setOtpError('');
    setNinNumber(''); setVerifyFile(null); setVerifyPreview(null);
  }

  async function sendOTP() {
    setOtpError('');
    if (!schoolEmail.trim()) return setOtpError('Enter your school email first');
    setOtpLoading(true);
    try {
      await api.post('/auth/send-otp', { email: schoolEmail.trim() });
      setOtpSent(true);
      setOtpCooldown(60);
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to send OTP. Try again.');
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOTP() {
    setOtpError('');
    if (otpValue.length < 6) return setOtpError('Enter the full 6-digit code');
    setOtpLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email: schoolEmail.trim(), otp: otpValue });
      setOtpVerified(true);
      setSchoolEmailToken(data.verify_token);
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Incorrect code. Try again.');
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (isVendor && !form.category) return setError('Please select your eatery category');
    if (isStudentPath && !otpVerified) return setError('Please verify your school email with OTP first');
    if (isStudentPath && !verifyFile) return setError('Please upload your student ID card or admission letter');
    if (isNINPath && ninNumber.replace(/\s/g,'').length !== 11) return setError('Please enter a valid 11-digit NIN number');
    if (isCACPath && !verifyFile) return setError('Please upload your CAC certificate or vendor approval document');

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
      if (schoolEmailToken)    fd.append('school_email_token', schoolEmailToken);
      if (ninNumber)           fd.append('nin_number',     ninNumber.replace(/\s/g,''));
      if (logoFile)            fd.append('logo',           logoFile);
      if (verifyFile)          fd.append('verify_doc',     verifyFile);

      const { data } = await api.post('/auth/register', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        login(data.user, data.token);
        navigate({ student:'/student', vendor:'/vendor', driver:'/rider' }[data.user.role]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  }

  const inp = { width:'100%', padding:'11px 14px', border:'1.5px solid #e4e6ef', borderRadius:12, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:DARK, display:'block', marginBottom:6 };
  const accentColor = cfg.color;

  // ─── SCHOOL EMAIL OTP BLOCK ───────────────────────────────
  const SchoolEmailBlock = () => (
    <div style={{marginBottom:16, background:'#f8faff', border:'1.5px solid #c7d7ff', borderRadius:14, padding:16}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
        <span style={{fontSize:20}}></span>
        <label style={{...lbl, margin:0}}>School Email Verification <span style={{color:'#e74c3c'}}>*</span></label>
      </div>
      <p style={{margin:'0 0 10px',fontSize:11,color:'#5a6a8a',lineHeight:1.5}}>
        Enter your official school email (e.g. <strong>yourname@uniben.edu</strong>). We'll send a one-time code to confirm you're a registered student.
      </p>

      {!otpVerified ? (
        <>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input type="email" placeholder="yourname@uniben.edu"
              value={schoolEmail} onChange={e => { setSchoolEmail(e.target.value); setOtpSent(false); setOtpValue(''); setOtpError(''); }}
              style={{...inp, flex:1, borderColor: otpSent ? TEAL : '#e4e6ef'}}
              disabled={otpSent && !otpError}
            />
            <button type="button" onClick={sendOTP} disabled={otpLoading || otpCooldown > 0}
              style={{padding:'0 14px', background: otpCooldown > 0 ? '#e4e6ef' : accentColor, color:'#fff', border:'none', borderRadius:12, fontWeight:700, fontSize:12, cursor: otpCooldown > 0 ? 'not-allowed' : 'pointer', whiteSpace:'nowrap', fontFamily:'inherit', minWidth:80}}>
              {otpLoading ? '...' : otpCooldown > 0 ? `${otpCooldown}s` : otpSent ? 'Resend' : 'Send Code'}
            </button>
          </div>

          {otpSent && (
            <div style={{marginTop:8}}>
              <p style={{margin:'0 0 4px',fontSize:12,color:'#5a6a8a',textAlign:'center'}}>Enter the 6-digit code sent to <strong>{schoolEmail}</strong></p>
              <OTPInput value={otpValue} onChange={setOtpValue} />
              <button type="button" onClick={verifyOTP} disabled={otpLoading || otpValue.length < 6}
                style={{width:'100%',padding:'10px',background: otpValue.length===6 ? accentColor : '#ccc', color:'#fff', border:'none', borderRadius:12, fontWeight:700, fontSize:13, cursor: otpValue.length===6 ? 'pointer' : 'not-allowed', fontFamily:'inherit', marginTop:4}}>
                {otpLoading ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          )}

          {otpError && (
            <p style={{margin:'8px 0 0',fontSize:12,color:'#dc2626',background:'#fef2f2',padding:'6px 10px',borderRadius:8}}>{otpError}</p>
          )}
        </>
      ) : (
        <div style={{display:'flex',alignItems:'center',gap:10,background:'#dcfce7',borderRadius:10,padding:'10px 14px'}}>
          <span style={{fontSize:20}}>✅</span>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:'#16a34a'}}>School email verified!</div>
            <div style={{fontSize:11,color:'#15803d'}}>{schoolEmail}</div>
          </div>
          <button type="button" onClick={()=>{setOtpVerified(false);setOtpSent(false);setOtpValue('');setSchoolEmailToken('');setSchoolEmail('');}}
            style={{marginLeft:'auto',background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>
            Change
          </button>
        </div>
      )}
    </div>
  );

  // ─── NIN INPUT BLOCK ──────────────────────────────────────
  const NINBlock = () => (
    <div style={{marginBottom:16, background:'#f8faff', border:'1.5px solid #c7d7ff', borderRadius:14, padding:16}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
        <span style={{fontSize:20}}>🪪</span>
        <label style={{...lbl, margin:0}}>NIN Number <span style={{color:'#e74c3c'}}>*</span></label>
      </div>
      <p style={{margin:'0 0 10px',fontSize:11,color:'#5a6a8a',lineHeight:1.5}}>
        Enter your 11-digit National Identification Number (NIN). This is verified in real-time through the NIMC registry.
      </p>
      <input type="text" inputMode="numeric" placeholder="e.g. 12345678901" maxLength={11}
        value={ninNumber} onChange={e => setNinNumber(e.target.value.replace(/\D/g,'').slice(0,11))}
        style={{...inp, letterSpacing:3, fontSize:16, fontWeight:700, textAlign:'center',
          borderColor: ninNumber.length === 11 ? TEAL : '#e4e6ef',
          background: ninNumber.length === 11 ? '#e6fafa' : '#fff'}}
      />
      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        <span style={{fontSize:11,color:'#7a7a9a'}}>Verified via Prembly IdentityPass</span>
        <span style={{fontSize:11,color: ninNumber.length===11 ? TEAL : '#7a7a9a', fontWeight:700}}>{ninNumber.length}/11</span>
      </div>
      <div style={{marginTop:10,background:'#fff',border:'1px solid #e0e8ff',borderRadius:10,padding:'8px 12px',fontSize:11,color:'#5a6a8a',lineHeight:1.6}}>
        🔒 Your NIN is used only for identity verification and is not stored after the check.
      </div>
    </div>
  );

  // ─── DOCUMENT UPLOAD BLOCK ────────────────────────────────
  const docConfigs = {
    student_id: { label:'Student ID Card or Admission Letter', hint:'Upload a clear photo. Your name must match exactly as entered above.' },
    cac:        { label:'CAC Certificate or Vendor Approval Letter', hint:'Upload your CAC business registration or a school authority approval letter.' },
  };
  const activeDocType = isStudentPath ? 'student_id' : isCACPath ? 'cac' : null;
  const docCfg = activeDocType ? docConfigs[activeDocType] : null;

  const DocumentUploadBlock = () => !docCfg ? null : (
    <div style={{marginBottom:16, background:'#f8faff', border:'1.5px solid #c7d7ff', borderRadius:14, padding:16}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
        <span style={{fontSize:20}}>{docCfg.icon}</span>
        <label style={{...lbl, margin:0}}>{docCfg.label} <span style={{color:'#e74c3c'}}>*</span></label>
      </div>
      <p style={{margin:'0 0 10px',fontSize:11,color:'#5a6a8a',lineHeight:1.5}}>{docCfg.hint}</p>

      {verifyPreview && (
        <div style={{marginBottom:10,borderRadius:10,overflow:'hidden',border:'1px solid #e4e6ef',maxHeight:150,display:'flex',alignItems:'center',justifyContent:'center',background:'#f0f4f8'}}>
          <img src={verifyPreview} alt="Document preview" style={{maxWidth:'100%',maxHeight:150,objectFit:'contain'}}/>
        </div>
      )}
      <input type="file" accept="image/*" id="verify-upload" style={{display:'none'}}
        onChange={e => {
          const file = e.target.files[0]; if (!file) return;
          setVerifyFile(file); setVerifyPreview(URL.createObjectURL(file));
        }}/>
      <label htmlFor="verify-upload"
        style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:verifyFile?'#e6fafa':'#fff',border:`1.5px dashed ${verifyFile?TEAL:'#c7d7ff'}`,borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:600,color:verifyFile?TEAL:'#3a5abf'}}>
        <span style={{fontSize:18}}>{verifyFile ? '✅' : '📤'}</span>
        {verifyFile ? verifyFile.name : `Upload ${docCfg.label}`}
      </label>
      {verifyFile && (
        <button type="button" onClick={()=>{setVerifyFile(null);setVerifyPreview(null);}}
          style={{marginTop:6,background:'none',border:'none',color:'#e74c3c',fontSize:11,cursor:'pointer',fontFamily:'inherit',padding:0}}>
          ✕ Remove
        </button>
      )}
      <div style={{marginTop:10,background:'#fff',border:'1px solid #e0e8ff',borderRadius:10,padding:'8px 12px',fontSize:11,color:'#5a6a8a',lineHeight:1.6}}>
        Documents are verified first and not stored after registration.
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#F2F4F8',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Plus Jakarta Sans', sans-serif",padding:'20px'}}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:460,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.12)'}}>

        {/* Header */}
        <div style={{background:accentColor,padding:'24px 28px',textAlign:'center',transition:'background .2s'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            <div style={{width:34,height:34,background:'rgba(255,255,255,0.2)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:15,color:'#fff'}}>U+</div>
            <span style={{fontWeight:800,fontSize:18,color:'#fff'}}>Unimap+</span>
          </div>
          <p style={{margin:'8px 0 0',color:'rgba(255,255,255,0.85)',fontSize:13}}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{padding:'24px 28px',maxHeight:'78vh',overflowY:'auto'}}>

          {/* Role tabs */}
          <div style={{display:'flex',background:'#F2F4F8',borderRadius:12,padding:4,marginBottom:20}}>
            {['student','vendor','driver'].map(r => (
              <button key={r} type="button"
                onClick={() => { setForm(f => ({...f, role:r, category:'', description:'', vendor_type:'student', rider_type:'student'})); resetVerification(); }}
                style={{flex:1,padding:'8px 4px',border:'none',borderRadius:10,cursor:'pointer',background:form.role===r?'#fff':'transparent',fontWeight:form.role===r?700:500,fontSize:12,color:form.role===r?roleConfig[r].color:'#7a7a9a',boxShadow:form.role===r?'0 1px 4px rgba(0,0,0,0.1)':'none',transition:'all .15s',fontFamily:'inherit'}}>
                {r === 'driver' ? 'Rider' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{background:'#fef2f2',color:'#dc2626',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:14,lineHeight:1.5}}>
              ⚠️ {error}
            </div>
          )}

          {/* Full Name */}
          <div style={{marginBottom:14}}>
            <label style={lbl}>{isVendor ? 'Eatery / Business Name' : 'Full Name'}</label>
            <input type="text" required placeholder={isVendor ? 'e.g. Mama Put Kitchen' : 'Your full name as on your ID'}
              value={form.fullName} onChange={e => setForm(p => ({...p, fullName:e.target.value}))} style={inp}/>
            {isVendorOrRider && (
              <p style={{margin:'4px 0 0',fontSize:11,color:'#7a7a9a'}}>⚠️ Must match your name exactly as it appears on your verification document</p>
            )}
          </div>

          {/* Email */}
          <div style={{marginBottom:14}}>
            <label style={lbl}>Email Address</label>
            <input type="email" required placeholder="your@email.com"
              value={form.email} onChange={e => setForm(p => ({...p, email:e.target.value}))} style={inp}/>
          </div>

          {/* Phone */}
          <div style={{marginBottom:14}}>
            <label style={lbl}>Phone Number</label>
            <input type="tel" required placeholder="e.g. 08012345678"
              value={form.phone} onChange={e => setForm(p => ({...p, phone:e.target.value}))} style={inp}/>
          </div>

          {/* School */}
          <div style={{marginBottom:14}}>
            <label style={lbl}>University / School</label>
            <select value={form.school_id} onChange={e => setForm(p => ({...p, school_id:e.target.value}))}
              style={{...inp, background:'#fff', cursor:'pointer'}} required>
              <option value="">Select your school</option>
              {schools.map(s => <option key={s.school_id} value={s.school_id}>{s.name}</option>)}
            </select>
          </div>

          {/* ── RIDER TYPE ── */}
          {isDriver && (
            <div style={{marginBottom:16}}>
              <label style={lbl}>Rider Type</label>
              <div style={{display:'flex',gap:10}}>
                {[['student','Student Rider','I am a student at this school'],['independent','Independent Rider','I am not a student']].map(([val,label,desc]) => (
                  <div key={val} onClick={() => { setForm(p => ({...p, rider_type:val})); resetVerification(); }}
                    style={{flex:1,padding:'10px 12px',borderRadius:12,border:`2px solid ${form.rider_type===val?'#2D6A4F':'#e4e6ef'}`,background:form.rider_type===val?'#f0faf4':'#fff',cursor:'pointer',textAlign:'center'}}>
                    <div style={{fontSize:13,fontWeight:700,color:form.rider_type===val?'#2D6A4F':DARK}}>{label}</div>
                    <div style={{fontSize:10,color:'#7a7a9a',marginTop:2}}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VENDOR TYPE ── */}
          {isVendor && (
            <div style={{marginBottom:16}}>
              <label style={lbl}>Vendor Type</label>
              <div style={{display:'flex',gap:10}}>
                {[['student','Student Vendor','I am a student selling on campus'],['business','School Buka / Business','Registered business or school canteen']].map(([val,label,desc]) => (
                  <div key={val} onClick={() => { setForm(p => ({...p, vendor_type:val})); resetVerification(); }}
                    style={{flex:1,padding:'10px 12px',borderRadius:12,border:`2px solid ${form.vendor_type===val?'#E87C2A':'#e4e6ef'}`,background:form.vendor_type===val?'#fff7f0':'#fff',cursor:'pointer',textAlign:'center'}}>
                    <div style={{fontSize:12,fontWeight:700,color:form.vendor_type===val?'#E87C2A':DARK}}>{label}</div>
                    <div style={{fontSize:10,color:'#7a7a9a',marginTop:2,lineHeight:1.3}}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VENDOR EXTRAS: logo + category + description ── */}
          {isVendor && (<>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Eatery Logo / Cover Photo <span style={{fontSize:11,color:'#7a90a4',fontWeight:400}}>(optional)</span></label>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:64,height:64,borderRadius:12,border:'1.5px dashed #e4e6ef',background:'#f9fafb',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>
                  {logoPreview ? <img src={logoPreview} alt="logo" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{color:'#e4e6ef'}}>+</span>}
                </div>
                <div style={{flex:1}}>
                  <input type="file" accept="image/*" id="logo-upload" style={{display:'none'}}
                    onChange={e => { const f=e.target.files[0]; if(!f)return; setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }}/>
                  <label htmlFor="logo-upload"
                    style={{display:'inline-block',padding:'8px 14px',background:'#f0f8f8',border:`1px solid ${accentColor}55`,borderRadius:10,cursor:'pointer',fontSize:12,fontWeight:600,color:accentColor}}>
                    {logoFile ? '✓ Change photo' : 'Choose photo'}
                  </label>
                  {logoFile && <p style={{margin:'4px 0 0',fontSize:11,color:'#7a90a4'}}>{logoFile.name}</p>}
                </div>
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={lbl}>Eatery Category <span style={{color:'#e74c3c'}}>*</span></label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {VENDOR_CATEGORIES.map(cat => {
                  const sel = form.category === cat.value;
                  return (
                    <button key={cat.value} type="button" onClick={() => setForm(p => ({...p, category:cat.value}))}
                      style={{padding:'10px',textAlign:'left',fontFamily:'inherit',cursor:'pointer',border:`1.5px solid ${sel?'#E87C2A':'#e4e6ef'}`,borderRadius:12,background:sel?'#fff6ee':'#fff',transition:'all .15s',outline:'none'}}>
                      <div style={{fontSize:13,fontWeight:700,color:sel?'#E87C2A':DARK}}>{cat.label}</div>
                      <div style={{fontSize:10,color:'#7a7a9a',marginTop:2,lineHeight:1.3}}>{cat.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={lbl}>Short Description <span style={{fontSize:11,color:'#7a7a9a',fontWeight:400}}>(optional)</span></label>
              <input type="text" placeholder="e.g. Best jollof rice on campus" maxLength={100}
                value={form.description} onChange={e => setForm(p => ({...p, description:e.target.value}))} style={inp}/>
              <p style={{margin:'4px 0 0',fontSize:11,color:'#7a7a9a'}}>{form.description.length}/100</p>
            </div>
          </>)}

          {/* Banking details */}
          {isVendorOrRider && (
            <div style={{background:'#f8fffe',border:'1px solid #e0f7f7',borderRadius:12,padding:14,marginBottom:14}}>
              <p style={{margin:'0 0 10px',fontSize:12,fontWeight:700,color:'#089898'}}>Banking Details (for payments)</p>
              {[{label:'Bank Name',key:'bank_name',placeholder:'e.g. GTBank, Access, Zenith'},{label:'Account Number',key:'account_number',placeholder:'10-digit account number'},{label:'Account Name',key:'account_name',placeholder:'Name on account'}].map(f => (
                <div key={f.key} style={{marginBottom:10}}>
                  <label style={lbl}>{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={form[f.key]}
                    onChange={e => setForm(p => ({...p, [f.key]:e.target.value}))} style={inp}/>
                </div>
              ))}
            </div>
          )}

          {/* ── VERIFICATION SECTION ── */}
          {isVendorOrRider && (
            <div style={{marginBottom:4}}>
              <div style={{fontSize:12,fontWeight:800,color:DARK,textTransform:'uppercase',letterSpacing:0.5,marginBottom:12,paddingBottom:8,borderBottom:'1px solid #f0f0f0'}}>
                🔐 Identity Verification
              </div>
              {isStudentPath && <SchoolEmailBlock />}
              {isNINPath     && <NINBlock />}
              {(isStudentPath || isCACPath) && <DocumentUploadBlock />}
            </div>
          )}

          {/* Password */}
          <div style={{marginBottom:14,marginTop:isVendorOrRider?16:0}}>
            <label style={lbl}>Password</label>
            <input type="password" required placeholder="Min. 6 characters"
              value={form.password} onChange={e => setForm(p => ({...p, password:e.target.value}))} style={inp}/>
          </div>
          <div style={{marginBottom:22}}>
            <label style={lbl}>Confirm Password</label>
            <input type="password" required placeholder="Repeat password"
              value={form.confirmPassword} onChange={e => setForm(p => ({...p, confirmPassword:e.target.value}))} style={inp}/>
          </div>

          <button type="submit" disabled={loading}
            style={{width:'100%',padding:13,background:accentColor,color:'#fff',border:'none',borderRadius:12,fontWeight:700,fontSize:15,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1,fontFamily:'inherit',transition:'background .2s'}}>
            {verifying ? 'Verifying identity...' : loading ? 'Creating account...' : 'Create Account'}
          </button>

          {loading && verifying && (
            <p style={{textAlign:'center',fontSize:12,color:'#7a7a9a',marginTop:8}}>
              This may take up to 20 seconds while we verify your identity.
            </p>
          )}

          <p style={{textAlign:'center',marginTop:16,fontSize:13,color:'#7a7a9a'}}>
            Already have an account?{' '}
            <Link to="/login" style={{color:accentColor,fontWeight:700,textDecoration:'none'}}>Sign in</Link>
          </p>
        </form>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');`}</style>
    </div>
  );
}
