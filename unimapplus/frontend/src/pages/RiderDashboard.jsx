import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { getSocket } from "../hooks/useSocket";
import {
  Store,
  MapPin,
  Bike,
  Trophy,
  Lock,
  Package,
  Map,
  House,
  DoorClosed,
  Utensils,
  ClipboardList,
  Wallet,
} from "lucide-react";

const TEAL = "#0BBFBF";
const BG = "#f0f5f5";
const DARK = "#0d2137";

export default function RiderDashboard() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [broadcasting, setBroadcasting] = useState(false);
  const [newRequest, setNewRequest] = useState(null);
  const [riderToast, setRiderToast] = useState("");
  const [proximityError, setProximityError] = useState(null); // { orderId, message, distM }
  const locationInterval = useRef(null);
  const driverIdRef = useRef(null);

  useEffect(() => {
    loadDashboard();
    const socket = getSocket();
    socket.on("rider_assigned", (data) => {
      loadDashboard();
      setNewRequest(data);
    });
    socket.on("new_available_order", () => {
      loadDashboard();
    });
    // Re-join rider room after a socket reconnect so the backend can still
    // reach this rider with new_available_order and rider_assigned events.
    const handleReconnect = () => {
      if (driverIdRef.current) {
        socket.emit("join_rider", driverIdRef.current);
      }
    };
    socket.on("connect", handleReconnect);
    // Poll every 30s as fallback in case socket event is missed
    const poll = setInterval(() => loadDashboard(), 30000);
    return () => {
      socket.off("rider_assigned");
      socket.off("new_available_order");
      socket.off("connect", handleReconnect);
      clearInterval(poll);
      stopBroadcast();
    };
  }, []);

  function showToast(msg) {
    setRiderToast(msg);
    setTimeout(() => setRiderToast(""), 3000);
  }

  async function loadDashboard() {
    try {
      const { data } = await api.get("/rider/dashboard");
      setDashboard(data);
      // Join socket room with real rider id
      const socket = getSocket();
      if (data.rider?.driver_id) {
        driverIdRef.current = data.rider.driver_id;
        socket.emit("join_rider", data.rider.driver_id);
      }
      // Auto-start broadcast if already available
      if (data.rider?.is_available && !locationInterval.current)
        startBroadcast();
    } catch {}
    setLoading(false);
  }

  // async function toggleAvailability() {
  //   try {
  //     const { data } = await api.post('/rider/toggle-availability');
  //     setDashboard(d => d ? { ...d, rider: { ...d.rider, is_available: data.is_available } } : d);
  //     if (data.is_available) startBroadcast(); else stopBroadcast();
  //   } catch {}
  // }

  async function toggleAvailability() {
    try {
      //Send request to backend
      const { data } = await api.post("/rider/toggle-availability");

      //Update the local state immediately using the backend's confirmed value
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rider: {
            ...prev.rider,
            is_available: data.is_available, // Ensure backend returns { is_available: true/false }
          },
        };
      });

      //Handle location broadcasting based on the NEW status
      if (data.is_available) {
        startBroadcast();
      } else {
        stopBroadcast();
      }
    } catch (e) {
      showToast("❌ " + (e.response?.data?.message || "Failed to update"));
    }
  }

  function startBroadcast() {
    if (!navigator.geolocation || locationInterval.current) return;
    setBroadcasting(true);
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          api
            .post("/rider/location", {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            })
            .catch(() => {}),
        () => {},
      );
    };
    send();
    locationInterval.current = setInterval(send, 10000);
  }

  function stopBroadcast() {
    setBroadcasting(false);
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
  }

  async function acceptOrder(orderId) {
    try {
      await api.post(`/rider/orders/${orderId}/accept`);
      setNewRequest(null);
      setTab("active");
      loadDashboard();
      startBroadcast();
    } catch (e) {
      showToast(
        "❌ " + (e.response?.data?.message || "Order no longer available"),
      );
      loadDashboard();
    }
  }

  async function updateStatus(orderId, status) {
    try {
      await api.put(`/rider/orders/${orderId}/status`, { status });
      setDashboard((d) =>
        d
          ? {
              ...d,
              activeOrders: d.activeOrders?.map((o) =>
                o.order_id === orderId ? { ...o, status } : o,
              ),
            }
          : d,
      );
    } catch (e) {
      showToast("❌ " + (e.response?.data?.message || "Failed"));
    }
  }

  async function markDelivered(orderId) {
    if (!navigator.geolocation) {
      showToast("Location not supported on this device");
      return;
    }
    showToast("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > 200) {
          showToast(`GPS accuracy is low (${Math.round(accuracy)}m). Move to open area and try again.`);
          return;
        }
        try {
          await api.post(`/rider/orders/${orderId}/delivered`, {
            latitude,
            longitude,
          });
          showToast("Delivery confirmed!");
          loadDashboard();
        } catch (e) {
          const distM = e.response?.data?.distance_meters;
          if (distM !== undefined) {
            const distText =
              distM >= 1000 ? `${(distM / 1000).toFixed(1)}km` : `${distM}m`;
            setProximityError({
              orderId,
              message: `You are ${distText} from the delivery location. Move within 500m to confirm delivery.`,
              distM,
            });
          } else {
            showToast(
              e.response?.data?.message || "Error confirming delivery"
            );
          }
        }
      },
      (err) => {
        if (err.code === 1) {
          showToast("Location access denied. Enable GPS in browser settings and try again.");
        } else if (err.code === 2) {
          showToast("Could not determine your location. Move to an open area and try again.");
        } else {
          showToast("Location request timed out. Try again.");
        }
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 },
    );
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
        Loading...
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </div>
    );

  const rider = dashboard?.rider;
  const stats = dashboard?.stats;
  const active = dashboard?.activeOrders || [];
  const avail = dashboard?.availableOrders || [];

  const nextStatus = { rider_assigned: "picked_up", picked_up: "on_the_way" };
  const nextLabel = {
    rider_assigned: (
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Package size={12} />
        Picked Up from Vendor
      </span>
    ),
    picked_up: (
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Bike size={12} />
        I'm On the Way
      </span>
    ),
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        background: BG,
      }}
    >
      {/* ── HERO HEADER ── */}
      <div
        style={{
          background: `linear-gradient(135deg,${TEAL},#089898)`,
          padding: "16px 16px 24px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          {/* LEFT — Logo + Unimap+ */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <img
              src="/logo_white.png"
              alt="Unimap+"
              style={{
                width: 30,
                height: 30,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontWeight: 900,
                fontSize: 16,
                color: "#fff",
                letterSpacing: 0.5,
                whiteSpace: "nowrap",
              }}
            >
              Unimap+
            </span>
          </div>

          {/* RIGHT — Logout + Rider name + bike icon */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            <button
              onClick={logout}
              style={{
                background: "rgba(255,255,255,.15)",
                border: "none",
                borderRadius: 20,
                padding: "6px 11px",
                color: "#fff",
                fontWeight: 600,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              Logout
            </button>
            <div style={{ textAlign: "right", minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 14,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 110,
                }}
              >
                {rider?.fullname}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,.75)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                {broadcasting ? (
                  <>
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        background: "#a7f3d0",
                        borderRadius: "50%",
                        display: "inline-block",
                        flexShrink: 0,
                        animation: "pulse 1.5s infinite",
                      }}
                    />
                    Broadcasting
                  </>
                ) : (
                  "○ Offline"
                )}
              </div>
            </div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(255,255,255,.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bike size={19} style={{ color: "#fff" }} />
            </div>
          </div>
        </div>
        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 8,
          }}
        >
          {[
            { label: "Deliveries", value: stats?.total_deliveries || 0 },
            {
              label: "Earned Today",
              value: `₦${Number(stats?.today_earnings || 0).toLocaleString()}`,
            },
            {
              label: "Total Earned",
              value: `₦${Number(stats?.total_earnings || 0).toLocaleString()}`,
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,.15)",
                borderRadius: 12,
                padding: "10px 8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 15,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,.75)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Online Toggle — below stats */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,.15)",
            borderRadius: 30,
            padding: "6px 12px",
            width: "fit-content",
            marginTop: 12,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
            {rider?.is_available ? "Online" : "Offline"}
          </span>
          <div
            onClick={toggleAvailability}
            style={{
              width: 40,
              height: 22,
              background: rider?.is_available
                ? "#a7f3d0"
                : "rgba(255,255,255,.3)",
              borderRadius: 20,
              position: "relative",
              cursor: "pointer",
              transition: "background .25s",
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
                left: rider?.is_available ? 21 : 3,
                transition: "left .25s",
                boxShadow: "0 1px 3px rgba(0,0,0,.2)",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div
        style={{
          background: "#fff",
          padding: "0 16px",
          borderBottom: "1px solid #e0eeee",
          display: "flex",
          gap: 0,
        }}
      >
        {[
          [
            "active",
            <>
              <Bike size={14} />
              Active{active.length > 0 ? ` (${active.length})` : ""}
            </>,
          ],
          [
            "available",
            <>
              <ClipboardList size={14} />
              Available{avail.length > 0 ? ` (${avail.length})` : ""}
            </>,
          ],
          [
            "earnings",
            <>
              <Wallet size={14} />
              Earnings
            </>,
          ],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: "13px 8px",
              border: "none",
              borderBottom: `2.5px solid ${tab === id ? TEAL : "transparent"}`,
              background: "none",
              fontWeight: tab === id ? 700 : 500,
              fontSize: 12,
              color: tab === id ? TEAL : "#7a90a4",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all .15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        style={{ padding: "16px 16px 40px", maxWidth: 680, margin: "0 auto" }}
      >
        {/* ── ACTIVE TAB ── */}
        {tab === "active" &&
          (active.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "52px 20px",
                color: "#7a90a4",
              }}
            >
              <div style={{ fontSize: 52, marginBottom: 12 }}>
                <Bike size={52} style={{ color: TEAL }} />
              </div>
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                No active deliveries. Check available orders to accept one.
              </p>
              <button
                onClick={() => setTab("available")}
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
                View Available
              </button>
            </div>
          ) : (
            active.map((order) => (
              <div
                key={order.order_id}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  overflow: "hidden",
                  marginBottom: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
                }}
              >
                {/* Order header */}
                <div
                  style={{
                    background: `linear-gradient(135deg,${TEAL}18,${TEAL}08)`,
                    padding: "14px 16px",
                    borderBottom: "1px solid #e0f8f8",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: DARK }}>
                      Order #{String(order.order_id).slice(-6)}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#7a90a4", marginTop: 2 }}
                    >
                      {order.student_name}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: TEAL }}>
                      +₦{Number(order.rider_amount || 200).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, color: "#7a90a4" }}>
                      your earnings
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    padding: "6px 16px",
                    background: order.payment_option === "pay_on_delivery" ? "#fff8e6" : "#e6fafa",
                    borderBottom: `1px solid ${order.payment_option === "pay_on_delivery" ? "#fde68a" : "#ccf5f5"}`,
                    fontSize: 11,
                    fontWeight: 700,
                    color: order.payment_option === "pay_on_delivery" ? "#b45309" : "#089898",
                  }}
                >
                  {order.payment_option === "pay_on_delivery"
                    ? "Pay on Delivery — collect delivery fee in cash from student"
                    : "Paid In-App — no cash to collect"}
                </div>

                <div style={{ padding: "14px 16px" }}>
                  {/* Route */}
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "#fff3e0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        🏪
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#7a90a4",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          Pick up from
                        </div>
                        <div
                          style={{ fontWeight: 700, fontSize: 13, color: DARK }}
                        >
                          {order.vendor_name}
                          {order.vendor_location
                            ? ` (${order.vendor_location})`
                            : ""}
                        </div>
                        {order.vendor_phone && (
                          <a
                            href={`tel:${order.vendor_phone}`}
                            style={{
                              fontSize: 11,
                              color: TEAL,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            {order.vendor_phone}
                          </a>
                        )}
                      </div>
                    </div>
                    {/* Route line */}
                    <div
                      style={{
                        width: 2,
                        height: 16,
                        background: `${TEAL}55`,
                        margin: "0 0 8px 13px",
                        borderRadius: 2,
                      }}
                    />
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "#e0fafa",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        📍
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#7a90a4",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          Deliver to
                        </div>
                        <div
                          style={{ fontWeight: 700, fontSize: 13, color: DARK }}
                        >
                          {order.delivery_address || "Campus"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div
                    style={{
                      background: BG,
                      borderRadius: 10,
                      padding: "8px 12px",
                      marginBottom: 12,
                      fontSize: 12,
                      color: "#7a90a4",
                    }}
                  >
                    {order.items
                      ?.map((i) => `${i.item_name} ×${i.quantity}`)
                      .join(" · ")}
                  </div>

                  {/* Student phone - visible only during active delivery */}
                  {order.student_phone &&
                    !["delivered", "cancelled"].includes(order.status) && (
                      <div
                        style={{
                          background: "#f0fafa",
                          borderRadius: 10,
                          padding: "8px 12px",
                          marginBottom: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>📱</span>
                        <div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#7a90a4",
                              fontWeight: 600,
                            }}
                          >
                            CUSTOMER
                          </div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: DARK,
                              letterSpacing: 0.5,
                            }}
                          >
                            {order.student_phone}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {nextStatus[order.status] && (
                      <button
                        onClick={() =>
                          updateStatus(order.order_id, nextStatus[order.status])
                        }
                        style={{
                          flex: 1,
                          padding: "11px",
                          background: TEAL,
                          color: "#fff",
                          border: "none",
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {nextLabel[order.status]}
                      </button>
                    )}
                    {order.status === "on_the_way" && (
                      <button
                        onClick={() => markDelivered(order.order_id)}
                        style={{
                          flex: 1,
                          padding: "11px",
                          background: "#16a34a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ✅ Confirm Delivered
                      </button>
                    )}
                    {order.student_phone &&
                      !["delivered", "cancelled"].includes(order.status) && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <a
                            href={`tel:${order.student_phone}`}
                            style={{
                              padding: "11px 14px",
                              background: "#e6fafa",
                              color: TEAL,
                              textDecoration: "none",
                              borderRadius: 12,
                              fontWeight: 700,
                              fontSize: 13,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              border: `1px solid ${TEAL}44`,
                            }}
                          >
                            📞 Call
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                order.student_phone,
                              );
                              showToast("📋 Number copied!");
                            }}
                            style={{
                              padding: "11px 12px",
                              background: BG,
                              color: DARK,
                              border: "1px solid #e0eeee",
                              borderRadius: 12,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ))
          ))}

        {/* ── AVAILABLE TAB ── */}
        {tab === "available" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  color: DARK,
                }}
              >
                Available Orders
              </h3>
              <button
                onClick={loadDashboard}
                style={{
                  background: "#fff",
                  border: "1px solid #e0eeee",
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: TEAL,
                }}
              >
                ↻ Refresh
              </button>
            </div>

            {!rider?.is_available && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 14,
                  fontSize: 13,
                  color: "#92400e",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⚠️</span> You're offline. Toggle to Online to accept
                orders.
              </div>
            )}

            {avail.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 20px",
                  color: "#7a90a4",
                }}
              >
                <div style={{ fontSize: 44, marginBottom: 10 }}>🔍</div>
                <p style={{ fontSize: 14 }}>No orders available right now.</p>
                <button
                  onClick={loadDashboard}
                  style={{
                    background: TEAL,
                    color: "#fff",
                    border: "none",
                    borderRadius: 20,
                    padding: "9px 20px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    marginTop: 12,
                  }}
                >
                  ↻ Refresh
                </button>
              </div>
            ) : (
              avail.map((order) => (
                <div
                  key={order.order_id}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    marginBottom: 12,
                    overflow: "hidden",
                    boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                    border: "1px solid #e0f5f5",
                  }}
                >
                  {/* New delivery request header */}
                  <div
                    style={{
                      background: `linear-gradient(90deg,${TEAL},#089898)`,
                      padding: "10px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🔔</span>
                    <div>
                      <div
                        style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}
                      >
                        New Delivery Request
                      </div>
                      <div
                        style={{ fontSize: 10, color: "rgba(255,255,255,.8)" }}
                      >
                        Respond when ready
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        <Store size={13} />
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#7a90a4",
                            fontWeight: 600,
                          }}
                        >
                          Pick up from
                        </div>
                        <div
                          style={{ fontWeight: 700, fontSize: 13, color: DARK }}
                        >
                          {order.vendor_name}
                          {order.vendor_location
                            ? ` (${order.vendor_location})`
                            : ""}
                        </div>
                        {order.vendor_phone && (
                          <a
                            href={`tel:${order.vendor_phone}`}
                            style={{
                              fontSize: 11,
                              color: TEAL,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            {order.vendor_phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        <MapPin size={13} />
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#7a90a4",
                            fontWeight: 600,
                          }}
                        >
                          Deliver to
                        </div>
                        <div
                          style={{ fontWeight: 700, fontSize: 13, color: DARK }}
                        >
                          {order.delivery_address || "Campus"}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        padding: "8px 12px",
                        background: BG,
                        borderRadius: 10,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>
                        <Wallet size={14} />
                      </span>
                      <span
                        style={{ fontWeight: 800, fontSize: 14, color: TEAL }}
                      >
                        ₦{Number(order.rider_amount || 200).toLocaleString()}
                      </span>
                      <span style={{ fontSize: 11, color: "#7a90a4" }}>
                        · your earnings
                      </span>
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        marginBottom: 14,
                        padding: "5px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        background: order.payment_option === "pay_on_delivery" ? "#fff8e6" : "#e6fafa",
                        color: order.payment_option === "pay_on_delivery" ? "#b45309" : "#089898",
                        border: `1px solid ${order.payment_option === "pay_on_delivery" ? "#f59e0b" : "#0d9488"}`,
                      }}
                    >
                      {order.payment_option === "pay_on_delivery"
                        ? "Pay on Delivery — collect delivery fee in cash"
                        : "Paid In-App — no cash to collect"}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => acceptOrder(order.order_id)}
                        disabled={!rider?.is_available}
                        style={{
                          flex: 2,
                          padding: "11px",
                          background: rider?.is_available ? TEAL : "#ccc",
                          color: "#fff",
                          border: "none",
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: rider?.is_available
                            ? "pointer"
                            : "not-allowed",
                          fontFamily: "inherit",
                        }}
                      >
                        ✓ Accept Delivery
                      </button>
                      <button
                        onClick={() => {
                          // Just reload to get fresh list — in production would notify server
                          setDashboard((d) =>
                            d
                              ? {
                                  ...d,
                                  availableOrders: d.availableOrders.filter(
                                    (o) => o.order_id !== order.order_id,
                                  ),
                                }
                              : d,
                          );
                        }}
                        style={{
                          flex: 1,
                          padding: "11px",
                          background: "#fff",
                          color: "#7a90a4",
                          border: "1px solid #e0eeee",
                          borderRadius: 12,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── EARNINGS TAB ── */}
        {tab === "earnings" && <EarningsHistory />}
      </div>

      {/* PROXIMITY ERROR MODAL */}
      {proximityError && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              width: "100%",
              maxWidth: 340,
              padding: 28,
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              <MapPin size={48} style={{ color: "#0BBFBF" }} />
            </div>
            <h3
              style={{
                margin: "0 0 10px",
                fontWeight: 800,
                color: "#1a1a2e",
                fontSize: 17,
              }}
            >
              Too Far From Delivery Location
            </h3>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 14,
                color: "#7a90a4",
                lineHeight: 1.6,
              }}
            >
              {proximityError.message}
            </p>
            <div
              style={{
                background: "#fff3cd",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 20,
                fontSize: 12,
                color: "#856404",
              }}
            >
              💡 Make sure you are at the student's door or location before
              confirming delivery.
            </div>
            <button
              onClick={() => setProximityError(null)}
              style={{
                width: "100%",
                padding: 12,
                background: "#0BBFBF",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              OK, Got It
            </button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {riderToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: DARK,
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 30,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,.2)",
            maxWidth: "90vw",
            textAlign: "center",
          }}
        >
          {riderToast}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>
    </div>
  );
}

function EarningsHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get("/rider/earnings")
      .then(({ data }) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <p style={{ textAlign: "center", color: "#7a90a4", padding: 30 }}>
        Loading...
      </p>
    );
  const totalEarned = orders.reduce(
    (s, o) => s + Number(o.rider_amount || 0),
    0,
  );
  return (
    <div>
      {orders.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid #e0f5f5",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "#7a90a4",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Total Earned
            </div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#0BBFBF" }}>
              ₦{totalEarned.toLocaleString()}
            </div>
          </div>
          <span style={{ fontSize: 32 }}>
            <Wallet size={32} style={{ color: "#0BBFBF" }} />
          </span>
        </div>
      )}
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: 14,
          fontWeight: 700,
          color: "#7a90a4",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Delivery History
      </h3>
      {orders.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            color: "#7a90a4",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 10 }}>📦</div>
          <p>No completed deliveries yet.</p>
        </div>
      )}
      {orders.map((o) => (
        <div
          key={o.order_id}
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "13px 16px",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid #f0f8f8",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0d2137" }}>
              {o.vendor_name || "Order"}
            </div>
            <div style={{ fontSize: 11, color: "#7a90a4", marginTop: 2 }}>
              {new Date(o.updated_at).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div style={{ fontSize: 10, marginTop: 3, fontWeight: 600, color: o.payment_option === "pay_on_delivery" ? "#b45309" : "#089898" }}>
              {o.payment_option === "pay_on_delivery" ? "Pay on Delivery" : "Paid In-App"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, color: "#0BBFBF", fontSize: 15 }}>
              +₦{Number(o.rider_amount).toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>
              Delivered ✓
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
