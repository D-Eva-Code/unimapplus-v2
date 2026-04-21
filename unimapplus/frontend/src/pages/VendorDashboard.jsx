import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import {
  Store,
  Home,
  MapPin,
  Coffee,
  Lock,
  Package,
  DoorClosed,
  Utensils,
  ClipboardList, Wallet, History
} from "lucide-react";
import { getSocket } from "../hooks/useSocket";

const TEAL = "#0BBFBF";
const BG = "#f0f4f4";
const DARK = "#0d2137";

export default function VendorDashboard() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [newItem, setNewItem] = useState({
    item_name: "",
    description: "",
    price: "",
    prep_time: "",
    prep_time_unit: "mins",
    image: null,
    tags: "",
    item_type: "food",
    variants: [],
    toppings: [],
  });
  const [saving, setSaving] = useState(false);
  const [newVariant, setNewVariant] = useState({ label: "", price: "" });
  const [newTopping, setNewTopping] = useState({ label: "", price: "" });
  const [orders, setOrders] = useState([]);
  const [activeSection, setActiveSection] = useState("orders"); // orders | menu | history
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    loadDashboard();
    const socket = getSocket();
    // join after dashboard loads so we have the vendor id
    socket.on("new_order", (order) => {
      setOrders((prev) => [order, ...prev]);
      if (Notification.permission === "granted") {
        new Notification("🍽️ New Order!", {
          body: `Order from ${order.student_name}`,
        });
      }
    });
    // Bakery design-review orders come on this event — reload to get full order details
    socket.on("new_review_order", () => {
      loadDashboard();
    });
    socket.on("order_status_updated", (data) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === data.order_id ? { ...o, status: data.status } : o,
        ),
      );
    });
    return () => {
      socket.off("new_order");
      socket.off("new_review_order");
      socket.off("order_status_updated");
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  async function loadDashboard() {
    try {
      const { data } = await api.get("/vendor/dashboard");
      setDashboard(data);
      setOrders(data.activeOrders || []);
      // Join socket room with real vendor id
      const socket = getSocket();
      socket.emit("join_vendor", data.vendor?.vendor_id);
      const menuData = await api.get(`/vendors/${data.vendor?.vendor_id}/menu`);
      setMenuItems(menuData.data.items || []);
    } catch {}
    setLoading(false);
  }

  async function toggleOpen() {
    try {
      const { data } = await api.post("/vendor/toggle-open");
      setDashboard((d) =>
        d ? { ...d, vendor: { ...d.vendor, is_open: data.is_open } } : d,
      );
    } catch {}
  }

  async function updateOrderStatus(orderId, status) {
    try {
      await api.put(`/vendor/orders/${orderId}/status`, { status });
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status } : o)),
      );
    } catch (e) {
      alert(e.response?.data?.message || "Failed");
    }
  }

  async function saveMenuItem(e) {
    e.preventDefault();
    if (vendor?.category === "foodstuff" && newItem.variants.length === 0) {
      alert("Please add at least one quantity type and price before saving.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("item_name", newItem.item_name);
      fd.append("description", newItem.description);
      if (vendor?.category === "foodstuff") {
        // If they have variants, use the first variant price as the base price. Otherwise, default to 0.
        const basePrice =
          newItem.variants.length > 0 ? newItem.variants[0].price : 0;
        fd.append("price", basePrice);
      } else {
        fd.append("price", newItem.price);
      }
      if (newItem.image) fd.append("image", newItem.image);
      fd.append(
        "tags",
        JSON.stringify(
          newItem.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      );
      fd.append("item_type", newItem.item_type || "food");
      fd.append("variants", JSON.stringify(newItem.variants || []));
      if (newItem.toppings.length > 0)
        fd.append("toppings", JSON.stringify(newItem.toppings));
      if (newItem.prep_time) {
        // Convert days to minutes for storage
        const ptMins =
          newItem.prep_time_unit === "days"
            ? Number(newItem.prep_time) * 60 * 24
            : Number(newItem.prep_time);
        fd.append("prep_time", ptMins);
        fd.append("prep_time_unit", newItem.prep_time_unit || "mins");
      }
      fd.append("allow_design_notes", newItem.allow_design_notes ? 1 : 0);
      if (editItem) {
        await api.put(`/vendor/menu/${editItem.menu_id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/vendor/menu", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setNewItem({
        item_name: "",
        description: "",
        price: "",
        prep_time: "",
        prep_time_unit: "mins",
        image: null,
        tags: "",
        item_type: "food",
        variants: [],
        toppings: [],
        allow_design_notes: false,
      });
      setEditItem(null);
      setAddMenuOpen(false);
      // Reload menu
      const vid = dashboard?.vendor?.vendor_id;
      if (vid) {
        const menuData = await api.get(`/vendors/${vid}/menu`);
        setMenuItems(menuData.data.items || []);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to save");
    }
    setSaving(false);
  }

  async function deleteItem(menu_id) {
    if (!confirm("Delete this item?")) return;
    try {
      await api.delete(`/vendor/menu/${menu_id}`);
      setMenuItems((prev) => prev.filter((i) => i.menu_id !== menu_id));
    } catch {}
  }

  async function approveCustomOrder(orderId, price) {
    try {
      // POST /vendor/update-price expects { order_id, total }
      await api.post("/vendor/update-price", {
        order_id: orderId,
        total: parseFloat(price),
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === orderId
            ? {
                ...o,
                status: "awaiting_payment",
                total_amount: price,
                vendor_amount: price,
              }
            : o,
        ),
      );
    } catch (e) {
      alert(e.response?.data?.message || "Failed to approve");
    }
  }

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          color: "#7a90a4",
          flexDirection: "column",
          gap: 12,
          background: BG,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid #e0eeee",
            borderTopColor: TEAL,
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        Loading dashboard...
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </div>
    );

  const vendor = dashboard?.vendor;
  const stats = dashboard?.stats;
  const activeOrders = orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.status),
  );

  const inp = {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px solid #dde8e8",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    background: "#fff",
  };
  const lbl = {
    fontSize: 12,
    fontWeight: 600,
    color: DARK,
    display: "block",
    marginBottom: 6,
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        background: BG,
      }}
    >
      {/* SIDEBAR */}
      <div
        style={{
          width: isMobile ? 0 : 220, // Collapse width on mobile
          overflow: "hidden",
          display: isMobile ? "none" : "flex", // Or use a hamburger menu to toggle this
          background: "#fff",
          borderRight: "1px solid #e0eeee",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          flexDirection: "column",
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid #e0eeee",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/logo.png"
                alt="Unimap+ Logo"
                style={{
                  width: 32,
                  height: 32,
                  display: "block",
                  objectFit: "contain",
                }}
              />
            </div>
            <span style={{ fontWeight: 900, fontSize: 17, color: DARK }}>
              Unimap<span style={{ color: TEAL }}>+</span>
            </span>
          </div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#8aa8a8",
              letterSpacing: 1,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Vendor
          </p>
        </div>

        {/* Nav */}
        <div style={{ padding: "12px 12px", flex: 1 }}>
          {[
            ["orders", <ClipboardList size={18} />, "Orders"],
            ["menu", <Utensils size={18} />, "Menu"],
            ["history", <History size={18} />, "History"],
          ].map(([id, icon, label]) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: active ? "#e6fafa" : "transparent",
                  color: active ? TEAL : DARK,
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  marginBottom: 2,
                  transition: "all .15s",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </div>

        {/* Open/Close toggle */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #e0eeee" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: DARK,
                }}
              >
                Store Status
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: vendor?.is_open ? "#16a34a" : "#7a90a4",
                  fontWeight: 600,
                }}
              >
                {vendor?.is_open ? "● Open" : "○ Closed"}
              </p>
            </div>
            <div
              onClick={toggleOpen}
              style={{
                width: 44,
                height: 24,
                background: vendor?.is_open ? TEAL : "#dde8e8",
                borderRadius: 20,
                position: "relative",
                cursor: "pointer",
                transition: "background .25s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  background: "#fff",
                  borderRadius: "50%",
                  position: "absolute",
                  top: 3,
                  left: vendor?.is_open ? 23 : 3,
                  transition: "left .25s",
                  boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                }}
              />
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: "9px",
              border: "none",
              borderRadius: 10,
              background: "#f8f0f0",
              color: "#c0392b",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <DoorClosed size={16} /> Logout
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div
        style={{
          marginLeft: isMobile ? 0 : 220, // No margin if sidebar is hidden
          flex: 1,
          padding: isMobile ? "16px 16px 90px" : "28px 28px 40px",
        }}
      >
        {/* MOBILE BOTTOM TABS */}
        {isMobile && (
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "#fff",
              borderTop: "1px solid #e8ecf0",
              zIndex: 1000,
              paddingBottom: "env(safe-area-inset-bottom,4px)",
            }}
          >
            <div style={{ display: "flex", maxWidth: 480, margin: "0 auto" }}>
              {[
                ["orders", <ClipboardList size={16} />, "Orders"],
                ["menu", <Utensils size={16} />, "Menu"],
                ["history", <History size={16} />, "History"],
              ].map(([id, icon, label]) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      padding: "10px 0 8px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color: active ? TEAL : "#7a90a4",
                      transition: "all .15s",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 28,
                        borderRadius: 10,
                        background: active ? "#e6fafa" : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        transition: "all .15s",
                      }}
                    >
                      {icon}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: active ? 700 : 500,
                        letterSpacing: 0.2,
                      }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MOBILE TOP BAR */}
        {isMobile && (
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 200,
              background: "#fff",
              borderBottom: "1px solid #e8ecf0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              marginBottom: 20,
              marginLeft: -16,
              marginRight: -16,
              boxShadow: "0 1px 4px rgba(0,0,0,.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: TEAL,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                U
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 14,
                    color: DARK,
                    lineHeight: 1,
                  }}
                >
                  {vendor?.vendor_name}
                </div>
                <div style={{ fontSize: 10, color: "#7a90a4" }}>
                  Vendor Dashboard
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: vendor?.is_open ? "#e6fafa" : "#f5f5f5",
                  borderRadius: 20,
                  padding: "5px 10px",
                  cursor: "pointer",
                }}
                onClick={toggleOpen}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: vendor?.is_open ? "#16a34a" : "#9ca3af",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: vendor?.is_open ? "#16a34a" : "#7a90a4",
                  }}
                >
                  {vendor?.is_open ? "Open" : "Closed"}
                </span>
                <div
                  style={{
                    width: 28,
                    height: 16,
                    background: vendor?.is_open ? TEAL : "#dde8e8",
                    borderRadius: 10,
                    position: "relative",
                    transition: "background .25s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: "#fff",
                      borderRadius: "50%",
                      position: "absolute",
                      top: 2,
                      left: vendor?.is_open ? 14 : 2,
                      transition: "left .25s",
                      boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                    }}
                  />
                </div>
              </div>
              <button
                onClick={logout}
                style={{
                  background: "#fff0f0",
                  border: "none",
                  borderRadius: 20,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "#e74c3c",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Out
              </button>
            </div>
          </div>
        )}

        {/* DESKTOP HEADER */}
        {!isMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 900,
                  color: DARK,
                }}
              >
                {vendor?.vendor_name}
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#7a90a4" }}>
                Food Vendor Dashboard
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", // 2x2 on mobile, 1x4 on desktop
            gap: 14,
            marginBottom: 28,
          }}
        >
          {[
            {
              label: "Orders Today",
              value: stats?.today_orders ?? 0,
              icon: <Package size={20} />,
            },
            {
              label: "Revenue Today",
              value: `₦${Number(stats?.today_earnings || 0).toLocaleString()}`,
              icon: <Wallet size={20} />,
            },
            { label: "Pending", value: activeOrders.length, icon: "⏳" },
            {
              label: "Rating",
              value:
                vendor?.rating > 0
                  ? `${Number(vendor.rating).toFixed(1)} ⭐`
                  : "— ⭐",
              icon: "⭐",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "16px 18px",
                boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                border: "1px solid #e8f0f0",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#7a90a4",
                  fontWeight: 600,
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: TEAL }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ORDERS SECTION */}
        {activeSection === "orders" && (
          <div>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: 16,
                fontWeight: 800,
                color: DARK,
              }}
            >
              Incoming Orders
            </h2>
            {activeOrders.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "48px 20px",
                  textAlign: "center",
                  color: "#7a90a4",
                  border: "1px solid #e8f0f0",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 10 }}><Utensils size={40} /></div>
                <p style={{ fontSize: 14, margin: 0 }}>
                  No active orders right now. Orders will appear here in
                  real-time.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))",
                  gap: 14,
                }}
              >
                {activeOrders.map((order) => {
                  const isReview = order.status === "pending_review";
                  const isAwaitingPayment = order.status === "awaiting_payment";

                  return (
                    <div
                      key={order.order_id}
                      style={{
                        background: "#fff",
                        borderRadius: 14,
                        padding: 18,
                        border: isReview
                          ? `2px solid ${TEAL}`
                          : "1px solid #e8f0f0",
                        boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              color: DARK,
                            }}
                          >
                            Order #{String(order.order_id).slice(-6)}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#7a90a4",
                              marginTop: 2,
                            }}
                          >
                            {order.student_name} ·{" "}
                            {new Date(order.created_at).toLocaleTimeString()}
                          </div>
                          {order.delivery_address && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#7a90a4",
                                marginTop: 2,
                              }}
                            >
                              <MapPin size={16} style={{ color: '#0BBFBF' }} /> {order.delivery_address}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "3px 9px",
                              borderRadius: 20,
                              background: isReview ? "#fff7ed" : "#e6fafa",
                              color: isReview ? "#c2410c" : TEAL,
                            }}
                          >
                            {isReview
                              ? "Needs Review"
                              : order.status?.replace(/_/g, " ")}
                          </span>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 15,
                              color: TEAL,
                              marginTop: 4,
                            }}
                          >
                            {isReview
                              ? "Price Pending"
                              : `₦${Number(order.vendor_amount || order.total_amount).toLocaleString()}`}
                          </div>
                        </div>
                      </div>

                      {/* SHOW DESIGN NOTES HERE */}
                      {order.items?.some((i) => i.design_note) && (
                        <div
                          style={{
                            background: "#fff7ed",
                            border: "1px solid #fed7aa",
                            borderRadius: 10,
                            padding: "10px",
                            marginBottom: 12,
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 4px",
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#c2410c",
                            }}
                          >
                            DESIGN INSTRUCTIONS:
                          </p>
                          {order.items.map(
                            (i, idx) =>
                              i.design_note && (
                                <div
                                  key={idx}
                                  style={{
                                    fontSize: 12,
                                    color: DARK,
                                    fontStyle: "italic",
                                  }}
                                >
                                  "{i.design_note}"
                                </div>
                              ),
                          )}
                        </div>
                      )}

                      <div
                        style={{
                          background: BG,
                          borderRadius: 10,
                          padding: "10px 12px",
                          marginBottom: 12,
                        }}
                      >
                        {order.items?.map((i, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 13,
                              marginBottom:
                                idx < order.items.length - 1 ? 4 : 0,
                            }}
                          >
                            <span style={{ color: DARK }}>
                              {i.item_name} × {i.quantity}
                            </span>
                            {!isReview && (
                              <span
                                style={{ fontWeight: 600, color: "#7a90a4" }}
                              >
                                ₦{(i.price * i.quantity).toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        {/* ACTION: SET PRICE */}
                        {isReview && (
                          <button
                            onClick={() => {
                              const currentPrice = order.total_amount || 0;
                              const price = prompt(
                                `Review Price (₦):\n\n- Leave empty to keep student's price (₦${currentPrice.toLocaleString()})\n- Or enter a new price:`,
                                currentPrice,
                              );

                              // If user clicks 'Cancel', do nothing.
                              if (price === null) return;

                              // Use the new price if entered, otherwise use the original
                              const finalPrice =
                                price.trim() === "" ? currentPrice : price;

                              if (
                                confirm(
                                  `Approve this order for ₦${Number(finalPrice).toLocaleString()}?`,
                                )
                              ) {
                                approveCustomOrder(order.order_id, finalPrice);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: "10px",
                              background: TEAL,
                              color: "#fff",
                              border: "none",
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            Review & Approve
                          </button>
                        )}

                        {isAwaitingPayment && (
                          <div
                            style={{
                              flex: 1,
                              padding: "9px",
                              background: "#f8fafc",
                              color: "#64748b",
                              border: "1px solid #e2e8f0",
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 12,
                              textAlign: "center",
                            }}
                          >
                            ⏳ Waiting for Student to Pay
                          </div>
                        )}

                        {order.status === "paid" && (
                          <button
                            onClick={() =>
                              updateOrderStatus(order.order_id, "accepted")
                            }
                            style={{
                              flex: 2,
                              padding: "9px",
                              background: TEAL,
                              color: "#fff",
                              border: "none",
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            ✅ Accept Order
                          </button>
                        )}
                        {(isReview || order.status === "paid") && (
                          <button
                            onClick={() =>
                              updateOrderStatus(order.order_id, "cancelled")
                            }
                            style={{
                              flex: 1,
                              padding: "9px",
                              background: "#fff0f0",
                              color: "#c0392b",
                              border: "1px solid #fecdd3",
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Reject
                          </button>
                        )}
                        {order.status === "accepted" && (
                          <button
                            onClick={() =>
                              updateOrderStatus(order.order_id, "preparing")
                            }
                            style={{
                              flex: 1,
                              padding: "9px",
                              background: "#fff7ed",
                              color: "#c2410c",
                              border: "1px solid #fed7aa",
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Start Preparing
                          </button>
                        )}
                        {order.status === "preparing" && (
                          <button
                            onClick={() =>
                              updateOrderStatus(order.order_id, "ready")
                            }
                            style={{
                              flex: 1,
                              padding: "9px",
                              background: "#16a34a",
                              color: "#fff",
                              border: "none",
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            🟢 Ready for Pickup. Notify Riders
                          </button>
                        )}
                        {order.status === "ready" && (
                          <div
                            style={{
                              flex: 1,
                              padding: "9px",
                              background: "#e6fafa",
                              color: TEAL,
                              border: `1px solid ${TEAL}55`,
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            ⏳ Waiting for rider to accept...
                          </div>
                        )}
                        {order.student_phone && (
                          <a
                            href={`tel:${order.student_phone}`}
                            style={{
                              padding: "9px 14px",
                              background: BG,
                              color: DARK,
                              textDecoration: "none",
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 13,
                              display: "flex",
                              alignItems: "center",
                              border: "1px solid #e0eeee",
                            }}
                          >
                            📞
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MENU SECTION */}
        {activeSection === "menu" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: DARK,
                }}
              >
                Menu Management{" "}
                <span
                  style={{ fontSize: 13, color: "#7a90a4", fontWeight: 500 }}
                >
                  ({menuItems.length} items)
                </span>
              </h2>
              <button
                onClick={() => {
                  setEditItem(null);
                  setNewItem({
                    item_name: "",
                    description: "",
                    price: "",
                    image: null,
                    tags: "",
                  });
                  setAddMenuOpen(true);
                }}
                style={{
                  background: TEAL,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 18px",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + Add New Item
              </button>
            </div>

            {menuItems.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "48px 20px",
                  textAlign: "center",
                  color: "#7a90a4",
                  border: "1px solid #e8f0f0",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
                <p style={{ fontSize: 14, margin: "0 0 16px" }}>
                  No menu items yet. Add your first item!
                </p>
                <button
                  onClick={() => setAddMenuOpen(true)}
                  style={{
                    background: TEAL,
                    color: "#fff",
                    border: "none",
                    borderRadius: 20,
                    padding: "10px 24px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + Add Item
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                  gap: 14,
                }}
              >
                {menuItems.map((item) => {
                  let tags = [];
                  try {
                    tags = JSON.parse(item.tags || "[]");
                  } catch {
                    tags = [];
                  }
                  return (
                    <div
                      key={item.menu_id}
                      style={{
                        background: "#fff",
                        borderRadius: 14,
                        overflow: "hidden",
                        border: "1px solid #e8f0f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,.04)",
                      }}
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          style={{
                            width: "100%",
                            height: 130,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: 130,
                            background: "#e6fafa",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 42,
                          }}
                        >
                          <Utensils size={42} color={TEAL} />
                        </div>
                      )}
                      <div style={{ padding: "12px 14px" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: DARK,
                            marginBottom: 3,
                          }}
                        >
                          {item.item_name}
                        </div>
                        {tags.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                              flexWrap: "wrap",
                              marginBottom: 6,
                            }}
                          >
                            {tags.map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 8,
                                  background: "#e6fafa",
                                  color: TEAL,
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 10,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 15,
                              color: TEAL,
                            }}
                          >
                            ₦{Number(item.price).toLocaleString()}
                          </span>
                          {item.prep_time && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#7a90a4",
                                background: "#f0f4f4",
                                padding: "2px 8px",
                                borderRadius: 20,
                              }}
                            >
                              ⏱{" "}
                              {item.prep_time_unit === "days"
                                ? `${Math.round(item.prep_time / (60 * 24))} day${Math.round(item.prep_time / (60 * 24)) > 1 ? "s" : ""}`
                                : `${item.prep_time} min`}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              let parsedTags = [];
                              try {
                                parsedTags = JSON.parse(item.tags || "[]");
                              } catch {}
                              setEditItem(item);
                              const parseField = (v) => {
                                if (!v) return [];
                                if (Array.isArray(v)) return v;
                                try {
                                  return JSON.parse(v);
                                } catch {
                                  return [];
                                }
                              };
                              setNewItem({
                                item_name: item.item_name,
                                description: item.description || "",
                                price: item.price,
                                prep_time:
                                  item.prep_time_unit === "days"
                                    ? Math.round(item.prep_time / (60 * 24))
                                    : item.prep_time || "",
                                prep_time_unit: item.prep_time_unit || "mins",
                                image: null,
                                tags: parsedTags.join(", "),
                                item_type: item.item_type || "food",
                                variants: parseField(item.variants),
                                toppings: parseField(item.toppings),
                                allow_design_notes:
                                  item.allow_design_notes == 1,
                              });
                              setAddMenuOpen(true);
                            }}
                            style={{
                              flex: 1,
                              padding: "7px",
                              background: "#f0f8f8",
                              color: TEAL,
                              border: `1px solid ${TEAL}44`,
                              borderRadius: 9,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(item.menu_id)}
                            style={{
                              flex: 1,
                              padding: "7px",
                              background: "#fff0f0",
                              color: "#c0392b",
                              border: "1px solid #fecdd3",
                              borderRadius: 9,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* HISTORY SECTION */}
        {activeSection === "history" && <OrderHistory />}
      </div>

      {/* ADD/EDIT MENU MODAL */}
      {addMenuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            zIndex: 500,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setAddMenuOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 520,
              maxHeight: "78vh",
              overflowY: "auto",
              padding: "24px 24px 80px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 36,
                height: 4,
                background: "#e0eeee",
                borderRadius: 2,
                margin: "0 auto 20px",
              }}
            />
            <h3 style={{ margin: "0 0 20px", fontWeight: 800, color: DARK }}>
              {editItem ? "Edit Menu Item" : "Add Menu Item"}
            </h3>
            <form onSubmit={saveMenuItem}>
              {[
                {
                  label: "Item Name",
                  key: "item_name",
                  type: "text",
                  required: true,
                  placeholder: "e.g. Jollof Rice",
                },
                {
                  label: "Description",
                  key: "description",
                  type: "text",
                  required: true,
                  placeholder: "e.g. Served with stew and plantain",
                },
                ...(vendor?.category !== "foodstuff"
                  ? [
                      {
                        label: "Price (₦)",
                        key: "price",
                        type: "number",
                        required: true,
                        placeholder: "1200",
                      },
                    ]
                  : []),
                {
                  label: "Tags (separate with comma)",
                  key: "tags",
                  type: "text",
                  placeholder: "spicy, vegetarian, rice",
                },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={lbl}>{f.label}</label>
                  <input
                    type={f.type}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={newItem[f.key]}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                    style={inp}
                  />
                </div>
              ))}
              {/* Prep Time with mins/days toggle */}
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Prep Time</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    placeholder={
                      newItem.prep_time_unit === "days" ? "e.g. 2" : "e.g. 15"
                    }
                    value={newItem.prep_time}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, prep_time: e.target.value }))
                    }
                    style={{ ...inp, flex: 1 }}
                  />
                  <div
                    style={{
                      display: "flex",
                      border: "1.5px solid #dde8e8",
                      borderRadius: 10,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {["mins", "days"].map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() =>
                          setNewItem((p) => ({ ...p, prep_time_unit: unit }))
                        }
                        style={{
                          padding: "0 14px",
                          border: "none",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          background:
                            newItem.prep_time_unit === unit ? TEAL : "#fff",
                          color:
                            newItem.prep_time_unit === unit
                              ? "#fff"
                              : "#7a90a4",
                          transition: "all .15s",
                        }}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Item type selector - determines packing fee */}
              {/* Only show packing fee option for non-bakery & non-foodstuff */}
              {!["bakery", "foodstuff"].includes(vendor?.category) && (
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>
                    Item Type
                    <span
                      style={{
                        color: "#e74c3c",
                        fontSize: 10,
                        fontWeight: 400,
                      }}
                    >
                      (determines packing fee)
                    </span>
                  </label>

                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    {[
                      ["food", <Utensils size={16} />, "Packing fee applies"],
                      ["drink", <Coffee size={16} />, "No packing fee"],
                    ].map(([type, label, hint]) => (
                      <div
                        key={type}
                        onClick={() =>
                          setNewItem((p) => ({ ...p, item_type: type }))
                        }
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `2px solid ${newItem.item_type === type ? TEAL : "#dde8e8"}`,
                          background:
                            newItem.item_type === type ? "#e6fafa" : "#fff",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        <div>{label}</div>
                        <div style={{ fontSize: 10, color: "#7a90a4" }}>
                          {hint}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FOODSTUFF: Quantity variants */}
              {vendor?.category === "foodstuff" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>
                    Quantity Types & Prices{" "}
                    <span style={{ color: "#e74c3c" }}>*</span>
                  </label>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#7a90a4",
                      margin: "0 0 8px",
                    }}
                  >
                    Add the different quantities you sell (e.g. Rubber, Bag, 1
                    kilo) with their prices
                  </p>
                  {newItem.variants.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                        background: "#f0fafa",
                        borderRadius: 10,
                        padding: "8px 12px",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: 600,
                          color: DARK,
                        }}
                      >
                        {v.label}
                      </span>
                      <span
                        style={{ fontSize: 13, color: TEAL, fontWeight: 700 }}
                      >
                        ₦{Number(v.price).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setNewItem((p) => ({
                            ...p,
                            variants: p.variants.filter((_, j) => j !== i),
                          }))
                        }
                        style={{
                          background: "#fff0f0",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#e74c3c",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <select
                      value={newVariant.label}
                      onChange={(e) =>
                        setNewVariant((p) => ({ ...p, label: e.target.value }))
                      }
                      style={{ flex: 2, ...inp, padding: "8px 10px" }}
                    >
                      <option value="">Select quantity type...</option>
                      {[
                        "Rubber",
                        "1/2 Rubber",
                        "Full Carton",
                        "1/2 Carton",
                        "1/4 Carton",
                        "Bag",
                        "1/4 Bag",
                        "1/2 Bag",
                        "Full Crate",
                        "1/2 Crate",
                        "Roll",
                        "Pieces",
                        "1/2 Kilo",
                        "1 Kilo",
                        "1/4 Kilo",
                      ].map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Price ₦"
                      value={newVariant.price}
                      onChange={(e) =>
                        setNewVariant((p) => ({ ...p, price: e.target.value }))
                      }
                      style={{ flex: 1, ...inp, padding: "8px 10px" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newVariant.label || !newVariant.price) return;
                        setNewItem((p) => ({
                          ...p,
                          variants: [
                            ...p.variants,
                            {
                              label: newVariant.label,
                              price: Number(newVariant.price),
                            },
                          ],
                        }));
                        setNewVariant({ label: "", price: "" });
                      }}
                      style={{
                        padding: "8px 14px",
                        background: TEAL,
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              )}

              {/* BAKERY: Toppings options */}
              {vendor?.category === "bakery" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>
                    Toppings / Add-ons{" "}
                    <span
                      style={{
                        fontSize: 11,
                        color: "#7a90a4",
                        fontWeight: 400,
                      }}
                    >
                      (optional)
                    </span>
                  </label>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#7a90a4",
                      margin: "0 0 8px",
                    }}
                  >
                    Add toppings students can choose from (e.g. Sprinkles +₦200,
                    Oreos +₦500)
                  </p>
                  {newItem.toppings.map((t, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                        background: "#f0fafa",
                        borderRadius: 10,
                        padding: "8px 12px",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: 600,
                          color: DARK,
                        }}
                      >
                        {t.label}
                      </span>
                      <span
                        style={{ fontSize: 13, color: TEAL, fontWeight: 700 }}
                      >
                        {t.price > 0
                          ? `+₦${Number(t.price).toLocaleString()}`
                          : "Free"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setNewItem((p) => ({
                            ...p,
                            toppings: p.toppings.filter((_, j) => j !== i),
                          }))
                        }
                        style={{
                          background: "#fff0f0",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#e74c3c",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <input
                      type="text"
                      placeholder="Topping name (e.g. Sprinkles)"
                      value={newTopping.label}
                      onChange={(e) =>
                        setNewTopping((p) => ({ ...p, label: e.target.value }))
                      }
                      style={{ flex: 2, ...inp, padding: "8px 10px" }}
                    />
                    <input
                      type="number"
                      placeholder="+₦ price"
                      value={newTopping.price}
                      onChange={(e) =>
                        setNewTopping((p) => ({ ...p, price: e.target.value }))
                      }
                      style={{ flex: 1, ...inp, padding: "8px 10px" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newTopping.label) return;
                        setNewItem((p) => ({
                          ...p,
                          toppings: [
                            ...p.toppings,
                            {
                              label: newTopping.label,
                              price: Number(newTopping.price) || 0,
                            },
                          ],
                        }));
                        setNewTopping({ label: "", price: "" });
                      }}
                      style={{
                        padding: "8px 14px",
                        background: TEAL,
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  {/* Design notes for custom cakes */}
                  <div
                    style={{
                      marginTop: 12,
                      background: "#fff8e1",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#92400e",
                    }}
                  >
                    💡 <b>Custom designs:</b> Enable "Design notes" below so
                    customers can describe their cake design. You can update the
                    price after reviewing their note before accepting the order.
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      onClick={() =>
                        setNewItem((p) => ({
                          ...p,
                          allow_design_notes: !p.allow_design_notes,
                        }))
                      }
                      style={{
                        width: 40,
                        height: 22,
                        background: newItem.allow_design_notes
                          ? TEAL
                          : "#dde8e8",
                        borderRadius: 20,
                        position: "relative",
                        cursor: "pointer",
                        transition: "background .25s",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          background: "#fff",
                          borderRadius: "50%",
                          position: "absolute",
                          top: 3,
                          left: newItem.allow_design_notes ? 21 : 3,
                          transition: "left .25s",
                        }}
                      />
                    </div>
                    <span
                      style={{ fontSize: 13, color: DARK, fontWeight: 600 }}
                    >
                      Allow customers to add design notes
                    </span>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Food Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, image: e.target.files[0] }))
                  }
                  style={{ fontSize: 13, fontFamily: "inherit" }}
                />
                <p
                  style={{ margin: "6px 0 0", fontSize: 11, color: "#7a90a4" }}
                >
                  Max 5MB.
                  {editItem ? " Leave empty to keep current photo." : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAddMenuOpen(false)}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: BG,
                    color: DARK,
                    border: "1px solid #e0eeee",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 2,
                    padding: 12,
                    background: TEAL,
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editItem
                      ? "Save Changes"
                      : "Add to Menu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get("/vendor/orders/history")
      .then(({ data }) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const TEAL = "#0BBFBF";
  if (loading)
    return (
      <p style={{ color: "#7a90a4", textAlign: "center", padding: 30 }}>
        Loading history...
      </p>
    );
  return (
    <div>
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: 16,
          fontWeight: 800,
          color: "#0d2137",
        }}
      >
        Order History
      </h2>
      {orders.length === 0 && (
        <p style={{ textAlign: "center", color: "#7a90a4", padding: 40 }}>
          No completed orders yet.
        </p>
      )}
      {orders.map((o) => (
        <div
          key={o.order_id}
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid #e8f0f0",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0d2137" }}>
              {o.student_name || "Customer"}
            </div>
            <div style={{ fontSize: 11, color: "#7a90a4", marginTop: 2 }}>
              {new Date(o.created_at).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, color: TEAL, fontSize: 15 }}>
              ₦{Number(o.vendor_amount || o.total_amount).toLocaleString()}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: o.status === "delivered" ? "#16a34a" : "#7a90a4",
                marginTop: 2,
              }}
            >
              {o.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
