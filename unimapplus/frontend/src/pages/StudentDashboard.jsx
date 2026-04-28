import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import useCartStore from "../store/cartStore";
import { useOrderTracking } from "../hooks/useSocket";
import {
  Store,
  Home,
  GraduationCap,
  MapPin,
  Bike,
  Trophy,
  Lock,
  Package,
  Map,
  House,
  DoorClosed,
  Utensils,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const TEAL = "#0BBFBF";
const DARK = "#0d2137";
const BG = "#f5f6fa";

const Ic = ({ d, s = 20, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
    <path d={d} />
  </svg>
);
const IcHome = () => <Ic d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />;
const IcMap = () => (
  <Ic d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5z" />
);
const IcOrders = () => (
  <Ic d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" />
);
const IcProfile = () => (
  <Ic d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
);
const IcCart = () => (
  <Ic d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 5.9 17 7 17h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 23.46 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
);
const IcSearch = () => (
  <Ic d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14" />
);
const IcChevron = () => (
  <Ic d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" s={16} />
);
const IcMenu = () => <Ic d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />;
const IcClose = () => (
  <Ic d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
);
const IcPlus = () => <Ic d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" s={18} />;
const IcPin = () => (
  <Ic
    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
    s={14}
  />
);

const CAT_LABELS = {
  african_food: "🍲 African Food",
  fast_food: "🍔 Fast Food",
  snacks: "🥪 Snacks",
  drinks: "🥤 Drinks",
  bakery: "🍞 Bakery",
  rice_dishes: "🍚 Rice Dishes",
  protein: "🍗 Proteins & Grills",
  vegetarian: "🥗 Vegetarian",
  foodstuff: "🛒 Foodstuff",
  other: "🍽️ Other",
};

const SLIDES = [

  {
    bg: "#ffffff",
    accent: "#E67E22",
    tag: "FLASH DEAL",
    highlight: "50%",
    headline: "OFF Wednesdays",
    sub: "Buka 1 · Every Wednesday",
    cta: "Claim Offer",
  },
  {
    bg: "#0BBFBF",
    accent: "#064e4e",
    tag: "TRENDING NOW",
    highlight: "Jollof Rice",
    headline: "is hot right now",
    sub: "Ordered 43× this hour · Buka 1",
    cta: "Order now",
  },
  {
    bg: "#c8f0ee",
    accent: "#0a7a7a",
    tag: "NEW ON CAMPUS",
    highlight: "New on",
    headline: "Campus 🔥",
    sub: "Ofada Rice now available",
    cta: "Order Now",
  },
];


const VENDOR_COLORS = [
  "#E67E22",
  "#1a4a3a",
  "#2d1a4a",
  "#0BBFBF",
  "#d35400",
  "#2c3e50",
];

const getVendorColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % VENDOR_COLORS.length;
  return VENDOR_COLORS[index];
};
// Nearby locations loaded from DB dynamically

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    carts,
    addItem,
    removeItem,
    clearVendorCart,
    setPortions,
    getCartArray,
    getVendorTotal,
    getVendorList,
    getTotalCount,
    setDesignNote,
  } = useCartStore();
  const [checkoutVendorId, setCheckoutVendorId] = useState(null);
  const [finalPaymentOrder, setFinalPaymentOrder] = useState(null);
  const vendorList = getVendorList(); // recomputes on every render when carts changes

  const [tab, setTab] = useState("home");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("unimap_dark") === "1");
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [featuredMenu, setFeaturedMenu] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [ratingModal, setRatingModal] = useState(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [toast, setToast] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sideOpen, setSideOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [nearbyLocations, setNearbyLocations] = useState([]);
  const [packingFee, setPackingFee] = useState(0);
  const [deliveryModal, setDeliveryModal] = useState(null); // { vendorId, vendorName }
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }
  const [deliveryAddr, setDeliveryAddr] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [deliverySearch, setDeliverySearch] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocSuggestions, setShowLocSuggestions] = useState(false);
  const [allCampusLocations, setAllCampusLocations] = useState([]);
  const [itemCustomizations, setItemCustomizations] = useState({}); // {menu_id: {variant, toppings[], designNote}}
  const [recommendations, setRecommendations] = useState(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showAllVendors, setShowAllVendors] = useState(false);

  const mapRef = useRef(null);
  const leafletMap = useRef(null);

  const cartCount = getTotalCount();

  // Handle browser back button — go to previous tab, not logout
  useEffect(() => {
    // Push initial state
    window.history.pushState({ tab: "home", vendor: null }, "");
    const handlePop = (e) => {
      const state = e.state;
      if (state) {
        if (state.vendor) {
          setSelectedVendor(state.vendor);
        } else {
          setSelectedVendor(null);
          setTab(state.tab || "home");
        }
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Push state when tab changes
  useEffect(() => {
    window.history.pushState({ tab, vendor: null }, "");
  }, [tab]);

  // Push state when vendor opens
  useEffect(() => {
    if (selectedVendor) {
      window.history.pushState({ tab: "home", vendor: selectedVendor }, "");
    }
  }, [selectedVendor]);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    const t = setInterval(
      () => setHeroIdx((i) => (i + 1) % SLIDES.length),
      4000,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadVendors();
    loadOrders();
    loadFeaturedMenu();
    fetchWeather();
    loadCampusLocations();
  }, []);

  async function loadCampusLocations() {
    try {
      const { data } = await api.get("/locations", {
        params: { school_id: user?.school_id },
      });
      setAllCampusLocations(data.locations || []);
    } catch {}
  }

  useOrderTracking(
    trackedOrder?.order_id,
    ({ status, order_id }) => {
      // Update both trackedOrder and the orders[] array so all cards re-render
      setTrackedOrder((o) => (o ? { ...o, status } : null));
      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === (order_id || trackedOrder?.order_id)
            ? { ...o, status }
            : o,
        ),
      );
    },
    ({ latitude, longitude }) =>
      setTrackedOrder((o) =>
        o ? { ...o, rider_lat: latitude, rider_lng: longitude } : null,
      ),
  );

  // Real weather using browser geolocation + Open-Meteo (free, no key needed)
  function fetchWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&timezone=auto`,
          );
          const d = await r.json();
          const temp = Math.round(d.current.temperature_2m);
          const code = d.current.weathercode;
          const desc =
            code === 0
              ? "Clear"
              : code <= 3
                ? "Partly cloudy"
                : code <= 48
                  ? "Foggy"
                  : code <= 67
                    ? "Rainy"
                    : "Stormy";
          const icon =
            code === 0
              ? "☀️"
              : code <= 3
                ? "⛅"
                : code <= 48
                  ? "🌫️"
                  : code <= 67
                    ? "🌧️"
                    : "⛈️";
          setWeather({ temp, desc, icon });
          // Fetch ML recommendations with weather context
          loadRecommendations(temp, desc);
        } catch {}
      },
      () => {
        // No GPS - load recommendations with default context
        loadRecommendations(null, null);
      },
    );
  }

  async function loadRecommendations(temp, weatherDesc) {
    try {
      const params = { school_id: user?.school_id };
      if (temp !== null) params.temp = temp;
      if (weatherDesc) params.weather_desc = weatherDesc;
      const { data } = await api.get("/recommendations", { params });
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data);
      }
    } catch {} // Falls back to static pills
  }

  async function loadVendors() {
    try {
      const { data } = await api.get("/vendors", {
        params: { school_id: user?.school_id },
      });
      setVendors(data.vendors || []);
    } catch {}
  }
  async function loadOrders() {
    try {
      const { data } = await api.get("/student/orders");
      setOrders(data.orders || []);
      // Pick the most progressed active order as the tracked one
      // Priority: further along the delivery pipeline wins
      const STATUS_PRIORITY = [
        "on_the_way",
        "picked_up",
        "rider_assigned",
        "ready",
        "preparing",
        "accepted",
        "awaiting_payment",
        "paid",
        "pending_review",
        "pending",
      ];
      const activeOrders = (data.orders || []).filter(
        (o) => !["delivered", "cancelled"].includes(o.status),
      );
      if (activeOrders.length > 0) {
        const best = activeOrders.sort(
          (a, b) =>
            STATUS_PRIORITY.indexOf(a.status) -
            STATUS_PRIORITY.indexOf(b.status),
        )[0];
        setTrackedOrder(best);
      }
    } catch {}
  }
  async function loadFeaturedMenu() {
    try {
      const { data } = await api.get("/featured-menu", {
        params: { school_id: user?.school_id },
      });
      setFeaturedMenu((data.items || []).slice(0, 6));
    } catch {}
  }
  async function openVendor(v) {
    setSelectedVendor(v);
    setMenuLoading(true);
    setTab("home");
    // Packing fee: 200 for food vendors, 0 for bakery/drinks/foodstuff
    const noPackingCats = ["bakery", "foodstuff", "drinks"];
    // Default packing fee based on vendor category; will be recalculated per-cart based on items
    setPackingFee(noPackingCats.includes(v.category) ? 0 : 200);
    try {
      const { data } = await api.get(`/vendors/${v.vendor_id}/menu`);
      setMenu(data.items || []);
    } catch {}
    setMenuLoading(false);
  }
  function addToCart(item, portions) {
    const custom = itemCustomizations[item.menu_id] || {};

    const variantPrice = custom.variant
      ? Number(custom.variant.price)
      : Number(item.price);

    const toppingsTotal = (custom.toppings || []).reduce(
      (s, t) => s + Number(t.price || 0),
      0,
    );

    const finalPrice = variantPrice + toppingsTotal;

    const itemWithCustom = {
      ...item,
      price: Math.round(finalPrice * 100) / 100,
      custom,
    };

    addItem(
      itemWithCustom,
      selectedVendor?.vendor_id,
      selectedVendor?.vendor_name,
      portions,
      itemCustomizations[item.menu_id]?.designNote,
    );

    showToast(
      `Added: ${item.item_name}${
        portions > 1 ? " (" + portions + " portions)" : ""
      }${custom.variant ? " · " + custom.variant.label : ""}`,
    );
  }

  function setItemCustom(menuId, field, value) {
    setItemCustomizations((prev) => ({
      ...prev,
      [menuId]: { ...(prev[menuId] || {}), [field]: value },
    }));
  }

  function toggleTopping(menuId, topping) {
    const current = itemCustomizations[menuId]?.toppings || [];
    const exists = current.find((t) => t.label === topping.label);
    const updated = exists
      ? current.filter((t) => t.label !== topping.label)
      : [...current, topping];
    setItemCustom(menuId, "toppings", updated);
  }
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  // Delivery fee logic:
  // - Foodstuff vendor: flat ₦2000; Ekosodin/bdpa/osasogie: ₦3000
  // - Other vendors: distance-based from ₦600 (close) → ₦700 → ₦1000 → max ₦1500
  //   determined by keywords in the delivery address
  function calcDeliveryFee(vendorCategory, address) {
    const addr = (address || "").toLowerCase();
    if (vendorCategory === "foodstuff") {
      if (/ekosodin|bdpa|osasogie/.test(addr)) return 3000;
      return 2000;
    }
    // Distance-based for other vendors (buka-style)
    if (/ekosodin|bdpa|osasogie/.test(addr)) return 1500;
    if (
      /keystone|hall\s*7|hall\s*6|hall\s*5|medical|law faculty|social sci/.test(
        addr,
      )
    )
      return 1000;
    if (
      /hall\s*[234]|faculty|engineering|1000lt|jhl|library|microfinance/.test(
        addr,
      )
    )
      return 700;
    return 600; // close / default (main gate, home and away, food court, hall 1, akindeko)
  }

  function getDeliveryFeeLabel(vendorCategory) {
    if (vendorCategory === "foodstuff") return "Delivery from ₦2,000";
    return "Delivery from ₦600";
  }

  async function doSearch(q) {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const { data } = await api.get("/search", {
        params: { q, school_id: user?.school_id },
      });
      setSearchResults(data);
    } catch {}
  }

  function openDeliveryModal(vendorId, vendorName) {
    setDeliveryModal({ vendorId, vendorName });
    setDeliveryAddr("");
  }

  function deleteOrder(orderId) {
    setConfirmModal({
      title: "Cancel Order",
      message:
        "Are you sure you want to cancel this order? This cannot be undone.",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/student/orders/${orderId}`);
          setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
          if (trackedOrder?.order_id === orderId) setTrackedOrder(null);
          showToast("Order cancelled");
        } catch (err) {
          setConfirmModal({
            title: "Cannot Delete Order",
            message:
              err.response?.data?.message ||
              "Order cannot be deleted after payment has been made.",
            onConfirm: null,
          });
        }
      },
    });
  }

  function handleFinalPayment(order) {
    // Open delivery modal so student picks location (needed for delivery fee calculation)
    setFinalPaymentOrder(order);
    setDeliveryAddr("");
    setDeliveryModal({
      vendorId: order.vendor_id,
      vendorName: order.vendor_name,
      isFinalPayment: true,
    });
  }

  async function processFinalPayment() {
    if (!finalPaymentOrder) return;
    if (!deliveryAddr.trim()) return;
    setDeliveryModal(null);
    setCheckoutLoading(true);
    try {
      const vendorCat = vendors.find(
        (v) => v.vendor_id === finalPaymentOrder.vendor_id,
      )?.category;
      const computedFee = calcDeliveryFee(vendorCat, deliveryAddr);
      const { data } = await api.post("/orders/initialize-payment", {
        order_id: finalPaymentOrder.order_id,
        delivery_fee: computedFee,
        delivery_address: deliveryAddr.trim(),
      });
      if (data.payment_url) {
        window.location.href = data.payment_url;
      }
    } catch (err) {
      alert("Failed to initialize payment. Please try again.");
    } finally {
      setCheckoutLoading(false);
      setFinalPaymentOrder(null);
    }
  }

  async function handleCheckout(vendorId) {
    const cartArr = getCartArray(vendorId);

    const currentVendor = vendors.find((v) => v.vendor_id === vendorId);
    // Bakery vendors use the design-review flow (not instant payment)
    const supportsCustomDesign = currentVendor?.category === "bakery";

    const bakeryItems = cartArr.filter(
      (item) => (item.design_note || item.designNote || "").trim() !== "",
    );
    const normalItems = cartArr.filter(
      (item) => !(item.design_note || item.designNote || "").trim(),
    );

    if (!cartArr.length) return;
    if (!deliveryAddr.trim()) {
      setConfirmModal({
        title: "Delivery Location Required",
        message: "Please enter your location before paying.",
        onConfirm: null,
      });
      return;
    }

    setDeliveryModal(null);
    setCartOpen(false);
    setCheckoutLoading(true);

    try {
      //If there are bakery items, request review and STOP
      if (supportsCustomDesign && bakeryItems.length > 0) {
        await api.post("/orders/request-review", {
          vendor_id: vendorId,

          items: bakeryItems.map((i) => ({
            menu_id: i.menu_id,
            quantity: i.quantity,
            price: i.price,
            design_note: i.design_note || i.designNote || "",
          })),
          delivery_address: deliveryAddr.trim(),
        });

        clearVendorCart(vendorId);
        await loadOrders(); // pull the new pending_review order immediately
        setSelectedVendor(null); // close vendor menu
        setTab("orders"); // go straight to orders tab — no modal needed
        setCheckoutLoading(false);
        return;

        setCheckoutLoading(false);
        return; // so it doesn't run normal checkout below
      }

      // if there are NO bakery items
      if (normalItems.length > 0) {
        const currentVendorObj = vendors.find((v) => v.vendor_id === vendorId);
        const computedDeliveryFee = calcDeliveryFee(
          currentVendorObj?.category,
          deliveryAddr,
        );
        const { data } = await api.post("/checkout", {
          vendor_id: vendorId,
          cart: normalItems.map((i) => ({
            menu_id: i.menu_id,
            quantity: i.quantity,
            portions: i.portions || 1,
            custom_price: i.price, // price already includes variants/toppings
            design_note: i.design_note || "",
          })),
          delivery_address: deliveryAddr.trim(),
          delivery_fee: computedDeliveryFee,
        });

        clearVendorCart(vendorId);
        window.location.href = data.payment_url;
      }
    } catch (err) {
      setConfirmModal({
        title: "Checkout Failed",
        message: err.response?.data?.message || "Something went wrong.",
        onConfirm: null,
      });
    }
    setCheckoutLoading(false);
  }

  const userLatLng = useRef(null);
  const nearbyMarkers = useRef({});
  const routeLayer = useRef(null);

  useEffect(() => {
    if (tab !== "map") return;
    function initMap() {
      if (leafletMap.current || !mapRef.current) return;
      const L = window.L;
      if (!L) return;
      const map = L.map(mapRef.current, { center: [6.399, 5.6175], zoom: 16 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      leafletMap.current = map;

      // Load ONLY campus locations from DB — no hardcoded fallbacks
      api
        .get("/locations", { params: { school_id: user?.school_id } })
        .then(({ data }) => {
          const locs = (data.locations || []).filter(
            (loc) =>
              loc.latitude &&
              loc.longitude &&
              // Sanity check: must be within UNIBEN bounds (approx)
              loc.latitude > 6.39 &&
              loc.latitude < 6.41 &&
              loc.longitude > 5.6 &&
              loc.longitude < 5.64,
          );
          setNearbyLocations(locs);
          locs.forEach((loc) => {
            const isEatery = loc.category === "eatery";
            const catSvg =
              loc.category === "eatery"
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
                : loc.category === "hostel"
                  ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
                  : loc.category === "faculty"
                    ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>'
                    : loc.category === "sports"
                      ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>'
                      : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
            const icon = L.divIcon({
              html: `<div style="background:${isEatery ? TEAL : "#0d2137"};width:30px;height:30px;border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3)">${catSvg}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              className: "",
            });
            const marker = L.marker(
              [Number(loc.latitude), Number(loc.longitude)],
              { icon },
            )
              .addTo(map)
              .bindPopup(
                `<b>${loc.name}</b><br><small>${loc.description || loc.category}</small>`,
              );
            nearbyMarkers.current[loc.name] = {
              marker,
              lat: Number(loc.latitude),
              lng: Number(loc.longitude),
            };
            marker.on("click", () => {
              if (userLatLng.current)
                drawRoute(
                  map,
                  userLatLng.current,
                  [Number(loc.latitude), Number(loc.longitude)],
                  loc.name,
                );
            });
          });
        });

      // Geolocation — "You are here" marker
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const latlng = [pos.coords.latitude, pos.coords.longitude];
            userLatLng.current = latlng;
            const youIcon = L.divIcon({
              html: `<div style="width:16px;height:16px;background:#0BBFBF;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(11,191,191,.3)"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
              className: "",
            });
            L.marker(latlng, { icon: youIcon })
              .addTo(map)
              .bindPopup("<b>📍 You are here</b><br>Your Location")
              .openPopup();
            map.setView(latlng, 16);
          },
          () => {
            // fallback: place user at UNIBEN centre
            userLatLng.current = [6.399, 5.6175];
            const youIcon = L.divIcon({
              html: `<div style="width:16px;height:16px;background:#0BBFBF;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(11,191,191,.3)"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
              className: "",
            });
            L.marker(userLatLng.current, { icon: youIcon })
              .addTo(map)
              .bindPopup("<b>📍 You are here</b><br>Your Location")
              .openPopup();
          },
        );
      }
      setMapLoaded(true);
    }
    if (window.L) {
      setTimeout(initMap, 100);
      return;
    }
    if (!document.querySelector('link[href*="leaflet"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => setTimeout(initMap, 100);
    document.head.appendChild(s);
  }, [tab]);

  async function drawRoute(map, from, to, name) {
    const L = window.L;
    if (!L || !map) return;
    if (routeLayer.current) {
      map.removeLayer(routeLayer.current);
      routeLayer.current = null;
    }

    const bar = document.getElementById("map-walking-bar");
    const hint = document.getElementById("map-tap-hint");
    if (bar) {
      bar.style.display = "flex";
      bar.querySelector("#route-text").textContent = "Getting route...";
    }
    if (hint) hint.style.display = "none";

    try {
      // Try OSRM for real path geometry
      // const url = `https://router.project-osrm.org/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]) => [
          lat,
          lng,
        ]);
        routeLayer.current = L.polyline(coords, {
          color: TEAL,
          weight: 4,
          opacity: 0.85,
        }).addTo(map);
        // Use actual OSRM route distance for time (83m/min = 5km/h walking)
        const routeDistM = route.distance; // metres along actual path
        const mins = Math.ceil(routeDistM / 83);
        const km = (routeDistM / 1000).toFixed(2);
        if (bar)
          bar.querySelector("#route-text").textContent =
            `${mins} min · ${km} km — to ${name}`;
        map.fitBounds(routeLayer.current.getBounds(), { padding: [30, 30] });
      } else {
        throw new Error("No route");
      }
    } catch {
      // Fallback straight line
      const fromLL = L.latLng(from[0], from[1]);
      const toLL = L.latLng(to[0], to[1]);
      routeLayer.current = L.polyline([fromLL, toLL], {
        color: TEAL,
        weight: 4,
        dashArray: "8,6",
        opacity: 0.85,
      }).addTo(map);
      const dist = fromLL.distanceTo(toLL);
      const mins = Math.ceil((dist * 1.25) / 80);
      const km = ((dist * 1.25) / 1000).toFixed(2);
      if (bar)
        bar.querySelector("#route-text").textContent =
          `~${mins} min · ${km} km — to ${name}`;
      map.fitBounds(routeLayer.current.getBounds(), { padding: [30, 30] });
    }
  }

  function flyToNearby(loc) {
    if (!leafletMap.current) return;
    const entry = nearbyMarkers.current[loc.name];
    const lat = Number(entry?.lat ?? loc.latitude);
    const lng = Number(entry?.lng ?? loc.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    leafletMap.current.flyTo([lat, lng], 18, { duration: 1.2 });
    if (entry?.marker) entry.marker.openPopup();
    if (userLatLng.current)
      drawRoute(leafletMap.current, userLatLng.current, [lat, lng], loc.name);
  }

  const statusLabels = {
    pending: "Pending",
    pending_review: "Reviewing Design",
    paid: "Paid",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready for pickup",
    rider_assigned: "Rider assigned",
    picked_up: "Picked up",
    on_the_way: "On the way!",
    delivered: "Delivered ✓",
    cancelled: "Cancelled",
  };
  const statusColors = {
    pending: "#f59e0b",
    pending_review: "#f59e0b",
    paid: "#3b82f6",
    accepted: "#8b5cf6",
    preparing: "#f97316",
    rider_assigned: "#06b6d4",
    picked_up: "#10b981",
    on_the_way: TEAL,
    delivered: "#22c55e",
    cancelled: "#ef4444",
  };
  const slide = SLIDES[heroIdx];

  const NAV = [
    { id: "home", label: "Home", icon: <IcHome /> },
    { id: "map", label: "Map", icon: <IcMap /> },
    { id: "orders", label: "Orders", icon: <IcOrders /> },
    { id: "profile", label: "Profile", icon: <IcProfile /> },
  ];

  function SideItem({ id, label, icon }) {
    const active = tab === id;
    const activeOrderCount = id === "orders"
      ? orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length
      : 0;
    return (
      <button
        onClick={() => {
          setTab(id);
          setSelectedVendor(null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "11px 14px",
          border: "none",
          borderRadius: 10,
          cursor: "pointer",
          fontFamily: "inherit",
          background: active ? TEAL : dm ? "#21262d" : "transparent",
          color: active ? "#fff" : textSecondary,
          fontWeight: active ? 700 : 500,
          fontSize: 14,
          marginBottom: 2,
          transition: "all .15s",
          position: "relative",
        }}
      >
        <span style={{ opacity: active ? 1 : 0.7, position: "relative" }}>
          {icon}
          {activeOrderCount > 0 && (
            <span style={{
              position: "absolute",
              top: -4,
              right: -6,
              background: "#e74c3c",
              color: "#fff",
              fontSize: 8,
              fontWeight: 800,
              borderRadius: 10,
              minWidth: 14,
              height: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
            }}>
              {activeOrderCount}
            </span>
          )}
        </span>
        {label}
      </button>
    );
  }

  const dm = darkMode;
  const bg = dm ? "#0d1117" : BG;
  const cardBg = dm ? "#161b22" : "#fff";
  const cardBorder = dm ? "rgba(255,255,255,0.07)" : "transparent";
  const textPrimary = dm ? "#e6edf3" : DARK;
  const textSecondary = dm ? "#8b949e" : "#7a90a4";
  const dividerColor = dm ? "#30363d" : "#f0f0f0";
  const inputBg = dm ? "#21262d" : "#fff";
  const inputBorder = dm ? "#30363d" : "#e8ecf0";

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        background: bg,
        position: "relative",
        overflowX: "hidden",
        maxWidth: "100%",
      }}
    >
      {/* SIDEBAR desktop */}
      {!isMobile && (
        <div
          style={{
            width: 200,
            background: cardBg,
            borderRight: `1px solid ${dividerColor}`,
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            padding: "20px 12px",
            display: "flex",
            flexDirection: "column",
            zIndex: 100,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 4px",
              marginBottom: 28,
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
            <span style={{ fontWeight: 900, fontSize: 17, color: textPrimary }}>
              Unimap<span style={{ color: TEAL }}>+</span>
            </span>
          </div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b0bec5",
              letterSpacing: 1,
              margin: "0 4px 8px",
              textTransform: "uppercase",
            }}
          >
            Student
          </p>
          {NAV.map((n) => (
            <SideItem key={n.id} {...n} />
          ))}
        </div>
      )}

      {/* MOBILE DRAWER */}

      {/* MAIN */}
      <div
        style={{
          flex: 1,
          marginLeft: isMobile ? 0 : 200,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          minWidth: 0,
        }}
      >
        {/* TOP BAR */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 200,
            background: cardBg,
            borderBottom: `1px solid ${dividerColor}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            height: 58,
            boxShadow: "0 1px 4px rgba(0,0,0,.05)",
          }}
        >
          {/* Mobile: Unimap+ logo left */}
          {isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                flexShrink: 0,
              }}
              onClick={() => setTab("profile")}
            >
              <img
                src="/logo.png"
                alt="Unimap+"
                style={{ width: 28, height: 28, objectFit: "contain" }}
              />
              <span style={{ fontSize: 13, fontWeight: 900, color: textPrimary }}>
                Unimap<span style={{ color: TEAL }}>+</span>
              </span>
            </div>
          )}
          {/* Desktop: full search bar */}
          {!isMobile && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: inputBg,
                border: `1.5px solid ${inputBorder}`,
                borderRadius: 30,
                padding: "7px 14px",
                maxWidth: 420,
                minWidth: 0,
              }}
            >
              <span style={{ color: "#7a90a4" }}>
                <IcSearch />
              </span>
              <input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  doSearch(e.target.value);
                }}
                placeholder="Search restaurants, food..."
                style={{
                  border: "none",
                  outline: "none",
                  background: "none",
                  fontFamily: "inherit",
                  fontSize: 13,
                  flex: 1,
                  color: textPrimary,
                  minWidth: 0,
                }}
              />
            </div>
          )}

          {/* Right icons */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Mobile: always-visible search bar */}
            {isMobile && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: inputBg,
                  border: `1.5px solid ${inputBorder}`,
                  borderRadius: 30,
                  padding: "6px 12px",
                  flex: 1,
                }}
              >
                <IcSearch />
                <input
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    doSearch(e.target.value);
                  }}
                  placeholder="Search food..."
                  style={{
                    border: "none",
                    outline: "none",
                    background: "none",
                    fontFamily: "inherit",
                    fontSize: 13,
                    flex: 1,
                    color: textPrimary,
                    minWidth: 0,
                  }}
                />
                {searchQ.length > 0 && (
                  <button
                    onClick={() => {
                      setSearchQ("");
                      setSearchResults(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: textSecondary,
                      fontSize: 16,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* Cart */}
            <button
              onClick={() => setCartOpen(true)}
              style={{
                position: "relative",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: textPrimary,
                padding: 4,
              }}
            >
              <IcCart />
              {cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    background: "#e74c3c",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    width: 15,
                    height: 15,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Desktop: profile pill + logout */}
            {!isMobile && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: bg,
                    border: "1.5px solid #e8ecf0",
                    borderRadius: 30,
                    padding: "5px 12px 5px 6px",
                    cursor: "pointer",
                  }}
                  onClick={() => setTab("profile")}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: TEAL,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {user?.fullname?.[0]?.toUpperCase() || "S"}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: DARK }}>
                    {user?.fullname?.split(" ")[0] || "Student"}
                  </span>
                  <span style={{ fontSize: 10, color: "#7a90a4" }}>▾</span>
                </div>
                <button
                  onClick={logout}
                  style={{
                    background: "#fff0f0",
                    color: "#e74c3c",
                    border: "none",
                    borderRadius: 20,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>

        {/* SEARCH DROPDOWN */}
        {searchResults && searchQ && (
          <div
            style={{
              position: "fixed",
              top: 58,
              left: isMobile ? 0 : 200,
              right: 0,
              background: cardBg,
              zIndex: 300,
              borderBottom: `1px solid ${dividerColor}`,
              boxShadow: "0 8px 24px rgba(0,0,0,.1)",
              maxHeight: 360,
              overflowY: "auto",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Results for "{searchQ}"
              </span>
              <button
                onClick={() => {
                  setSearchResults(null);
                  setSearchQ("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  color: textSecondary,
                }}
              >
                ×
              </button>
            </div>
            {[
              ...(searchResults.vendors || []).map((v) => ({
                name: v.vendor_name,
                sub: v.is_open ? "✅ Open" : "❌ Closed",
                emoji: <Store size={16} />,
                action: () => {
                  openVendor(v);
                  setSearchResults(null);
                  setSearchQ("");
                },
              })),
              ...(searchResults.foods || []).map((f) => ({
                name: f.item_name,
                sub: `${f.vendor_name} · ₦${f.price}`,
                img: f.image_url,
                action: () => {
                  openVendor({
                    vendor_id: f.vendor_id,
                    vendor_name: f.vendor_name,
                  });
                  setSearchResults(null);
                  setSearchQ("");
                },
              })),
            ].map((r, i) => (
              <div
                key={i}
                onClick={r.action}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 8px",
                  borderRadius: 10,
                  cursor: "pointer",
                  marginBottom: 4,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f5f6fa")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {r.img ? (
                  <img
                    src={r.img}
                    alt=""
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 22 }}>{r.emoji}</span>
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "#7a90a4" }}>{r.sub}</div>
                </div>
                <span style={{ marginLeft: "auto", color: "#7a90a4" }}>
                  <IcChevron />
                </span>
              </div>
            ))}
            {!searchResults.vendors?.length && !searchResults.foods?.length && (
              <p
                style={{
                  textAlign: "center",
                  color: textSecondary,
                  padding: "20px 0",
                  fontSize: 13,
                }}
              >
                No results found
              </p>
            )}
          </div>
        )}

        {/* PAGE CONTENT */}
        <div
          style={{
            flex: 1,
            padding: isMobile ? "16px 14px 90px" : "24px 28px 40px",
            maxWidth: isMobile ? "100%" : 1100,
            width: "100%",
            boxSizing: "border-box",
            overflowX: "hidden",
            minWidth: 0,
            margin: "0 auto",
          }}
        >
          {/* HOME */}
          {tab === "home" && !selectedVendor && (
            <>


              {/* HERO */}
              <div
                onClick={() => handleHeroClick(slide)} // 
                  style={{
                  cursor: "pointer", 
                  borderRadius: 18,
                  overflow: "hidden",
                  marginBottom: 20,
                  position: "relative",
                  height: isMobile ? 80 : 90,
                  background: heroIdx === 1
                    ? "linear-gradient(135deg, #0BBFBF 0%, #055a5a 100%)"
                    : slide.bg,
                  display: "flex",
                  alignItems: "flex-start",
                  padding:
                  heroIdx === 0 || heroIdx === 1
                    ? "6px 24px 16px"
                  : "10px 24px",
                  transition: "background .4s",
                  boxShadow: heroIdx === 0 ? "0 2px 12px rgba(230,126,34,0.15)" : heroIdx === 1 ? "0 2px 12px rgba(11,191,191,0.25)" : "0 2px 8px rgba(0,0,0,0.06)",
                  border: "none",
                }}
              >
                {/* Text content — capped width so it never overlaps decorations */}
                <div style={{ 
                  zIndex: 2, 
                  flex: 1, 
                  maxWidth: "60%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 2
                }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 1,
                      color: heroIdx === 0 ? "rgba(13,33,55,0.7)" : heroIdx === 1 ? "rgba(255,255,255,0.95)" : slide.accent,
                      background:
                        heroIdx === 0
                          ? "#fff3e8"
                          : heroIdx === 2
                          ? `${slide.accent}22`
                          : `rgba(255,255,255,0.18)`,
                      padding: "2px 8px",
                      borderRadius: 20,
                      textTransform: "uppercase",
                    }}
                  >
                    {slide.tag}
                  </span>
                  {/* <h2
                    style={{
                      margin: "3px 0 1px",
                      color: heroIdx === 0 ? "#E67E22" : heroIdx === 2 ? "#0d2137" : "#fff",
                      fontSize: isMobile ? 13 : 16,
                      fontWeight: 900,
                      lineHeight: 1.15,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {slide.title}
                  </h2> */}

                  <h2
                    style={{
                      margin: "3px 0 1px",
                      color:
                        heroIdx === 0
                          ? "#0d2137"
                          : heroIdx === 2
                          ? "#0d2137"
                          : "#fff",
                      fontSize: isMobile ? 13 : 16,
                      fontWeight: 900,
                      lineHeight: 1.15,
                      whiteSpace: "pre-line",
                    }}
                  >
                    <span
                      style={{
                        fontSize: isMobile ? 18 : 22,
                        display: "block",
                      }}
                    >
                      {slide.highlight}
                    </span>
                    {slide.headline}
                  </h2>
                  <p
                    style={{
                      margin: "0 0 4px",
                      lineHeight: 1.2,
                      color:
                        heroIdx === 0
                          ? "rgba(13,33,55,0.7)"
                          : heroIdx === 2
                          ? "rgba(13,33,55,0.7)"
                          : "rgba(255,255,255,.85)",
                      fontSize: 9,
                    }}
                  >
                    {slide.sub}
                  </p>
                  <button
                    style={{
                      background: heroIdx === 0 ? "#E67E22" : heroIdx === 2 ? "#0d2137" : "rgba(255,255,255,0.18)",
                      color: heroIdx === 2 ? "#fff" : heroIdx === 0 ? "#fff" : "#fff",
                      border: heroIdx === 1 ? "1px solid rgba(255,255,255,0.35)" : "none",
                      borderRadius: 20,
                      padding: "3px 10px",
                      lineHeight: 1,
                      fontWeight: 700,
                      fontSize: 9,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      backdropFilter: heroIdx === 1 ? "blur(4px)" : "none",
                      display: "none"
                    }}
                  >
                    {slide.cta}
                  </button>
                </div>

                {/* Right-side decoration */}
                {heroIdx === 0 ? (
                  <img
                    src="/burger.png"
                    alt="burger"
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      height: isMobile ? "95%" : "100%",
                      objectFit: "contain",
                      objectPosition: "bottom right",
                      filter: "drop-shadow(-4px 0 8px rgba(0,0,0,0.15))",
                    }}
                  />
                ) : heroIdx === 1 ? (
                  /* Slide 2 teal: two overlapping circles */
                  <>
                    <div
                      style={{
                        position: "absolute",
                        top: "-20%",
                        right: "-2%",
                        width: isMobile ? 70 : 90,
                        height: isMobile ? 70 : 90,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.13)",
                        zIndex: 1,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "-20%",
                        right: "15%",
                        width: isMobile ? 42 : 52,
                        height: isMobile ? 42 : 52,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.09)",
                        zIndex: 1,
                      }}
                    />
                  </>
                ) : (
                  /* Slide 3 mint: grey circle + ofada rice image overlapping it */
                  <>
                    <div
                      style={{
                        position: "absolute",
                        right: isMobile ? 10 : 18,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: isMobile ? 68 : 82,
                        height: isMobile ? 68 : 82,
                        borderRadius: "50%",
                        background: "rgba(10,122,122,0.18)",
                        zIndex: 1,
                      }}
                    />
                    <img
                      src={`data:image/jpeg;base64,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`}
                      alt="Ofada Rice"
                      style={{
                        position: "absolute",
                        right: isMobile ? 2 : 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: isMobile ? 72 : 86,
                        height: isMobile ? 72 : 86,
                        borderRadius: "50%",
                        objectFit: "cover",
                        zIndex: 2,
                        boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
                      }}
                    />
                  </>
                )}

                {/* Arrow CTA */}
                <div
                  style={{
                    position: "absolute",
                    right: isMobile ? 10 : 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 4,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <span style={{ fontSize: 14, color: "#fff", fontWeight: 800 }}>
                    ›
                  </span>
                </div>

                {/* Slide dots */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 7,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 5,
                    zIndex: 3,
                  }}
                >
                  {SLIDES.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setHeroIdx(i)}
                      style={{
                        width: i === heroIdx ? 18 : 6,
                        height: 6,
                        borderRadius: 3,
                        background:
                          i === heroIdx
                            ? heroIdx === 0
                              ? "#E67E22"
                              : heroIdx === 2
                              ? "#0d2137"
                              : "#fff"
                            : heroIdx === 0
                              ? "rgba(230,126,34,0.3)"
                              : heroIdx === 2
                              ? "rgba(13,33,55,0.3)"
                              : "rgba(255,255,255,.4)",
                        cursor: "pointer",
                        transition: "all .3s",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* AI PICK - with real weather */}
              <div
                style={{
                  background: dm ? cardBg : "rgba(255,255,255,0.75)",
                  backdropFilter: "blur(12px)",
                  borderRadius: 16,
                  padding: "14px 18px",
                  marginBottom: 24,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      background: TEAL,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 9px",
                      borderRadius: 20,
                      letterSpacing: 0.5,
                    }}
                  >
                    AI Pick
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: textSecondary,
                      background: dm ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
                      padding: "4px 11px",
                      borderRadius: 20,
                    }}
                  >
                    {weather
                      ? `${weather.icon} ${weather.temp}°C · ${weather.desc}`
                      : "🌡️ Getting weather..."}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: textSecondary,
                    margin: "0 0 6px",
                  }}
                >
                  Food for today's weather
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: textPrimary,
                    margin: "0 0 12px",
                    lineHeight: 1.5,
                  }}
                >
                  {(() => {
                    const h = new Date().getHours();
                    const t = weather?.temp;
                    const d = weather?.desc || "";
                    if (d.includes("Rain") || d.includes("Storm"))
                      return "Rainy day on campus 🌧️ — stay in, order hot pepper soup or ofe onugbu. Warm and comforting.";
                    if (t >= 34)
                      return h < 12
                        ? "Already scorching this morning ☀️ — start with something cold. Zobo or chilled drinks are calling."
                        : h < 17
                          ? "Afternoon heat is real 🥵 — cold drinks, light snacks, or a chilled shawarma. Stay refreshed."
                          : "Warm evening today 🌇 — order something to keep you cool. Zobo, cold drinks, or light bites.";
                    if (t >= 30)
                      return h < 12
                        ? "Warm morning ahead ☀️ — grab something light before lectures. Snacks or a quick bite works."
                        : h < 17
                          ? "It's warm out there 🌤️ — a cold drink with your meal hits differently right now."
                          : "Nice warm evening 🌆 — perfect time for a full meal. Jollof, soups, or your favourite buka food.";
                    if (t >= 25)
                      return h < 12
                        ? "Cool morning vibes ⛅ — fuel up before the day gets busy. Breakfast or a quick snack?"
                        : h < 17
                          ? "Good afternoon weather for a proper meal 🍽️ — treat yourself between classes."
                          : "Cool evening on campus 🌙 — great time to order your favourite comfort food.";
                    return h < 12
                      ? "Fresh morning 🌿 — start your day right with something filling."
                      : h < 17
                        ? "Good weather for a nice meal. Pick something hearty!"
                        : "Cool night ahead 🌙 — warm food hits different. Soups, stews, or a hot plate of rice.";
                  })()}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {recommendations?.recommendations?.length > 0
                    ? recommendations.recommendations.map((rec) => (
                        <button
                          key={rec.menu_id}
                          onClick={() =>
                            openVendor({
                              vendor_id: rec.vendor_id,
                              vendor_name: rec.vendor_name,
                            })
                          }
                          style={{
                            background: "rgba(11,191,191,.1)",
                            border: "1px solid rgba(11,191,191,.35)",
                            borderRadius: 20,
                            padding: "5px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#089898",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {rec.is_personal && (
                            <span style={{ fontSize: 9 }}>🤍</span>
                          )}
                          +{rec.item_name} — ₦
                          {Number(rec.price).toLocaleString()}
                        </button>
                      ))
                    : [
                        "+Zobo Drink — ₦300",
                        "+Chicken Shawarma — ₦3000",
                        "+Club Sandwich — ₦600",
                      ].map((r) => (
                        <button
                          key={r}
                          onClick={async () => {
                            const q = r
                              .replace(/^[+]/, "")
                              .split("—")[0]
                              .trim();
                            try {
                              const { data } = await api.get("/search", {
                                params: { q, school_id: user?.school_id },
                              });
                              if (data.foods?.length > 0) {
                                const f = data.foods[0];
                                await openVendor({
                                  vendor_id: f.vendor_id,
                                  vendor_name: f.vendor_name,
                                });
                              } else if (data.vendors?.length > 0) {
                                await openVendor(data.vendors[0]);
                              } else {
                                setSearchQ(q);
                                doSearch(q);
                              }
                            } catch {
                              setSearchQ(q);
                              doSearch(q);
                            }
                          }}
                          style={{
                            background: "rgba(11,191,191,.15)",
                            border: "1px solid rgba(11,191,191,.3)",
                            borderRadius: 20,
                            padding: "5px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#7ee8e8",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {r}
                        </button>
                      ))}
                </div>
              </div>

              {/* POPULAR VENDORS */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 800,
                    color: textPrimary,
                  }}
                >
                  Popular Vendors
                </h3>
                {vendors.length > 7 && (
                  <button
                    onClick={() => setShowAllVendors((v) => !v)}
                    style={{
                      background: showAllVendors ? TEAL : "none",
                      border: `1.5px solid ${TEAL}`,
                      borderRadius: 20,
                      padding: "4px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: showAllVendors ? "#fff" : TEAL,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all .2s",
                    }}
                  >
                    {showAllVendors
                      ? "Show less ↑"
                      : `+${vendors.length - 7} more ↓`}
                  </button>
                )}
              </div>

              {vendors.length === 0 ? (
                <p style={{ fontSize: 13, color: textSecondary, marginBottom: 24 }}>
                  No vendors yet for your school.
                </p>
              ) : showAllVendors ? (
                // EXPANDED: responsive grid
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? window.innerWidth < 400
                        ? "repeat(2, 1fr)"
                        : "repeat(3, 1fr)"
                      : "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  {vendors.map((v) => (
                    <div
                      key={v.vendor_id}
                      onClick={() => openVendor(v)}
                      style={{
                        height: isMobile ? 110 : 140,
                        borderRadius: 16,
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                        background: v.logo_url
                          ? "#fff"
                          : getVendorColor(v.vendor_name),
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        padding: "10px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        transition: "transform .15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "translateY(-2px)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "translateY(0)")
                      }
                    >
                      {v.logo_url && (
                        <img
                          src={v.logo_url}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            opacity: 0.9,
                          }}
                          alt=""
                        />
                      )}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                          zIndex: 1,
                        }}
                      />
                      <div style={{ position: "relative", zIndex: 2 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: isMobile ? 11 : 13,
                            color: "#fff",
                            marginBottom: 3,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {v.vendor_name}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "rgba(255,255,255,0.9)",
                            background: "rgba(0,0,0,0.3)",
                            padding: "2px 5px",
                            borderRadius: 10,
                            display: "inline-block",
                          }}
                        >
                          {CAT_LABELS[v.category] || "🍽️ Food"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // COLLAPSED: horizontal scroll, max 7
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    overflowX: "auto",
                    paddingBottom: 8,
                    marginBottom: 24,
                    scrollbarWidth: "none",
                  }}
                >
                  {vendors.slice(0, 7).map((v) => (
                    <div
                      key={v.vendor_id}
                      onClick={() => openVendor(v)}
                      style={{
                        flexShrink: 0,
                        width: isMobile ? 120 : 140,
                        height: isMobile ? 120 : 140,
                        borderRadius: 16,
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                        background: v.logo_url
                          ? "#fff"
                          : getVendorColor(v.vendor_name),
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        padding: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        transition: "transform .15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "translateY(-2px)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "translateY(0)")
                      }
                    >
                      {v.logo_url && (
                        <img
                          src={v.logo_url}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            opacity: 0.9,
                          }}
                          alt=""
                        />
                      )}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                          zIndex: 1,
                        }}
                      />
                      <div style={{ position: "relative", zIndex: 2 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 13,
                            color: "#fff",
                            marginBottom: 4,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {v.vendor_name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.9)",
                            background: "rgba(0,0,0,0.3)",
                            padding: "2px 6px",
                            borderRadius: 10,
                            display: "inline-block",
                          }}
                        >
                          {CAT_LABELS[v.category] || "🍽️ Food"}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "rgba(255,255,255,0.75)",
                            marginTop: 2,
                          }}
                        >
                          <Bike size={12} /> {getDeliveryFeeLabel(v.category)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* FEATURED MENU - real data */}
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 15,
                  fontWeight: 800,
                  color: textPrimary,
                }}
              >
                Featured Menu
              </h3>
              {featuredMenu.length === 0 ? (
                <div
                  style={{
                    background: cardBg,
                    borderRadius: 14,
                    padding: "32px 20px",
                    textAlign: "center",
                    color: textSecondary,
                    boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>
                    <Utensils size={36} style={{ color: "#7a90a4" }} />
                  </div>
                  <p style={{ fontSize: 13, margin: 0 }}>
                    No menu items yet. Vendors will add items soon!
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)",
                    gap: 12,
                  }}
                >
                  {featuredMenu.map((item, i) => (
                    <div
                      key={item.menu_id}
                      style={{
                        background: cardBg,
                        borderRadius: 14,
                        overflow: "hidden",
                        boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                        cursor: "pointer",
                        transition: "box-shadow .15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.boxShadow =
                          "0 4px 16px rgba(0,0,0,.1)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.boxShadow =
                          "0 1px 4px rgba(0,0,0,.05)")
                      }
                      onClick={() =>
                        openVendor({
                          vendor_id: item.vendor_id,
                          vendor_name: item.vendor_name,
                          category: item.category,
                        })
                      }
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          style={{
                            width: "100%",
                            height: 110,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            height: 110,
                            background: `linear-gradient(135deg,${["#1a4a3a", "#2d1a4a", "#4a2a0a", "#1a2a4a", "#3a1a1a", "#1a3a2a"][i % 6]},#0d2137)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 36,
                          }}
                        >
                          {CAT_LABELS[item.category]?.split(" ")[0] || (
                            <Store size={18} style={{ color: "#fff" }} />
                          )}
                        </div>
                      )}
                      <div style={{ padding: "10px 12px" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: textPrimary,
                            marginBottom: 2,
                          }}
                        >
                          {item.item_name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: textSecondary,
                            marginBottom: 6,
                          }}
                        >
                          {item.vendor_name}
                          {item.prep_time ? ` · ⏱ ${item.prep_time} min` : ""}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              color: TEAL,
                            }}
                          >
                            ₦{Number(item.price).toLocaleString()}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addItem(
                                {
                                  menu_id: item.menu_id,
                                  item_name: item.item_name,
                                  price: item.price,
                                },
                                item.vendor_id,
                                item.vendor_name,
                              );
                              showToast(`Added: ${item.item_name}`);
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: TEAL,
                              border: "none",
                              cursor: "pointer",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 18,
                              fontWeight: 700,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* VENDOR MENU */}
          {tab === "home" && selectedVendor && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: selectedVendor.is_open ? 20 : 12,
                }}
              >
                <button
                  onClick={() => setSelectedVendor(null)}
                  style={{
                    background: cardBg,
                    border: "1.5px solid #e8ecf0",
                    borderRadius: 10,
                    width: 36,
                    height: 36,
                    cursor: "pointer",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ←
                </button>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      color: textPrimary,
                    }}
                  >
                    {selectedVendor.vendor_name}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 3,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, color: "#7a90a4" }}>
                      {selectedVendor.is_open ? " Open" : " Closed"} · ⭐{" "}
                      {selectedVendor.rating
                        ? Number(selectedVendor.rating).toFixed(1)
                        : "New"}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                        marginTop: 2,
                      }}
                    >
                      {selectedVendor.category && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 20,
                            background: "#e6fafa",
                            color: TEAL,
                          }}
                        >
                          {CAT_LABELS[selectedVendor.category] ||
                            selectedVendor.category}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: "#f0fafa",
                          color: "#089898",
                        }}
                      >
                        {getDeliveryFeeLabel(selectedVendor.category)}
                      </span>
                    </div>
                    {selectedVendor.location_name && (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: textSecondary,
                        }}
                      >
                        {selectedVendor.location_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* BAKERY NOTICE */}
              {selectedVendor.category === "bakery" && (
                <div
                  style={{
                    background: "#fff8e1",
                    border: "1px solid #f5c518",
                    borderRadius: 12,
                    padding: "10px 14px",
                    marginBottom: 16,
                    fontSize: 12,
                    color: "#92400e",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 16 }}>💡</span>
                  <span>
                    Note: Items with added descriptions may have prices updated
                    by the vendor after review. You will be notified before
                    making payment.
                  </span>
                </div>
              )}

              {!selectedVendor.is_open && (
                <div
                  style={{
                    background: "#fff3cd",
                    border: "1px solid #ffc107",
                    borderRadius: 12,
                    padding: "12px 16px",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Lock size={20} style={{ color: "#856404" }} />
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#856404",
                      }}
                    >
                      This eatery is currently closed
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#856404", marginTop: 2 }}
                    >
                      You can browse the menu but ordering is disabled until
                      they open.
                    </div>
                  </div>
                </div>
              )}
              {menuLoading ? (
                <p
                  style={{ color: textSecondary, textAlign: "center", padding: 40 }}
                >
                  Loading menu...
                </p>
              ) : menu.length === 0 ? (
                <p
                  style={{ color: textSecondary, textAlign: "center", padding: 40 }}
                >
                  No menu items yet.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? "1fr"
                      : "repeat(auto-fill,minmax(280px,1fr))",
                    gap: 12,
                  }}
                >
                  {menu.map((item) => {
                    const parseData = (val) => {
                      if (!val) return [];
                      if (Array.isArray(val)) return val;
                      try {
                        return typeof val === "string"
                          ? JSON.parse(val)
                          : val || [];
                      } catch (e) {
                        return [];
                      }
                    };

                    const itemToppings = parseData(item.toppings);
                    const itemVariants = parseData(item.variants);
                    const hasCustomizations =
                      itemVariants.length > 0 ||
                      itemToppings.length > 0 ||
                      item.allow_design_notes == 1;
                    const qty =
                      carts[selectedVendor?.vendor_id]?.items[item.menu_id]
                        ?.quantity || 0;
                    return (
                      <div
                        key={item.menu_id}
                        style={{
                          background: cardBg,
                          borderRadius: 14,
                          padding: 14,
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                        }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.item_name}
                            style={{
                              width: 72,
                              height: 72,
                              borderRadius: 12,
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 72,
                              height: 72,
                              borderRadius: 12,
                              background: "#f0fafa",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 30,
                              flexShrink: 0,
                            }}
                          >
                            <Utensils size={30} style={{ color: "#7a90a4" }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: textPrimary,
                              marginBottom: 2,
                            }}
                          >
                            {item.item_name}
                          </div>
                          {/* Show description for bakery vendors */}
                          {selectedVendor.category === "bakery" &&
                            item.description && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#92400e",
                                  background: "#fff8e1",
                                  border: "1px solid #f5c518",
                                  borderRadius: 7,
                                  padding: "3px 8px",
                                  marginBottom: 4,
                                  lineHeight: 1.4,
                                }}
                              >
                                {item.description}
                              </div>
                            )}
                          <div
                            style={{
                              fontSize: 11,
                              color: textSecondary,
                              marginBottom: 4,
                            }}
                          >
                            {selectedVendor.vendor_name} · ⏱{" "}
                            {(() => {
                              if (!item.prep_time) return "15 min";
                              if (item.prep_time_unit === "days") {
                                const d = Math.round(
                                  item.prep_time / (60 * 24),
                                );
                                return `${d} day${d > 1 ? "s" : ""}`;
                              }
                              return `${item.prep_time} min`;
                            })()}
                          </div>

                          {/* FOODSTUFF: Variant picker */}
                          {(() => {
                            const variants = Array.isArray(item.variants)
                              ? item.variants
                              : (() => {
                                  try {
                                    return JSON.parse(item.variants || "[]");
                                  } catch {
                                    return [];
                                  }
                                })();

                            if (variants.length > 0)
                              return (
                                <select
                                  value={
                                    itemCustomizations[item.menu_id]?.variant
                                      ?.label || ""
                                  }
                                  onChange={(e) => {
                                    const v = variants.find(
                                      (v) => v.label === e.target.value,
                                    );
                                    setItemCustom(
                                      item.menu_id,
                                      "variant",
                                      v || null,
                                    );
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "5px 8px",
                                    border: `1px solid ${TEAL}55`,
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontFamily: "inherit",
                                    marginBottom: 4,
                                    color: textPrimary,
                                  }}
                                >
                                  <option value="">Select quantity...</option>
                                  {variants.map((v) => (
                                    <option key={v.label} value={v.label}>
                                      {v.label} — ₦
                                      {Number(v.price).toLocaleString()}
                                    </option>
                                  ))}
                                </select>
                              );
                            return null;
                          })()}

                          {/* TOPPINGS (Used by Bakery and others) */}
                          {(() => {
                            const toppings = Array.isArray(item.toppings)
                              ? item.toppings
                              : (() => {
                                  try {
                                    return JSON.parse(item.toppings || "[]");
                                  } catch {
                                    return [];
                                  }
                                })();

                            if (toppings.length > 0)
                              return (
                                <div style={{ marginBottom: 4 }}>
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: textSecondary,
                                      marginBottom: 3,
                                    }}
                                  >
                                    Toppings:
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 4,
                                    }}
                                  >
                                    {toppings.map((t) => {
                                      const selected = (
                                        itemCustomizations[item.menu_id]
                                          ?.toppings || []
                                      ).find((x) => x.label === t.label);
                                      return (
                                        <span
                                          key={t.label}
                                          onClick={() =>
                                            toggleTopping(item.menu_id, t)
                                          }
                                          style={{
                                            fontSize: 10,
                                            padding: "2px 8px",
                                            borderRadius: 20,
                                            cursor: "pointer",
                                            border: `1px solid ${selected ? TEAL : "#dde8e8"}`,
                                            background: selected
                                              ? TEAL
                                              : "#fff",
                                            color: selected ? "#fff" : DARK,
                                            fontWeight: selected ? 700 : 400,
                                          }}
                                        >
                                          {t.label}
                                          {t.price > 0 ? ` +₦${t.price}` : ""}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            return null;
                          })()}

                          {/* BAKERY: Design notes */}
                          {item.allow_design_notes == 1 && (
                            <input
                              type="text"
                              placeholder="Describe your cake design (optional)..."
                              value={
                                itemCustomizations[item.menu_id]?.designNote ||
                                ""
                              }
                              onChange={(e) => {
                                setItemCustom(
                                  item.menu_id,
                                  "designNote",
                                  e.target.value,
                                );
                                setDesignNote(
                                  item.menu_id,
                                  selectedVendor?.vendor_id,
                                  e.target.value,
                                );
                              }}
                              style={{
                                width: "100%",
                                padding: "5px 8px",
                                border: `1px solid ${dividerColor}`,
                                borderRadius: 8,
                                fontSize: 11,
                                fontFamily: "inherit",
                                marginBottom: 4,
                                boxSizing: "border-box",
                              }}
                            />
                          )}

                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 15,
                              color: TEAL,
                            }}
                          >
                            {(() => {
                              const parsedVars = (() => {
                                if (
                                  Array.isArray(item.variants) &&
                                  item.variants.length > 0
                                )
                                  return item.variants;
                                try {
                                  const p = JSON.parse(item.variants || "[]");
                                  return Array.isArray(p) ? p : [];
                                } catch {
                                  return [];
                                }
                              })();
                              const custom =
                                itemCustomizations[item.menu_id] || {};
                              const selectedVariant = custom.variant;
                              const base =
                                parsedVars.length > 0
                                  ? selectedVariant
                                    ? Number(selectedVariant.price)
                                    : null
                                  : null;
                              const extras = (custom.toppings || []).reduce(
                                (s, t) => s + Number(t.price || 0),
                                0,
                              );
                              // HANDLE price_label FIRST (bakery range case)
                              if (
                                !parsedVars.length &&
                                item.price_label &&
                                item.price_label.includes("-")
                              ) {
                                const [min, max] = item.price_label
                                  .split("-")
                                  .map(Number);
                                return `₦${min.toLocaleString()} – ₦${max.toLocaleString()}`;
                              }

                              // existing variant range logic
                              if (parsedVars.length > 0 && base === null) {
                                const prices = parsedVars.map((v) =>
                                  Number(v.price),
                                );
                                const minP = Math.min(...prices);
                                const maxP = Math.max(...prices);
                                return minP === maxP
                                  ? `₦${minP.toLocaleString()}`
                                  : `₦${minP.toLocaleString()} – ₦${maxP.toLocaleString()}`;
                              }

                              // fallback to normal price
                              return `₦${Number((Number(item.price) || 0) + extras).toLocaleString()}`;
                            })()}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          {!selectedVendor?.is_open ? (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#856404",
                                background: "#fff3cd",
                                padding: "4px 8px",
                                borderRadius: 8,
                                fontWeight: 600,
                              }}
                            >
                              Closed
                            </span>
                          ) : qty > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <button
                                onClick={() =>
                                  removeItem(
                                    item.menu_id,
                                    selectedVendor?.vendor_id,
                                  )
                                }
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  border: "none",
                                  background: "#f0fafa",
                                  cursor: "pointer",
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: TEAL,
                                }}
                              >
                                -
                              </button>
                              <span
                                style={{
                                  fontWeight: 700,
                                  minWidth: 16,
                                  textAlign: "center",
                                  fontSize: 14,
                                }}
                              >
                                {qty}
                              </span>
                              <button
                                onClick={() => addToCart(item)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  border: "none",
                                  background: TEAL,
                                  cursor: "pointer",
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: "#fff",
                                }}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                border: "none",
                                background: TEAL,
                                cursor: "pointer",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IcPlus />
                            </button>
                          )}
                          {qty > 0 &&
                            item.item_type !== "drink" &&
                            !hasCustomizations && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <span style={{ fontSize: 9, color: "#7a90a4" }}>
                                  portions:
                                </span>
                                <select
                                  value={
                                    carts[selectedVendor?.vendor_id]?.items[
                                      item.menu_id
                                    ]?.portions || 1
                                  }
                                  onChange={(e) =>
                                    setPortions(
                                      item.menu_id,
                                      selectedVendor?.vendor_id,
                                      Number(e.target.value),
                                    )
                                  }
                                  style={{
                                    fontSize: 11,
                                    border: `1px solid ${TEAL}55`,
                                    borderRadius: 6,
                                    padding: "1px 3px",
                                    fontFamily: "inherit",
                                    background: "#f0fafa",
                                    color: TEAL,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {[1, 2, 3].map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* MAP */}
          {tab === "map" && (
            <>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 20,
                  fontWeight: 800,
                  color: textPrimary,
                }}
              >
                📍 Campus Map
              </h2>
              <div
                style={{
                  background: cardBg,
                  borderRadius: 14,
                  padding: "10px 14px",
                  marginBottom: 14,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                }}
              >
                <IcSearch />
                <input
                  placeholder="Where to on campus?"
                  onChange={(e) => doSearch(e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: textPrimary,
                  }}
                />
                <button
                  style={{
                    background: TEAL,
                    color: "#fff",
                    border: "none",
                    borderRadius: 20,
                    padding: "7px 18px",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Search
                </button>
              </div>
              <div
                ref={mapRef}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  height: isMobile ? 280 : 340,
                  background: "#e8f4f4",
                  marginBottom: 16,
                  border: "1px solid #e0f0f0",
                }}
              >
                {!mapLoaded && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: textSecondary,
                      fontSize: 14,
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        border: "3px solid #e8ecf0",
                        borderTopColor: TEAL,
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Loading map...
                  </div>
                )}
              </div>
              {/* Route result bar */}
              <div
                id="map-walking-bar"
                style={{
                  display: "none",
                  background: "#e6fafa",
                  border: `1px solid ${TEAL}33`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  marginBottom: 8,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: TEAL, fontSize: 14 }}>🚶</span>
                <span
                  id="route-text"
                  style={{
                    fontSize: 12,
                    color: "#089898",
                    fontWeight: 700,
                    flex: 1,
                  }}
                ></span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: TEAL,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: TEAL,
                      display: "inline-block",
                    }}
                  />
                  Walking
                </span>
              </div>
              {/* Default hint */}
              <div
                id="map-tap-hint"
                style={{
                  background: "#e6fafa",
                  border: `1px solid ${TEAL}33`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: TEAL, fontSize: 13 }}>👣</span>
                <span
                  style={{ fontSize: 12, color: "#089898", fontWeight: 600 }}
                >
                  Tap any location to get walking time
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: TEAL,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: TEAL,
                      display: "inline-block",
                    }}
                  />
                  Walking
                </span>
              </div>
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 15,
                  fontWeight: 800,
                  color: textPrimary,
                }}
              >
                Nearby Locations
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
                  gap: 10,
                }}
              >
                {(nearbyLocations.length > 0 ? nearbyLocations : []).map(
                  (loc) => (
                    <div
                      key={loc.id || loc.name}
                      onClick={() => flyToNearby(loc)}
                      style={{
                        background: cardBg,
                        borderRadius: 12,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,.05)",
                        transition: "box-shadow .15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.boxShadow =
                          "0 4px 12px rgba(0,0,0,.1)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.boxShadow =
                          "0 1px 3px rgba(0,0,0,.05)")
                      }
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "#f0fafa",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 14,
                        }}
                      >
                        {loc.category === "eatery" ? (
                          <Store size={16} />
                        ) : loc.category === "hostel" ? (
                          <Home size={16} />
                        ) : loc.category === "sports" ? (
                          <Football size={16} />
                        ) : (
                          <MapPin size={16} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: textPrimary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {loc.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#7a90a4" }}>
                          {loc.description || loc.category} · Tap to navigate
                        </div>
                      </div>
                      <IcChevron />
                    </div>
                  ),
                )}
              </div>
            </>
          )}

          {/* ORDERS */}
          {tab === "orders" && (
            <>
              <h2
                style={{
                  margin: "0 0 20px",
                  fontSize: 20,
                  fontWeight: 800,
                  color: textPrimary,
                }}
              >
                Your Orders
              </h2>

              {/* ── show all ACTIVE ORDERS */}
              {orders
                .filter((o) => !["delivered", "cancelled"].includes(o.status))
                .map((activeOrder) => (
                  <div
                    key={activeOrder.order_id}
                    style={{
                      background: cardBg,
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 20,
                      boxShadow: "0 2px 12px rgba(0,0,0,.07)",
                      border: `1px solid ${activeOrder.order_id === trackedOrder?.order_id ? TEAL : "#e8ecf0"}33`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            background: "#ef4444",
                            borderRadius: "50%",
                            display: "inline-block",
                            animation: "pulse 1.5s ease-in-out infinite",
                          }}
                        />
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 800,
                            color: textPrimary,
                          }}
                        >
                          Active Order
                        </h3>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 12px",
                          borderRadius: 20,
                          background: `${statusColors[activeOrder.status]}18`,
                          color: statusColors[activeOrder.status],
                        }}
                      >
                        {statusLabels[activeOrder.status]}
                      </span>
                    </div>

                    {/* Vendor info */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 16,
                        padding: "10px 12px",
                        background: bg,
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: TEAL,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        <Store size={18} style={{ color: "#fff" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{ fontWeight: 700, fontSize: 13, color: DARK }}
                        >
                          {activeOrder.vendor_name}
                        </div>
                        <div style={{ fontSize: 11, color: "#7a90a4" }}>
                          Order #{String(activeOrder.order_id).slice(-6)} · ₦
                          {Number(
                            activeOrder.total_amount || 0,
                          ).toLocaleString()}
                        </div>
                      </div>
                      {activeOrder.driver_phone && (
                        <a
                          href={`tel:${activeOrder.driver_phone}`}
                          style={{
                            background: TEAL,
                            color: "#fff",
                            borderRadius: 10,
                            padding: "7px 12px",
                            textDecoration: "none",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Rider
                        </a>
                      )}
                    </div>

                    {/* Step progress */}
                    <div style={{ marginBottom: 16 }}>
                      {(() => {
                        const steps = [
                          { key: "pending_review", label: "Reviewing" },
                          { key: "paid", label: "Paid" },
                          { key: "accepted", label: "Accepted" },
                          { key: "preparing", label: "Preparing" },
                          { key: "ready", label: "Ready" },
                          { key: "rider_assigned", label: "Rider" },
                          { key: "on_the_way", label: "On the way" },
                          { key: "delivered", label: "Delivered" },
                        ];
                        const currentIdx = steps.findIndex(
                          (s) => s.key === activeOrder.status,
                        );
                        return (
                          <div
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            {steps.map((s, i) => {
                              const done = i <= currentIdx;
                              const isCurrent = i === currentIdx;
                              return (
                                <div
                                  key={s.key}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    flex: i < steps.length - 1 ? 1 : "none",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        background: done ? TEAL : "#e8ecf0",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: done ? "#fff" : "#b0bec5",
                                        boxShadow: isCurrent
                                          ? `0 0 0 3px ${TEAL}44`
                                          : "none",
                                        transition: "all .3s",
                                      }}
                                    >
                                      {i + 1}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 8,
                                        fontWeight: isCurrent ? 700 : 500,
                                        color: done ? TEAL : "#b0bec5",
                                        textAlign: "center",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {s.label}
                                    </span>
                                  </div>
                                  {i < steps.length - 1 && (
                                    <div
                                      style={{
                                        flex: 1,
                                        height: 3,
                                        background:
                                          done && i < currentIdx
                                            ? TEAL
                                            : "#e8ecf0",
                                        margin: "0 2px",
                                        marginBottom: 14,
                                        borderRadius: 2,
                                        transition: "background .3s",
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {activeOrder.status === "awaiting_payment" && (
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            background: bg,
                            borderRadius: 10,
                            padding: "10px 14px",
                            marginBottom: 10,
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              color: textSecondary,
                              marginBottom: 4,
                            }}
                          >
                            <span>Item price (set by vendor)</span>
                            <span>
                              ₦
                              {Number(
                                activeOrder.total_amount,
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              color: "#f59e0b",
                              marginBottom: 4,
                            }}
                          >
                            <span>Delivery fee</span>
                            <span>Added at payment</span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              color: "#f59e0b",
                              marginBottom: 4,
                            }}
                          >
                            <span>Service fee (7%)</span>
                            <span>Added at payment</span>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: textSecondary,
                              marginTop: 4,
                            }}
                          >
                            Select your location when you click Pay to calculate
                            final total.
                          </div>
                        </div>
                        <button
                          onClick={() => handleFinalPayment(activeOrder)}
                          disabled={checkoutLoading}
                          style={{
                            width: "100%",
                            padding: "14px",
                            background: TEAL,
                            color: "#fff",
                            border: "none",
                            borderRadius: 12,
                            fontWeight: 800,
                            fontSize: 14,
                            cursor: "pointer",
                            boxShadow: `0 4px 12px ${TEAL}44`,
                            marginBottom: 8,
                          }}
                        >
                          {checkoutLoading
                            ? "Processing..."
                            : `Pay — ₦${Number(activeOrder.total_amount).toLocaleString()} + fees`}
                        </button>
                        <button
                          onClick={() => deleteOrder(activeOrder.order_id)}
                          style={{
                            width: "100%",
                            padding: "10px",
                            background: "#fff0f0",
                            color: "#e74c3c",
                            border: "1px solid #fecdd3",
                            borderRadius: 12,
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Cancel Order
                        </button>
                      </div>
                    )}

                    {activeOrder.driver_name && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          background: "#f0fafa",
                          borderRadius: 12,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: TEAL,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          <Bike size={18} style={{ color: "#fff" }} />
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: textPrimary,
                            }}
                          >
                            {activeOrder.driver_name}
                          </div>
                          <div style={{ fontSize: 11, color: "#7a90a4" }}>
                            Your rider · On the way to you
                          </div>
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              color: TEAL,
                            }}
                          >
                            ~{activeOrder.estimated_delivery_time || 30}
                          </div>
                          <div style={{ fontSize: 9, color: "#7a90a4" }}>
                            mins ETA
                          </div>
                        </div>
                      </div>
                    )}

                    {activeOrder.status === "pending" && (
                      <button
                        onClick={() => deleteOrder(activeOrder.order_id)}
                        style={{
                          background: "#fff0f0",
                          color: "#e74c3c",
                          border: "none",
                          borderRadius: 10,
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          marginBottom: 12,
                          width: "100%",
                        }}
                      >
                        Cancel this order
                      </button>
                    )}
                    {activeOrder.status === "paid" && (
                      <div
                        style={{
                          background: "#fff8e1",
                          border: "1px solid #ffc107",
                          borderRadius: 10,
                          padding: "10px 14px",
                          marginBottom: 12,
                          fontSize: 12,
                          color: "#856404",
                          textAlign: "center",
                        }}
                      >
                        Order cannot be cancelled after payment. Contact support
                        if needed.
                      </div>
                    )}

                    <div
                      style={{
                        background: bg,
                        borderRadius: 12,
                        padding: "10px 14px",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: textSecondary,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Your Items
                      </p>
                      {activeOrder.items?.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 13,
                            marginBottom:
                              i < activeOrder.items.length - 1 ? 4 : 0,
                          }}
                        >
                          <span style={{ color: DARK }}>
                            {item.item_name} ×{item.quantity}
                          </span>
                          <span style={{ fontWeight: 600, color: "#7a90a4" }}>
                            ₦{(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {/* ── ORDER HISTORY grouped by vendor ── */}
              {orders.filter((o) =>
                ["delivered", "cancelled"].includes(o.status),
              ).length > 0 && (
                <>
                  <h3
                    style={{
                      margin: "0 0 12px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Order History
                  </h3>
                  {/* Group by vendor */}
                  {Object.entries(
                    orders
                      .filter((o) =>
                        ["delivered", "cancelled"].includes(o.status),
                      )
                      .reduce((acc, o) => {
                        const key = o.vendor_name || "Unknown";
                        if (!acc[key])
                          acc[key] = {
                            vendor_name: key,
                            logo_url: o.logo_url,
                            orders: [],
                          };
                        acc[key].orders.push(o);
                        return acc;
                      }, {}),
                  ).map(([vendorName, group]) => (
                    <div
                      key={vendorName}
                      style={{
                        background: cardBg,
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 14,
                        boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                      }}
                    >
                      {/* Vendor header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "12px 16px",
                          borderBottom: `1px solid ${dividerColor}`,
                          background: "#fafafa",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: TEAL,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          {group.logo_url ? (
                            <img
                              src={group.logo_url}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <Store size={18} style={{ color: "#fff" }} />
                          )}
                        </div>
                        <span
                          style={{ fontWeight: 800, fontSize: 14, color: DARK }}
                        >
                          {vendorName}
                        </span>
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 11,
                            color: textSecondary,
                          }}
                        >
                          {group.orders.length} order
                          {group.orders.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      {/* Orders under this vendor */}
                      {group.orders.map((o, i) => (
                        <div
                          key={o.order_id}
                          style={{
                            padding: "14px 16px",
                            borderBottom:
                              i < group.orders.length - 1
                                ? "1px solid #f5f5f5"
                                : "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: 6,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 12, color: "#7a90a4" }}>
                                {new Date(o.created_at).toLocaleDateString(
                                  "en-NG",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: textSecondary,
                                  marginTop: 2,
                                }}
                              >
                                {o.items
                                  ?.map((i) => `${i.item_name} ×${i.quantity}`)
                                  .join(" · ")}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 9px",
                                borderRadius: 20,
                                background:
                                  o.status === "delivered"
                                    ? "#dcfce7"
                                    : "#fee2e2",
                                color:
                                  o.status === "delivered"
                                    ? "#16a34a"
                                    : "#dc2626",
                                flexShrink: 0,
                              }}
                            >
                              {o.status === "delivered"
                                ? "Delivered ✓"
                                : "Cancelled"}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: 14,
                                color: TEAL,
                              }}
                            >
                              ₦{Number(o.total_amount).toLocaleString()}
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                              {o.status === "delivered" && (
                                <button
                                  onClick={() => setRatingModal(o)}
                                  style={{
                                    background: "#fff8e1",
                                    color: "#92400e",
                                    border: "none",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  ⭐ Rate
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  o.items?.forEach((i) =>
                                    addItem(
                                      {
                                        menu_id: i.menu_id,
                                        item_name: i.item_name,
                                        price: i.price,
                                      },
                                      o.vendor_id,
                                      o.vendor_name,
                                    ),
                                  );
                                  setCartOpen(true);
                                }}
                                style={{
                                  background: TEAL,
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "6px 12px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                Reorder
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}

              {orders.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: textSecondary,
                  }}
                >
                  <div style={{ fontSize: 52, marginBottom: 12 }}>
                    <Package size={52} style={{ color: "#7a90a4" }} />
                  </div>
                  <p style={{ fontSize: 14, marginBottom: 16 }}>
                    No orders yet. Start ordering!
                  </p>
                  <button
                    onClick={() => setTab("home")}
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
                    Browse Eateries
                  </button>
                </div>
              )}
            </>
          )}

          {/* PROFILE */}
          {tab === "profile" && (
            <div style={{ maxWidth: 480 }}>
              <div
                style={{
                  background: cardBg,
                  borderRadius: 20,
                  padding: 28,
                  marginBottom: 16,
                  textAlign: "center",
                  boxShadow: "0 2px 12px rgba(0,0,0,.06)",
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    background: `linear-gradient(135deg,${TEAL},#089898)`,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    fontSize: 32,
                    color: "#fff",
                    fontWeight: 900,
                    boxShadow: "0 4px 16px rgba(11,191,191,.3)",
                  }}
                >
                  {user?.fullname?.[0]?.toUpperCase() || "S"}
                </div>
                <h2 style={{ margin: "0 0 4px", fontWeight: 900, color: textPrimary }}>
                  {user?.fullname}
                </h2>
                <p style={{ margin: 0, color: textSecondary, fontSize: 13 }}>
                  {user?.email}
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    background: "#e6fafa",
                    color: TEAL,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: 20,
                  }}
                >
                  Student
                </span>
              </div>
              <div
                style={{
                  background: cardBg,
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                  border: `1px solid ${cardBorder}`,
                }}
              >
                {[
                  [
                    <Package size={30} style={{ color: textSecondary }} />,
                    "My Orders",
                    "orders",
                  ],
                  [
                    <Map size={30} style={{ color: textSecondary }} />,
                    "Campus Map",
                    "map",
                  ],
                  [
                    <House size={30} style={{ color: textSecondary }} />,
                    "Home",
                    "home",
                  ],
                ].map(([icon, label, target], i, arr) => (
                  <button
                    key={target}
                    onClick={() => setTab(target)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "16px 18px",
                      border: "none",
                      borderBottom:
                        i < arr.length - 1 ? `1px solid ${dividerColor}` : "none",
                      background: cardBg,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: textPrimary }}>
                      {label}
                    </span>
                    <span style={{ marginLeft: "auto" }}>
                      <IcChevron />
                    </span>
                  </button>
                ))}
                {/* Dark mode toggle */}
                <button
                  onClick={() => {
                    const next = !darkMode;
                    setDarkMode(next);
                    localStorage.setItem("unimap_dark", next ? "1" : "0");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 18px",
                    border: "none",
                    borderTop: `1px solid ${dividerColor}`,
                    background: cardBg,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: 20, color: textSecondary }}>
                    {darkMode ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    )}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: textPrimary }}>
                    {darkMode ? "Light Mode" : "Dark Mode"}
                  </span>
                  <div style={{ marginLeft: "auto" }}>
                    <div style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: darkMode ? TEAL : "#d0d7de",
                      position: "relative",
                      transition: "background .25s",
                    }}>
                      <div style={{
                        position: "absolute",
                        top: 3,
                        left: darkMode ? 23 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: cardBg,
                        transition: "left .25s",
                        boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                      }} />
                    </div>
                  </div>
                </button>
                <button
                  onClick={logout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 18px",
                    border: "none",
                    borderTop: `1px solid ${dividerColor}`,
                    background: cardBg,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <DoorClosed size={30} style={{ color: "#5C3A21" }} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#dc2626" }}>
                    Logout
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM NAV - centered with padding */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: cardBg,
            borderTop: `1px solid ${dividerColor}`,
            zIndex: 200,
            paddingBottom: "env(safe-area-inset-bottom,4px)",
          }}
        >
          <div
            style={{
              display: "flex",
              maxWidth: 480,
              margin: "0 auto",
              padding: "0 16px",
            }}
          >
            {NAV.map((n) => {
              const active = tab === n.id;
              const activeOrderCount = n.id === "orders"
                ? orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length
                : 0;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    setTab(n.id);
                    setSelectedVendor(null);
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    padding: "8px 0",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: active ? TEAL : "#7a90a4",
                  }}
                >
                  <div
                    style={{
                      padding: "4px 16px",
                      borderRadius: 12,
                      background: active ? (dm ? "rgba(11,191,191,0.15)" : "#e6fafa") : "none",
                      position: "relative",
                    }}
                  >
                    {n.icon}
                    {activeOrderCount > 0 && (
                      <span style={{
                        position: "absolute",
                        top: 0,
                        right: 4,
                        background: "#e74c3c",
                        color: "#fff",
                        fontSize: 8,
                        fontWeight: 800,
                        borderRadius: 10,
                        minWidth: 14,
                        height: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 3px",
                        lineHeight: 1,
                      }}>
                        {activeOrderCount}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: active ? 700 : 500 }}>
                    {n.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CART DRAWER — multi-vendor */}
      {cartOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 500,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setCartOpen(false)}
        >
          <div
            style={{
              background: cardBg,
              borderRadius: "24px 24px 0 0",
              width: "100%",
              maxWidth: 520,
              maxHeight: "88vh",
              overflowY: "auto",
              padding: "20px 22px 32px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: "#e4e6ef",
                borderRadius: 2,
                margin: "0 auto 14px",
              }}
            />
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: 18,
                fontWeight: 800,
                color: textPrimary,
              }}
            >
              Your Cart
            </h3>
            {vendorList.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: textSecondary,
                  padding: "32px 0",
                }}
              >
                Your cart is empty
              </p>
            ) : (
              <>
                {vendorList.length > 1 && (
                  <div
                    style={{
                      background: "#fff8e1",
                      border: "1px solid #ffe082",
                      borderRadius: 10,
                      padding: "8px 12px",
                      marginBottom: 14,
                      fontSize: 12,
                      color: "#92400e",
                    }}
                  >
                    🛒 You have items from <b>{vendorList.length} eateries</b>.
                    Each is a separate order and payment.
                  </div>
                )}
                {vendorList.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 16,
                      overflowX: "auto",
                      paddingBottom: 4,
                      scrollbarWidth: "none",
                    }}
                  >
                    {vendorList.map((v) => (
                      <button
                        key={v.vendorId}
                        onClick={() =>
                          setCheckoutVendorId(
                            checkoutVendorId === v.vendorId ? null : v.vendorId,
                          )
                        }
                        style={{
                          padding: "6px 14px",
                          borderRadius: 20,
                          border: `1.5px solid ${checkoutVendorId === v.vendorId ? TEAL : "#e8ecf0"}`,
                          background:
                            checkoutVendorId === v.vendorId ? TEAL : "#fff",
                          color:
                            checkoutVendorId === v.vendorId ? "#fff" : DARK,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontFamily: "inherit",
                          flexShrink: 0,
                        }}
                      >
                        {v.vendorName} ({v.itemCount})
                      </button>
                    ))}
                  </div>
                )}
                {vendorList
                  .filter(
                    (v) =>
                      vendorList.length === 1 ||
                      !checkoutVendorId ||
                      v.vendorId === checkoutVendorId,
                  )
                  .map((v) => {
                    const subtotal = v.total; // already includes portions (qty × price × portions)
                    const noPackCats = ["bakery", "foodstuff", "drinks"];
                    const vendorCat = vendors.find(
                      (vn) => vn.vendor_id === v.vendorId,
                    )?.category;
                    // No packing if: vendor is drinks/bakery/foodstuff category
                    // OR if ALL items in cart are drinks
                    const allDrinks = v.items.every(
                      (i) => i.item_type === "drink",
                    );
                    const vPacking =
                      noPackCats.includes(vendorCat) || allDrinks ? 0 : 200;
                    const serviceFee = Math.round(subtotal * 0.07);
                    // Dynamic delivery fee based on address + vendor category
                    const deliveryFee = deliveryAddr.trim()
                      ? calcDeliveryFee(vendorCat, deliveryAddr)
                      : vendorCat === "foodstuff"
                        ? 2000
                        : 600;
                    const grandTotal =
                      subtotal + (deliveryAddr.trim() ? deliveryFee : 0) + vPacking + serviceFee;
                    return (
                      <div
                        key={v.vendorId}
                        style={{
                          marginBottom:
                            vendorList.length > 1 && !checkoutVendorId ? 24 : 0,
                        }}
                      >
                        {vendorList.length > 1 && !checkoutVendorId && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 10,
                              paddingBottom: 8,
                              borderBottom: "2px solid #f0fafa",
                            }}
                          >
                            <Store size={18} style={{ color: "#fff" }} />
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: 14,
                                color: textPrimary,
                              }}
                            >
                              {v.vendorName}
                            </span>
                            <button
                              onClick={() => clearVendorCart(v.vendorId)}
                              style={{
                                marginLeft: "auto",
                                background: "none",
                                border: "none",
                                color: "#ccc",
                                cursor: "pointer",
                                fontSize: 11,
                                fontFamily: "inherit",
                              }}
                            >
                              ✕ Clear
                            </button>
                          </div>
                        )}
                        {v.items.map((item) => (
                          <div
                            key={item.menu_id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "11px 0",
                              borderBottom: "1px solid #f8f8f8",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 14,
                                  color: textPrimary,
                                }}
                              >
                                {item.item_name}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: textSecondary,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span>
                                  ₦{Number(item.price).toLocaleString()} ×{" "}
                                  {item.quantity}
                                </span>
                                {item.portions > 1 && (
                                  <span
                                    style={{
                                      background: "#e6fafa",
                                      color: "#089898",
                                      borderRadius: 10,
                                      padding: "1px 6px",
                                      fontSize: 10,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {item.portions} portions/pack
                                  </span>
                                )}
                                <span
                                  style={{ color: "#089898", fontWeight: 600 }}
                                >
                                  = ₦
                                  {(
                                    item.price *
                                    item.quantity *
                                    item.portions
                                  ).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <button
                                onClick={() =>
                                  removeItem(item.menu_id, v.vendorId)
                                }
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  border: "none",
                                  background: "#f0fafa",
                                  cursor: "pointer",
                                  fontSize: 16,
                                  color: TEAL,
                                  fontWeight: 700,
                                }}
                              >
                                -
                              </button>
                              <span
                                style={{
                                  fontWeight: 700,
                                  minWidth: 20,
                                  textAlign: "center",
                                }}
                              >
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  addItem(
                                    {
                                      menu_id: item.menu_id,
                                      item_name: item.item_name,
                                      price: item.price,
                                    },
                                    v.vendorId,
                                    v.vendorName,
                                  )
                                }
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  border: "none",
                                  background: TEAL,
                                  cursor: "pointer",
                                  fontSize: 16,
                                  color: "#fff",
                                  fontWeight: 700,
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                        <div
                          style={{
                            padding: "10px 0",
                            borderBottom: `1px solid ${dividerColor}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 13,
                              color: textSecondary,
                              marginBottom: 5,
                            }}
                          >
                            <span>Subtotal</span>
                            <span>₦{subtotal.toLocaleString()}</span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 13,
                              color: textSecondary,
                              marginBottom: 5,
                            }}
                          >
                            <span>Delivery fee</span>
                            <span>
                              {deliveryAddr.trim() ? (
                                `₦${deliveryFee.toLocaleString()}`
                              ) : (
                                <span style={{ color: "#f59e0b" }}>
                                  Calculated at checkout
                                </span>
                              )}
                            </span>
                          </div>
                          {vPacking > 0 && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 13,
                                color: textSecondary,
                                marginBottom: 5,
                              }}
                            >
                              <span>
                                Packing fee{" "}
                                <span style={{ fontSize: 10 }}>(1 pack)</span>
                              </span>
                              <span>₦{vPacking}</span>
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 13,
                              color: "#f59e0b",
                              marginBottom: 2,
                            }}
                          >
                            <span>Service fee (7%) </span>
                            <span>₦{serviceFee}</span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontWeight: 800,
                            fontSize: 16,
                            padding: "10px 0 14px",
                            color: textPrimary,
                          }}
                        >
                          <span>Total</span>
                          <span style={{ color: TEAL }}>
                            ₦{grandTotal.toLocaleString()}
                            {!deliveryAddr.trim() && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 500, marginLeft: 4 }}>+ delivery</span>}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            openDeliveryModal(v.vendorId, v.vendorName)
                          }
                          disabled={checkoutLoading}
                          style={{
                            width: "100%",
                            padding: 13,
                            background: TEAL,
                            color: "#fff",
                            border: "none",
                            borderRadius: 14,
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: checkoutLoading ? "not-allowed" : "pointer",
                            opacity: checkoutLoading ? 0.7 : 1,
                            fontFamily: "inherit",
                          }}
                        >
                          {checkoutLoading
                            ? "Processing..."
                            : deliveryAddr.trim()
                              ? `Continue to pay ₦${grandTotal.toLocaleString()} — ${v.vendorName}`
                              : `Continue to pay — ${v.vendorName}`}
                        </button>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        </div>
      )}

      {/* DELIVERY ADDRESS MODAL */}
      {deliveryModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => {
            setDeliveryModal(null);
            setShowLocSuggestions(false);
          }}
        >
          <div
            style={{
              background: cardBg,
              borderRadius: 20,
              width: "100%",
              maxWidth: 400,
              padding: 28,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 6px", fontWeight: 800, color: DARK }}>
              Where should we deliver?
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#7a90a4" }}>
              Select a campus location or type your address
            </p>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <input
                autoFocus
                type="text"
                value={deliveryAddr}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeliveryAddr(val);
                  if (val.trim().length > 0) {
                    const filtered = allCampusLocations.filter(
                      (loc) =>
                        loc.name.toLowerCase().includes(val.toLowerCase()) ||
                        (loc.description || "")
                          .toLowerCase()
                          .includes(val.toLowerCase()),
                    );
                    setLocationSuggestions(filtered.slice(0, 8));
                    setShowLocSuggestions(true);
                  } else {
                    setShowLocSuggestions(false);
                    setLocationSuggestions([]);
                  }
                }}
                onFocus={() => {
                  if (allCampusLocations.length > 0 && !deliveryAddr.trim()) {
                    setLocationSuggestions(allCampusLocations.slice(0, 8));
                    setShowLocSuggestions(true);
                  }
                }}
                placeholder="e.g. Hall 6, Room 204 or Back Gate"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1.5px solid #e8ecf0",
                  borderRadius: 12,
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              {showLocSuggestions && locationSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: cardBg,
                    border: "1.5px solid #e8ecf0",
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                    zIndex: 10,
                    maxHeight: 220,
                    overflowY: "auto",
                    marginTop: 4,
                  }}
                >
                  {locationSuggestions.map((loc, i) => (
                    <div
                      key={loc.id || i}
                      onClick={() => {
                        setDeliveryAddr(loc.name);
                        setShowLocSuggestions(false);
                      }}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderBottom:
                          i < locationSuggestions.length - 1
                            ? "1px solid #f5f5f5"
                            : "none",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#f0fafa")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <span style={{ fontSize: 16 }}>
                        {loc.category === "eatery" ? (
                          <Store size={18} style={{ color: "#0F172A" }} />
                        ) : loc.category === "hostel" ? (
                          <House size={18} style={{ color: "#0F172A" }} />
                        ) : loc.category === "faculty" ? (
                          <GraduationCap
                            size={18}
                            style={{ color: "#0F172A" }}
                          />
                        ) : (
                          <MapPin size={18} style={{ color: "#0F172A" }} />
                        )}
                      </span>
                      <div>
                        <div
                          style={{ fontWeight: 700, fontSize: 13, color: DARK }}
                        >
                          {loc.name}
                        </div>
                        {loc.description && (
                          <div style={{ fontSize: 11, color: "#7a90a4" }}>
                            {loc.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div
              style={{
                background: "#e6fafa",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 18,
                fontSize: 12,
                color: "#089898",
              }}
            >
              💡 Your location helps the rider find you. Be specific — include
              room number if possible.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setDeliveryModal(null);
                  setShowLocSuggestions(false);
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  border: `1px solid ${dividerColor}`,
                  borderRadius: 12,
                  background: cardBg,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  color: textSecondary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLocSuggestions(false);
                  deliveryModal.isFinalPayment
                    ? processFinalPayment()
                    : handleCheckout(deliveryModal.vendorId);
                }}
                disabled={!deliveryAddr.trim() || checkoutLoading}
                style={{
                  flex: 2,
                  padding: 12,
                  background: deliveryAddr.trim() ? TEAL : "#ccc",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: deliveryAddr.trim() ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                {checkoutLoading ? "Processing..." : "Confirm & Pay"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM / ALERT MODAL */}
      {confirmModal && (
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
              background: cardBg,
              borderRadius: 20,
              width: "100%",
              maxWidth: 340,
              padding: 28,
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px",
                fontWeight: 800,
                color: textPrimary,
                fontSize: 17,
              }}
            >
              {confirmModal.title}
            </h3>
            <p
              style={{
                margin: "0 0 24px",
                fontSize: 14,
                color: textSecondary,
                lineHeight: 1.6,
              }}
            >
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  flex: 1,
                  padding: 12,
                  border: `1px solid ${dividerColor}`,
                  borderRadius: 12,
                  background: cardBg,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  color: textSecondary,
                  fontSize: 14,
                }}
              >
                {confirmModal.onConfirm ? "Cancel" : "OK"}
              </button>
              {confirmModal.onConfirm && (
                <button
                  onClick={confirmModal.onConfirm}
                  style={{
                    flex: 1,
                    padding: 12,
                    border: "none",
                    borderRadius: 12,
                    background: "#e74c3c",
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: isMobile ? 72 : 24,
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
            animation: "fadeIn .2s ease",
          }}
        >
          {toast}
        </div>
      )}

      {ratingModal && (
        <RatingModal
          order={ratingModal}
          onClose={() => setRatingModal(null)}
          onSubmit={async (oid, vr, dr) => {
            try {
              await api.post("/ratings", {
                order_id: oid,
                vendor_rating: vr,
                driver_rating: dr,
              });
              setRatingModal(null);
              showToast("Rating submitted!");
            } catch {}
          }}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#ccc;border-radius:4px}
      `}</style>
    </div>
  );
}

function RatingModal({ order, onClose, onSubmit }) {
  const [vR, setVR] = useState(5);
  const [dR, setDR] = useState(5);
  const Stars = ({ value, onChange }) => (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 26,
            color: s <= value ? "#f59e0b" : "#e4e6ef",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: cardBg,
          borderRadius: 20,
          padding: 28,
          width: "100%",
          maxWidth: 360,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 20px", fontWeight: 800 }}>
          Rate your experience
        </h3>
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {" "}
            {order.vendor_name}
          </p>
          <Stars value={vR} onChange={setVR} />
        </div>
        {order.driver_name && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {" "}
              Rider: {order.driver_name}
            </p>
            <Stars value={dR} onChange={setDR} />
          </div>
        )}
        <button
          onClick={() => onSubmit(order.order_id, vR, dR)}
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
          Submit Rating
        </button>
      </div>
    </div>
  );
}
