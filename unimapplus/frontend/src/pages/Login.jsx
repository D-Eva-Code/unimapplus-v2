import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { GraduationCap, Store, Bike } from "lucide-react";
import api from "../services/api";

const TEAL = "#0BBFBF";
const DARK = "#1a1a2e";

const ROLES = [
  { id: "student", label: "Student",  desc: "Order food from campus vendors",  color: TEAL,      bg: "#e6fafa",  icon: GraduationCap },
  { id: "vendor",  label: "Vendor",   desc: "Manage your food business",       color: "#E87C2A", bg: "#fef3e8",  icon: Store },
  { id: "driver",  label: "Rider",    desc: "Deliver orders on campus",        color: "#5B4FCF", bg: "#eeecfa",  icon: Bike },
];

const inp = {
  width: "100%", padding: "11px 14px", border: "1.5px solid #e4e6ef",
  borderRadius: 12, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};
const lbl = { fontSize: 12, fontWeight: 600, color: DARK, display: "block", marginBottom: 6 };

// 6-box OTP input
function OTPInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = (value || "").split("");

  function handleKey(i, e) {
    if (e.key === "Backspace") {
      const next = [...digits];
      if (next[i]) { next[i] = ""; onChange(next.join("")); }
      else if (i > 0) { next[i - 1] = ""; onChange(next.join("")); inputs.current[i - 1]?.focus(); }
    }
  }
  function handleChange(i, e) {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = val;
    onChange(next.join(""));
    if (val && i < 5) inputs.current[i + 1]?.focus();
  }
  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    inputs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "12px 0" }}>
      {[0,1,2,3,4,5].map(i => (
        <input key={i} ref={el => inputs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i] || ""}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{ width: 44, height: 52, textAlign: "center", fontSize: 22, fontWeight: 800,
            border: `2px solid ${digits[i] ? TEAL : "#e4e6ef"}`, borderRadius: 12, outline: "none",
            fontFamily: "inherit", color: DARK, background: digits[i] ? "#e6fafa" : "#fff", transition: "all .15s" }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Login state
  const [step, setStep] = useState("role"); // role | form | forgot_email | forgot_otp | forgot_reset
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Forgot password state
  const [fpEmail, setFpEmail] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpPassword, setFpPassword] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");
  const [fpSuccess, setFpSuccess] = useState("");
  const [fpCooldown, setFpCooldown] = useState(0);

  const role = ROLES.find(r => r.id === selectedRole);

  function selectRole(r) { setSelectedRole(r); setStep("form"); setError(""); }
  function goBack() { setStep("role"); setError(""); setFpError(""); setFpEmail(""); setFpOtp(""); setFpPassword(""); setFpConfirm(""); setFpSuccess(""); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { ...form, role: selectedRole });
      if (data.success) {
        login(data.user, data.token);
        navigate({ student: "/student", vendor: "/vendor", driver: "/rider" }[data.user.role]);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally { setLoading(false); }
  }

  async function sendResetOTP() {
    setFpError(""); setFpSuccess("");
    if (!fpEmail.trim()) return setFpError("Enter your email address");
    setFpLoading(true);
    try {
      await api.post("/auth/send-reset-otp", { email: fpEmail.trim(), role: selectedRole });
      setFpSuccess(`Reset code sent to ${fpEmail.trim()}`);
      setStep("forgot_otp");
      setFpCooldown(60);
      const t = setInterval(() => setFpCooldown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
    } catch (err) {
      setFpError(err.response?.data?.message || "Failed to send code. Please try again.");
    } finally { setFpLoading(false); }
  }

  async function resendResetOTP() {
    setFpError(""); setFpSuccess(""); setFpLoading(true);
    try {
      await api.post("/auth/send-reset-otp", { email: fpEmail.trim(), role: selectedRole });
      setFpSuccess("New code sent.");
      setFpCooldown(60);
      const t = setInterval(() => setFpCooldown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
    } catch (err) {
      setFpError(err.response?.data?.message || "Failed to resend.");
    } finally { setFpLoading(false); }
  }

  function confirmOTP() {
    if (fpOtp.length < 6) return setFpError("Enter the full 6-digit code");
    setFpError("");
    setStep("forgot_reset");
  }

  async function doResetPassword() {
    setFpError("");
    if (fpPassword.length < 6) return setFpError("Password must be at least 6 characters");
    if (fpPassword !== fpConfirm) return setFpError("Passwords do not match");
    setFpLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: fpEmail.trim(), role: selectedRole, otp: fpOtp, new_password: fpPassword
      });
      setStep("forgot_done");
    } catch (err) {
      setFpError(err.response?.data?.message || "Failed to reset password. Try again.");
      // If OTP was wrong, go back to OTP step
      if (err.response?.data?.message?.toLowerCase().includes("code")) setStep("forgot_otp");
    } finally { setFpLoading(false); }
  }

  const cardStyle = {
    background: "#fff", borderRadius: 24, width: "100%", maxWidth: 400,
    overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  };

  const Logo = () => (
    <div style={{ padding: "32px 28px 24px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, background: "#fff", borderRadius: 18, display: "flex",
        alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
        boxShadow: "0 4px 16px rgba(11,191,191,0.3)" }}>
        <img src="/logo.png" alt="Unimap+" style={{ width: 64, height: 64, borderRadius: 18, objectFit: "contain" }} />
      </div>
      <h1 style={{ margin: 0, fontWeight: 900, fontSize: 24 }}>Unimap<span style={{ color: TEAL }}>+</span></h1>
      <p style={{ margin: "4px 0 0", color: "#7a7a9a", fontSize: 13 }}>Campus Food Delivery</p>
    </div>
  );

  const ErrorBox = ({ msg }) => msg ? (
    <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{msg}</div>
  ) : null;

  const SuccessBox = ({ msg }) => msg ? (
    <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{msg}</div>
  ) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F8", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "20px" }}>
      <div style={cardStyle}>
        <Logo />

        {/* ROLE SELECTION */}
        {step === "role" && (
          <div style={{ padding: "0 24px 32px" }}>
            <p style={{ textAlign: "center", fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 16 }}>
              Select your role to continue
            </p>
            {ROLES.map(r => {
              const Icon = r.icon;
              return (
                <button key={r.id} onClick={() => selectRole(r.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
                    marginBottom: 12, border: `2px solid ${r.color}`, borderRadius: 16, background: "#fff",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = r.bg}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: r.bg, display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={22} style={{ color: r.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: DARK }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: "#7a7a9a", marginTop: 2 }}>{r.desc}</div>
                  </div>
                  <span style={{ color: r.color, fontSize: 20, fontWeight: 700 }}>›</span>
                </button>
              );
            })}
            <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#7a7a9a" }}>
              Don't have an account?{" "}
              <Link to="/signup" style={{ color: TEAL, fontWeight: 700, textDecoration: "none" }}>Sign up</Link>
            </p>
          </div>
        )}

        {/* LOGIN FORM */}
        {step === "form" && role && (
          <>
            <div style={{ background: role.color, padding: "18px 28px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 18 }}>{role.label} Login</p>
              <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{role.desc}</p>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px" }}>
              <ErrorBox msg={error} />
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Email</label>
                <input type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com" style={inp} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Password</label>
                <input type="password" required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter password" style={inp} />
              </div>
              <div style={{ textAlign: "right", marginBottom: 18 }}>
                <button type="button" onClick={() => { setFpEmail(form.email); setFpError(""); setFpSuccess(""); setStep("forgot_email"); }}
                  style={{ background: "none", border: "none", color: role.color, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: 13, background: role.color, color: "#fff", border: "none",
                  borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button type="button" onClick={goBack}
                style={{ width: "100%", marginTop: 10, padding: 11, background: "#F2F4F8", color: "#7a7a9a",
                  border: "none", borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Back to role selection
              </button>
              <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#7a7a9a" }}>
                Don't have an account?{" "}
                <Link to="/signup" style={{ color: role.color, fontWeight: 700, textDecoration: "none" }}>Sign up</Link>
              </p>
            </form>
          </>
        )}

        {/* FORGOT — EMAIL STEP */}
        {step === "forgot_email" && role && (
          <div style={{ padding: "24px 28px 32px" }}>
            <h3 style={{ margin: "0 0 6px", fontWeight: 800, color: DARK, fontSize: 17 }}>Reset your password</h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#7a7a9a" }}>
              Enter the email address linked to your {role.label.toLowerCase()} account.
            </p>
            <ErrorBox msg={fpError} />
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Email Address</label>
              <input type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                placeholder="your@email.com" style={inp} />
            </div>
            <button onClick={sendResetOTP} disabled={fpLoading || !fpEmail.trim()}
              style={{ width: "100%", padding: 13, background: fpEmail.trim() ? role.color : "#ccc",
                color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14,
                cursor: fpEmail.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", marginBottom: 10 }}>
              {fpLoading ? "Sending..." : "Send Reset Code"}
            </button>
            <button onClick={() => setStep("form")}
              style={{ width: "100%", padding: 11, background: "#F2F4F8", color: "#7a7a9a", border: "none",
                borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Back to login
            </button>
          </div>
        )}

        {/* FORGOT — OTP STEP */}
        {step === "forgot_otp" && role && (
          <div style={{ padding: "24px 28px 32px" }}>
            <h3 style={{ margin: "0 0 6px", fontWeight: 800, color: DARK, fontSize: 17 }}>Enter reset code</h3>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "#7a7a9a" }}>
              A 6-digit code was sent to:
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: DARK }}>{fpEmail}</p>
            <ErrorBox msg={fpError} />
            <SuccessBox msg={fpSuccess} />
            <OTPInput value={fpOtp} onChange={setFpOtp} />
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <button onClick={resendResetOTP} disabled={fpCooldown > 0 || fpLoading}
                style={{ background: "none", border: "none", color: fpCooldown > 0 ? "#ccc" : role.color,
                  fontWeight: 600, fontSize: 12, cursor: fpCooldown > 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {fpCooldown > 0 ? `Resend in ${fpCooldown}s` : "Resend code"}
              </button>
            </div>
            <button onClick={confirmOTP} disabled={fpOtp.length < 6}
              style={{ width: "100%", padding: 13, background: fpOtp.length === 6 ? role.color : "#ccc",
                color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14,
                cursor: fpOtp.length === 6 ? "pointer" : "not-allowed", fontFamily: "inherit", marginBottom: 10 }}>
              Confirm Code
            </button>
            <button onClick={() => setStep("forgot_email")}
              style={{ width: "100%", padding: 11, background: "#F2F4F8", color: "#7a7a9a", border: "none",
                borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Back
            </button>
          </div>
        )}

        {/* FORGOT — NEW PASSWORD STEP */}
        {step === "forgot_reset" && role && (
          <div style={{ padding: "24px 28px 32px" }}>
            <h3 style={{ margin: "0 0 6px", fontWeight: 800, color: DARK, fontSize: 17 }}>Set new password</h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#7a7a9a" }}>Choose a strong password for your account.</p>
            <ErrorBox msg={fpError} />
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>New Password</label>
              <input type="password" value={fpPassword} onChange={e => setFpPassword(e.target.value)}
                placeholder="Min. 6 characters" style={inp} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Confirm New Password</label>
              <input type="password" value={fpConfirm} onChange={e => setFpConfirm(e.target.value)}
                placeholder="Repeat password" style={inp} />
            </div>
            <button onClick={doResetPassword} disabled={fpLoading || !fpPassword || !fpConfirm}
              style={{ width: "100%", padding: 13, background: fpPassword && fpConfirm ? role.color : "#ccc",
                color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14,
                cursor: fpPassword && fpConfirm ? "pointer" : "not-allowed", fontFamily: "inherit", marginBottom: 10 }}>
              {fpLoading ? "Resetting..." : "Reset Password"}
            </button>
            <button onClick={() => setStep("forgot_otp")}
              style={{ width: "100%", padding: 11, background: "#F2F4F8", color: "#7a7a9a", border: "none",
                borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Back
            </button>
          </div>
        )}

        {/* FORGOT — SUCCESS */}
        {step === "forgot_done" && role && (
          <div style={{ padding: "24px 28px 32px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #16a34a",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26 }}>
              ✓
            </div>
            <h3 style={{ margin: "0 0 8px", fontWeight: 800, color: DARK }}>Password reset</h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#7a7a9a" }}>
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button onClick={() => { setStep("form"); setFpEmail(""); setFpOtp(""); setFpPassword(""); setFpConfirm(""); }}
              style={{ width: "100%", padding: 13, background: role.color, color: "#fff", border: "none",
                borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
