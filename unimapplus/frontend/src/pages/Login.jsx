import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import logo from "./";

const ROLES = [
  {
    id: "student",
    label: "Student",
    desc: "Order food from campus vendors",
    color: "#0BBFBF",
    bg: "#e6fafa",
    emoji: "🎓",
  },
  {
    id: "vendor",
    label: "Vendor",
    desc: "Manage your food business",
    color: "#E87C2A",
    bg: "#fef3e8",
    emoji: "🍽️",
  },
  {
    id: "driver",
    label: "Rider",
    desc: "Deliver orders on campus",
    color: "#5B4FCF",
    bg: "#eeecfa",
    emoji: "🏍️",
  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("role");
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const role = ROLES.find((r) => r.id === selectedRole);

  function selectRole(r) {
    setSelectedRole(r);
    setStep("form");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        ...form,
        role: selectedRole,
      });
      if (data.success) {
        login(data.user, data.token);
        const routes = {
          student: "/student",
          vendor: "/vendor",
          driver: "/rider",
        };
        navigate(routes[data.user.role]);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F2F4F8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 24,
          width: "100%",
          maxWidth: 400,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* LOGO */}
        <div style={{ padding: "32px 28px 24px", textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: "#fff",
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 4px 16px rgba(11,191,191,0.3)",
            }}
          >
            <img
              src="/logo.png"
              alt="Unimap+ Logo"
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                display: "block",
                objectFit: "contain",
              }}
            />
          </div>
          <h1 style={{ margin: 0, fontWeight: 900, fontSize: 24 }}>
            Unimap<span style={{ color: "#0BBFBF" }}>+</span>
          </h1>
          <p style={{ margin: "4px 0 0", color: "#7a7a9a", fontSize: 13 }}>
            Campus Food Delivery
          </p>
        </div>

        {/* ROLE SELECTION */}
        {step === "role" && (
          <div style={{ padding: "0 24px 32px" }}>
            <p
              style={{
                textAlign: "center",
                fontWeight: 700,
                fontSize: 14,
                color: "#1a1a2e",
                marginBottom: 16,
              }}
            >
              Select your role to continue
            </p>
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => selectRole(r.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  marginBottom: 12,
                  border: `2px solid ${r.color}`,
                  borderRadius: 16,
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = r.bg)}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#fff")
                }
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: r.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {r.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontWeight: 800, fontSize: 15, color: "#1a1a2e" }}
                  >
                    {r.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#7a7a9a", marginTop: 2 }}>
                    {r.desc}
                  </div>
                </div>
                <span style={{ color: r.color, fontSize: 20, fontWeight: 700 }}>
                  ›
                </span>
              </button>
            ))}
            <p
              style={{
                textAlign: "center",
                marginTop: 20,
                fontSize: 13,
                color: "#7a7a9a",
              }}
            >
              Don't have an account?{" "}
              <Link
                to="/signup"
                style={{
                  color: "#0BBFBF",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Sign up
              </Link>
            </p>
          </div>
        )}

        {/* LOGIN FORM */}
        {step === "form" && role && (
          <>
            <div
              style={{
                background: role.color,
                padding: "18px 28px 20px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {role.label} Login
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 12,
                }}
              >
                {role.desc}
              </p>
            </div>
            {/* <div style={{ background: '#fff8e1', borderBottom: '1px solid #ffe082', padding: '10px 20px' }}>
              {/* <p style={{ margin: 0, fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
                {/* 📋<strong>MVP Note:</strong> For today's demo, sign in goes straight to your dashboard. In the full product, vendors & riders will verify documents during signup. */}
            {/* </p>} */}
            {/* </div>} */}
            <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px" }}>
              {error && (
                <div
                  style={{
                    background: "#fef2f2",
                    color: "#dc2626",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#1a1a2e",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="your@email.com"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1.5px solid #e4e6ef",
                    borderRadius: 12,
                    fontSize: 14,
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: 22 }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#1a1a2e",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Enter password"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1.5px solid #e4e6ef",
                    borderRadius: 12,
                    fontSize: 14,
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: 13,
                  background: role.color,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  fontFamily: "inherit",
                }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => setStep("role")}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: 11,
                  background: "#F2F4F8",
                  color: "#7a7a9a",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ← Back to role selection
              </button>
              <p
                style={{
                  textAlign: "center",
                  marginTop: 16,
                  fontSize: 13,
                  color: "#7a7a9a",
                }}
              >
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  style={{
                    color: role.color,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Sign up
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
