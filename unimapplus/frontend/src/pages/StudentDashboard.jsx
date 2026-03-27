import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import useCartStore from '../store/cartStore';
import { useOrderTracking } from '../hooks/useSocket';
import { useNavigate } from 'react-router-dom';

const TEAL = '#0BBFBF';
const DARK = '#0d2137';
const BG   = '#f5f6fa';

const Ic = ({d,s=20,c='currentColor'}) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d={d}/></svg>;
const IcHome    = () => <Ic d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>;
const IcMap     = () => <Ic d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5z"/>;
const IcOrders  = () => <Ic d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>;
const IcProfile = () => <Ic d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>;
const IcCart    = () => <Ic d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 5.9 17 7 17h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 23.46 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>;
const IcSearch  = () => <Ic d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"/>;
const IcChevron = () => <Ic d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" s={16}/>;
const IcMenu    = () => <Ic d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>;
const IcClose   = () => <Ic d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>;
const IcPlus    = () => <Ic d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" s={18}/>;
const IcPin     = () => <Ic d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" s={14}/>;

const CAT_LABELS = {
  african_food:'🍲 African Food', fast_food:'🍔 Fast Food', snacks:'🥪 Snacks',
  drinks:'🥤 Drinks', bakery:'🍞 Bakery', rice_dishes:'🍚 Rice Dishes',
  protein:'🍗 Proteins & Grills', vegetarian:'🥗 Vegetarian',
  foodstuff:'🛒 Foodstuff', other:'🍽️ Other',
};

const SLIDES = [
  { bg:'#E67E22', accent:'#ffedd5', tag:'FLASH DEAL',    title:'50% OFF\nWednesdays', sub:'Buka 1 · Every Wednesday', cta:'Claim Offer' },
  { bg:'#1a4a3a', accent:'#0BBFBF', tag:'TODAY ONLY',    title:'Free\nDelivery 🎉',   sub:'Campus Bite · Today only', cta:'Claim Offer' },
  { bg:'#2d1a4a', accent:'#a78bfa', tag:'NEW ON CAMPUS', title:'New on\nCampus 🔥',   sub:'Ofada Rice now available', cta:'Order Now'   },
];


const VENDOR_COLORS = ['#E67E22', '#1a4a3a', '#2d1a4a', '#0BBFBF', '#d35400', '#2c3e50', '#8e44ad'];

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
  const { carts, addItem, removeItem, clearVendorCart, setPortions, getCartArray, getVendorTotal, getVendorList, getTotalCount } = useCartStore();
  const [checkoutVendorId, setCheckoutVendorId] = useState(null);
  const vendorList = getVendorList(); // recomputes on every render when carts changes

  const [tab, setTab]                     = useState('home');
  const [vendors, setVendors]             = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [menu, setMenu]                   = useState([]);
  const [menuLoading, setMenuLoading]     = useState(false);
  const [featuredMenu, setFeaturedMenu]   = useState([]);
  const [cartOpen, setCartOpen]           = useState(false);
  const [orders, setOrders]               = useState([]);
  const [trackedOrder, setTrackedOrder]   = useState(null);
  const [searchQ, setSearchQ]             = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [ratingModal, setRatingModal]     = useState(null);
  const [heroIdx, setHeroIdx]             = useState(0);
  const [toast, setToast]                 = useState('');
  const [mapLoaded, setMapLoaded]         = useState(false);
  const [isMobile, setIsMobile]           = useState(window.innerWidth < 768);
  const [sideOpen, setSideOpen]           = useState(false);
  const [weather, setWeather]             = useState(null);
  const [nearbyLocations, setNearbyLocations] = useState([]);
  const [packingFee, setPackingFee]         = useState(0);
  const [deliveryModal, setDeliveryModal]   = useState(null); // { vendorId, vendorName }
  const [confirmModal, setConfirmModal]     = useState(null); // { title, message, onConfirm }
  const [deliveryAddr, setDeliveryAddr]     = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [deliverySearch, setDeliverySearch] = useState('');
  const [itemCustomizations, setItemCustomizations] = useState({}); // {menu_id: {variant, toppings[], designNote}}
  const [recommendations, setRecommendations] = useState(null);

  const mapRef     = useRef(null);
  const leafletMap = useRef(null);

  const cartCount = getTotalCount();

  // Handle browser back button — go to previous tab, not logout
  useEffect(() => {
    // Push initial state
    window.history.pushState({ tab: 'home', vendor: null }, '');
    const handlePop = (e) => {
      const state = e.state;
      if (state) {
        if (state.vendor) {
          setSelectedVendor(state.vendor);
        } else {
          setSelectedVendor(null);
          setTab(state.tab || 'home');
        }
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Push state when tab changes
  useEffect(() => {
    window.history.pushState({ tab, vendor: null }, '');
  }, [tab]);

  // Push state when vendor opens
  useEffect(() => {
    if (selectedVendor) {
      window.history.pushState({ tab: 'home', vendor: selectedVendor }, '');
    }
  }, [selectedVendor]);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setHeroIdx(i => (i+1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { loadVendors(); loadOrders(); loadFeaturedMenu(); fetchWeather(); }, []);

  useOrderTracking(
    trackedOrder?.order_id,
    ({ status }) => setTrackedOrder(o => o ? { ...o, status } : null),
    ({ latitude, longitude }) => setTrackedOrder(o => o ? { ...o, rider_lat:latitude, rider_lng:longitude } : null)
  );

  // Real weather using browser geolocation + Open-Meteo (free, no key needed)
  function fetchWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude, longitude } = pos.coords;
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&timezone=auto`);
        const d = await r.json();
        const temp = Math.round(d.current.temperature_2m);
        const code = d.current.weathercode;
        const desc = code === 0 ? 'Clear' : code <= 3 ? 'Partly cloudy' : code <= 48 ? 'Foggy' : code <= 67 ? 'Rainy' : 'Stormy';
        const icon = code === 0 ? '☀️' : code <= 3 ? '⛅' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : '⛈️';
        setWeather({ temp, desc, icon });
        // Fetch ML recommendations with weather context
        loadRecommendations(temp, desc);
      } catch {}
    }, () => {
      // No GPS - load recommendations with default context
      loadRecommendations(null, null);
    });
  }

  async function loadRecommendations(temp, weatherDesc) {
    try {
      const params = { school_id: user?.school_id };
      if (temp !== null) params.temp = temp;
      if (weatherDesc) params.weather_desc = weatherDesc;
      const { data } = await api.get('/recommendations', { params });
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data);
      }
    } catch {} // Falls back to static pills
  }

  async function loadVendors() {
    try { const {data} = await api.get('/vendors',{params:{school_id:user?.school_id}}); setVendors(data.vendors||[]); } catch {}
  }
  async function loadOrders() {
    try {
      const {data} = await api.get('/student/orders');
      setOrders(data.orders||[]);
      const active = data.orders?.find(o=>!['delivered','cancelled'].includes(o.status));
      if (active) setTrackedOrder(active);
    } catch {}
  }
  async function loadFeaturedMenu() {
    try {
      const {data} = await api.get('/featured-menu', {params:{school_id:user?.school_id}});
      setFeaturedMenu((data.items||[]).slice(0,6));
    } catch {}
  }
  async function openVendor(v) {
    setSelectedVendor(v); setMenuLoading(true); setTab('home');
    // Packing fee: 200 for food vendors, 0 for bakery/drinks/foodstuff
    const noPackingCats = ['bakery','foodstuff','drinks'];
    // Default packing fee based on vendor category; will be recalculated per-cart based on items
    setPackingFee(noPackingCats.includes(v.category) ? 0 : 200);
    try { const {data}=await api.get(`/vendors/${v.vendor_id}/menu`); setMenu(data.items||[]); } catch {}
    setMenuLoading(false);
  }
  function addToCart(item, portions) {
    const custom = itemCustomizations[item.menu_id] || {};
    // Calculate price with variant and toppings
    const variantPrice = custom.variant ? custom.variant.price : item.price;
    const toppingsTotal = (custom.toppings || []).reduce((s,t) => s + (t.price||0), 0);
    const finalPrice = variantPrice + toppingsTotal;
    const itemWithCustom = { ...item, price: finalPrice, custom };
    addItem(itemWithCustom, selectedVendor?.vendor_id, selectedVendor?.vendor_name, portions);
    showToast(`Added: ${item.item_name}${portions>1?' ('+portions+' portions)':''}${custom.variant?' · '+custom.variant.label:''}`);
  }

  function setItemCustom(menuId, field, value) {
    setItemCustomizations(prev => ({
      ...prev,
      [menuId]: { ...(prev[menuId]||{}), [field]: value }
    }));
  }

  function toggleTopping(menuId, topping) {
    const current = itemCustomizations[menuId]?.toppings || [];
    const exists = current.find(t => t.label === topping.label);
    const updated = exists ? current.filter(t => t.label !== topping.label) : [...current, topping];
    setItemCustom(menuId, 'toppings', updated);
  }
  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''),2200); }

  async function doSearch(q) {
    if (!q.trim()) { setSearchResults(null); return; }
    try { const {data}=await api.get('/search',{params:{q,school_id:user?.school_id}}); setSearchResults(data); } catch {}
  }

  function openDeliveryModal(vendorId, vendorName) {
    setDeliveryModal({ vendorId, vendorName });
    setDeliveryAddr('');
  }

  function deleteOrder(orderId) {
    setConfirmModal({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order? This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/student/orders/${orderId}`);
          setOrders(prev => prev.filter(o => o.order_id !== orderId));
          if (trackedOrder?.order_id === orderId) setTrackedOrder(null);
          showToast('Order cancelled');
        } catch(err) {
          setConfirmModal({
            title: 'Cannot Delete Order',
            message: err.response?.data?.message || 'Order cannot be deleted after payment has been made.',
            onConfirm: null,
          });
        }
      }
    });
  }

  async function handleCheckout(vendorId) {
    const cartArr = getCartArray(vendorId);
    if (!cartArr.length) return;
    if (!deliveryAddr.trim()) { setConfirmModal({ title: 'Delivery Location Required', message: 'Please enter your hostel, hall, or location before paying.', onConfirm: null }); return; }
    setDeliveryModal(null);
    setCartOpen(false);
    setCheckoutLoading(true);
    try {
      const {data} = await api.post('/checkout',{
        vendor_id: vendorId,
        cart: cartArr.map(i=>({menu_id:i.menu_id,quantity:i.quantity,portions:i.portions||1})),
        delivery_address: deliveryAddr.trim(),
      });
      clearVendorCart(vendorId);
      window.location.href = data.payment_url;
    } catch(err) { setConfirmModal({ title: 'Checkout Failed', message: err.response?.data?.message || 'Checkout failed. Please try again.', onConfirm: null }); }
    setCheckoutLoading(false);
  }

  const userLatLng = useRef(null);
  const nearbyMarkers = useRef({});
  const routeLayer = useRef(null);

  useEffect(() => {
    if (tab !== 'map') return;
    function initMap() {
      if (leafletMap.current || !mapRef.current) return;
      const L = window.L; if (!L) return;
      const map = L.map(mapRef.current, {center:[6.3990,5.6175],zoom:16});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
      leafletMap.current = map;

      // Load ONLY campus locations from DB — no hardcoded fallbacks
      api.get('/locations',{params:{school_id:user?.school_id}}).then(({data})=>{
        const locs = (data.locations || []).filter(loc =>
          loc.latitude && loc.longitude &&
          // Sanity check: must be within UNIBEN bounds (approx)
          loc.latitude > 6.39 && loc.latitude < 6.41 &&
          loc.longitude > 5.60 && loc.longitude < 5.64
        );
        setNearbyLocations(locs);
        locs.forEach(loc=>{
          const isEatery = loc.category === 'eatery';
          const catEmoji = loc.category==='eatery'?'🍽️':loc.category==='hostel'?'🏠':loc.category==='sports'?'⚽':loc.category==='faculty'?'🎓':'📍';
          const icon = L.divIcon({
            html:`<div style="background:${isEatery?TEAL:'#0d2137'};width:30px;height:30px;border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)">${catEmoji}</div>`,
            iconSize:[30,30], iconAnchor:[15,15], className:''
          });
          const marker = L.marker([Number(loc.latitude), Number(loc.longitude)],{icon})
            .addTo(map)
            .bindPopup(`<b>${loc.name}</b><br><small>${loc.description||loc.category}</small>`);
          nearbyMarkers.current[loc.name] = { marker, lat:Number(loc.latitude), lng:Number(loc.longitude) };
          marker.on('click', () => {
            if (userLatLng.current) drawRoute(map, userLatLng.current, [Number(loc.latitude), Number(loc.longitude)], loc.name);
          });
        });
      });

      // Geolocation — "You are here" marker
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const latlng = [pos.coords.latitude, pos.coords.longitude];
          userLatLng.current = latlng;
          const youIcon = L.divIcon({
            html:`<div style="width:16px;height:16px;background:#0BBFBF;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(11,191,191,.3)"></div>`,
            iconSize:[16,16], iconAnchor:[8,8], className:''
          });
          L.marker(latlng, {icon:youIcon}).addTo(map)
            .bindPopup('<b>📍 You are here</b><br>Your Location').openPopup();
          map.setView(latlng, 16);
        }, () => {
          // fallback: place user at UNIBEN centre
          userLatLng.current = [6.3990, 5.6175];
          const youIcon = L.divIcon({
            html:`<div style="width:16px;height:16px;background:#0BBFBF;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(11,191,191,.3)"></div>`,
            iconSize:[16,16], iconAnchor:[8,8], className:''
          });
          L.marker(userLatLng.current, {icon:youIcon}).addTo(map)
            .bindPopup('<b>📍 You are here</b><br>Your Location').openPopup();
        });
      }
      setMapLoaded(true);
    }
    if (window.L) { setTimeout(initMap,100); return; }
    if (!document.querySelector('link[href*="leaflet"]')) {
      const css=document.createElement('link'); css.rel='stylesheet';
      css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    }
    const s=document.createElement('script');
    s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload=()=>setTimeout(initMap,100); document.head.appendChild(s);
  },[tab]);

  async function drawRoute(map, from, to, name) {
    const L = window.L; if (!L || !map) return;
    if (routeLayer.current) { map.removeLayer(routeLayer.current); routeLayer.current = null; }

    const bar  = document.getElementById('map-walking-bar');
    const hint = document.getElementById('map-tap-hint');
    if (bar)  { bar.style.display='flex';  bar.querySelector('#route-text').textContent = 'Getting route...'; }
    if (hint) hint.style.display='none';

    try {
      // Try OSRM for real path geometry
      // const url = `https://router.project-osrm.org/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        routeLayer.current = L.polyline(coords, {
          color: TEAL, weight: 4, opacity: 0.85
        }).addTo(map);
        // Use actual OSRM route distance for time (83m/min = 5km/h walking)
        const routeDistM = route.distance; // metres along actual path
        const mins = Math.ceil(routeDistM / 83);
        const km = (routeDistM / 1000).toFixed(2);
        if (bar) bar.querySelector('#route-text').textContent = `${mins} min · ${km} km — to ${name}`;
        map.fitBounds(routeLayer.current.getBounds(), {padding:[30,30]});
      } else {
        throw new Error('No route');
      }
    } catch {
      // Fallback straight line
      const fromLL = L.latLng(from[0], from[1]);
      const toLL   = L.latLng(to[0], to[1]);
      routeLayer.current = L.polyline([fromLL, toLL], {
        color: TEAL, weight: 4, dashArray: '8,6', opacity: 0.85
      }).addTo(map);
      const dist = fromLL.distanceTo(toLL);
      const mins = Math.ceil(dist * 1.25 / 80);
      const km   = (dist * 1.25 / 1000).toFixed(2);
      if (bar) bar.querySelector('#route-text').textContent = `~${mins} min · ${km} km — to ${name}`;
      map.fitBounds(routeLayer.current.getBounds(), {padding:[30,30]});
    }
  }


  function flyToNearby(loc) {
    if (!leafletMap.current) return;
    const entry = nearbyMarkers.current[loc.name];
    const lat = Number(entry?.lat ?? loc.latitude);
    const lng = Number(entry?.lng ?? loc.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    leafletMap.current.flyTo([lat, lng], 18, {duration:1.2});
    if (entry?.marker) entry.marker.openPopup();
    if (userLatLng.current) drawRoute(leafletMap.current, userLatLng.current, [lat, lng], loc.name);
  }

  const statusLabels = {pending:'Pending',paid:'Paid',accepted:'Accepted',preparing:'Preparing',ready:'Ready for pickup',rider_assigned:'Rider assigned',picked_up:'Picked up',on_the_way:'On the way!',delivered:'Delivered ✓',cancelled:'Cancelled'};
  const statusColors = {pending:'#f59e0b',paid:'#3b82f6',accepted:'#8b5cf6',preparing:'#f97316',rider_assigned:'#06b6d4',picked_up:'#10b981',on_the_way:TEAL,delivered:'#22c55e',cancelled:'#ef4444'};
  const slide = SLIDES[heroIdx];

  const NAV = [
    {id:'home',   label:'Home',   icon:<IcHome/>},
    {id:'map',    label:'Map',    icon:<IcMap/>},
    {id:'orders', label:'Orders', icon:<IcOrders/>},
    {id:'profile',label:'Profile',icon:<IcProfile/>},
  ];

  function SideItem({id,label,icon}) {
    const active = tab===id;
    return (
      <button onClick={()=>{setTab(id);setSelectedVendor(null);}}
        style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'11px 14px',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',background:active?TEAL:'transparent',color:active?'#fff':'#7a90a4',fontWeight:active?700:500,fontSize:14,marginBottom:2,transition:'all .15s'}}>
        <span style={{opacity:active?1:0.7}}>{icon}</span>{label}
      </button>
    );
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Plus Jakarta Sans',sans-serif",background:BG,position:'relative'}}>

      {/* SIDEBAR desktop */}
      {!isMobile && (
        <div style={{width:200,background:'#fff',borderRight:'1px solid #e8ecf0',position:'fixed',top:0,left:0,height:'100vh',padding:'20px 12px',display:'flex',flexDirection:'column',zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 4px',marginBottom:28}}>
            <div style={{width:32,height:32,background:TEAL,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:14}}>U</div>
            <span style={{fontWeight:900,fontSize:17,color:DARK}}>Unimap<span style={{color:TEAL}}>+</span></span>
          </div>
          <p style={{fontSize:10,fontWeight:700,color:'#b0bec5',letterSpacing:1,margin:'0 4px 8px',textTransform:'uppercase'}}>Student</p>
          {NAV.map(n=><SideItem key={n.id} {...n}/>)}
        </div>
      )}

      {/* MOBILE DRAWER */}


      {/* MAIN */}
      <div style={{flex:1,marginLeft:isMobile?0:200,display:'flex',flexDirection:'column',minHeight:'100vh'}}>

        {/* TOP BAR */}
        <div style={{position:'sticky',top:0,zIndex:200,background:'#fff',borderBottom:'1px solid #e8ecf0',display:'flex',alignItems:'center',gap:12,padding:'0 16px',height:58,boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
          <div style={{flex:1,display:'flex',alignItems:'center',gap:8,background:BG,border:'1.5px solid #e8ecf0',borderRadius:30,padding:'7px 14px',maxWidth:420}}>
            <span style={{color:'#7a90a4'}}><IcSearch/></span>
            <input value={searchQ} onChange={e=>{setSearchQ(e.target.value);doSearch(e.target.value);}} placeholder="Search restaurants, food..."
              style={{border:'none',outline:'none',background:'none',fontFamily:'inherit',fontSize:13,flex:1,color:DARK}}/>
          </div>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
            <button onClick={()=>setCartOpen(true)} style={{position:'relative',background:'none',border:'none',cursor:'pointer',color:DARK,padding:4}}>
              <IcCart/>
              {cartCount>0 && <span style={{position:'absolute',top:0,right:0,background:'#e74c3c',color:'#fff',fontSize:9,fontWeight:700,width:15,height:15,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>{cartCount}</span>}
            </button>
            <div style={{display:'flex',alignItems:'center',gap:8,background:BG,border:'1.5px solid #e8ecf0',borderRadius:30,padding:'5px 12px 5px 6px',cursor:'pointer'}} onClick={()=>setTab('profile')}>
              <div style={{width:26,height:26,borderRadius:'50%',background:TEAL,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:800}}>{user?.fullname?.[0]?.toUpperCase()||'S'}</div>
              <span style={{fontSize:12,fontWeight:700,color:DARK}}>{user?.fullname?.split(' ')[0]||'Student'}</span>
              <span style={{fontSize:10,color:'#7a90a4'}}>▾</span>
            </div>
            {!isMobile && <button onClick={logout} style={{background:'#fff0f0',color:'#e74c3c',border:'none',borderRadius:20,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Logout</button>}
          </div>
        </div>

        {/* SEARCH DROPDOWN */}
        {searchResults && searchQ && (
          <div style={{position:'fixed',top:58,left:isMobile?0:200,right:0,background:'#fff',zIndex:300,borderBottom:'1px solid #e8ecf0',boxShadow:'0 8px 24px rgba(0,0,0,.1)',maxHeight:360,overflowY:'auto',padding:16}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:700}}>Results for "{searchQ}"</span>
              <button onClick={()=>{setSearchResults(null);setSearchQ('');}} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#7a90a4'}}>×</button>
            </div>
            {[...(searchResults.vendors||[]).map(v=>({name:v.vendor_name,sub:v.is_open?'✅ Open':'❌ Closed',emoji:'🏪',action:()=>{openVendor(v);setSearchResults(null);setSearchQ('');}})),
              ...(searchResults.foods||[]).map(f=>({name:f.item_name,sub:`${f.vendor_name} · ₦${f.price}`,img:f.image_url,action:()=>{openVendor({vendor_id:f.vendor_id,vendor_name:f.vendor_name});setSearchResults(null);setSearchQ('');}})),
            ].map((r,i)=>(
              <div key={i} onClick={r.action} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 8px',borderRadius:10,cursor:'pointer',marginBottom:4}}
                onMouseEnter={e=>e.currentTarget.style.background='#f5f6fa'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                {r.img?<img src={r.img} alt="" style={{width:36,height:36,borderRadius:8,objectFit:'cover'}}/>:<span style={{fontSize:22}}>{r.emoji||'🍽️'}</span>}
                <div><div style={{fontWeight:700,fontSize:14}}>{r.name}</div><div style={{fontSize:11,color:'#7a90a4'}}>{r.sub}</div></div>
                <span style={{marginLeft:'auto',color:'#7a90a4'}}><IcChevron/></span>
              </div>
            ))}
            {!searchResults.vendors?.length&&!searchResults.foods?.length&&<p style={{textAlign:'center',color:'#7a90a4',padding:'20px 0',fontSize:13}}>No results found</p>}
          </div>
        )}

        {/* PAGE CONTENT */}
        <div style={{flex:1,padding:isMobile?'16px 14px 90px':'24px 28px 40px',maxWidth:1100}}>

          {/* HOME */}
          {tab==='home' && !selectedVendor && (
            <>
              {/* Active order banner */}
              {trackedOrder&&!['delivered','cancelled'].includes(trackedOrder.status)&&(
                <div onClick={()=>setTab('orders')} style={{background:'linear-gradient(135deg,#0BBFBF,#089898)',borderRadius:14,padding:'12px 16px',marginBottom:16,cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:22}}>🏍️</span>
                  <div style={{flex:1}}>
                    <p style={{margin:0,color:'#fff',fontWeight:700,fontSize:13}}>Order in progress!</p>
                    <p style={{margin:'2px 0 0',color:'rgba(255,255,255,.8)',fontSize:11}}>{statusLabels[trackedOrder.status]} · Tap to track</p>
                  </div>
                  <span style={{color:'#fff',fontSize:12,fontWeight:700}}>Track →</span>
                </div>
              )}

              {/* HERO */}
              <div style={{borderRadius:18,overflow:'hidden',marginBottom:20,position:'relative',height:isMobile?160:180,background:slide.bg,display:'flex',alignItems:'center',padding:'0 28px',transition:'background .4s'}}>
                <div style={{zIndex:2,flex:1}}>
                  <span style={{fontSize:10,fontWeight:800,letterSpacing:1,color:slide.accent,background:`${slide.accent}33`,padding:'3px 10px',borderRadius:20,textTransform:'uppercase'}}>{slide.tag}</span>
                  <h2 style={{margin:'10px 0 6px',color:'#fff',fontSize:isMobile?22:28,fontWeight:900,lineHeight:1.15,whiteSpace:'pre-line'}}>{slide.title}</h2>
                  <p style={{margin:'0 0 14px',color:'rgba(255,255,255,.85)',fontSize:12}}>{slide.sub}</p>
                  <button style={{background:'#fff',color:slide.bg,border:'none',borderRadius:20,padding:'8px 18px',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>{slide.cta}</button>
                </div>
                {heroIdx===0
                  ? <img src="/burger.png" alt="burger" style={{position:'absolute',right:0,bottom:0,height:isMobile?'95%':'100%',objectFit:'contain',objectPosition:'bottom right',filter:'drop-shadow(-4px 0 8px rgba(0,0,0,0.15))'}}/>
                  : <div style={{width:isMobile?80:120,height:isMobile?80:120,borderRadius:'50%',background:`${slide.accent}33`}}/>
                }
                <div style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',display:'flex',gap:6}}>
                  {SLIDES.map((_,i)=>(
                    <div key={i} onClick={()=>setHeroIdx(i)} style={{width:i===heroIdx?18:6,height:6,borderRadius:3,background:i===heroIdx?'#fff':'rgba(255,255,255,.4)',cursor:'pointer',transition:'all .3s'}}/>
                  ))}
                </div>
              </div>

              {/* AI PICK - with real weather */}
              <div style={{background:'linear-gradient(135deg,#0d2137,#1a3a4a)',borderRadius:16,padding:'14px 18px',marginBottom:24,border:'1px solid rgba(11,191,191,.2)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{background:TEAL,color:'#fff',fontSize:10,fontWeight:800,padding:'3px 9px',borderRadius:20,letterSpacing:0.5}}>AI Pick</span>
                  <span style={{fontSize:11,color:'rgba(255,255,255,.7)',background:'rgba(255,255,255,.1)',padding:'4px 11px',borderRadius:20}}>
                    {weather ? `${weather.icon} ${weather.temp}°C · ${weather.desc}` : '🌡️ Getting weather...'}
                  </span>
                </div>
                <p style={{fontSize:12,color:'rgba(255,255,255,.6)',margin:'0 0 6px'}}>Food for today's weather</p>
                <p style={{fontSize:12,color:'rgba(255,255,255,.8)',margin:'0 0 12px',lineHeight:1.5}}>
                  {(()=>{
                    const h = new Date().getHours();
                    const t = weather?.temp;
                    const d = weather?.desc || '';
                    if (d.includes('Rain') || d.includes('Storm'))
                      return 'Rainy day on campus 🌧️ — stay in, order hot pepper soup or ofe onugbu. Warm and comforting.';
                    if (t >= 34)
                      return h < 12
                        ? 'Already scorching this morning ☀️ — start with something cold. Zobo or chilled drinks are calling.'
                        : h < 17
                        ? 'Afternoon heat is real 🥵 — cold drinks, light snacks, or a chilled shawarma. Stay refreshed.'
                        : 'Warm evening today 🌇 — order something to keep you cool. Zobo, cold drinks, or light bites.';
                    if (t >= 30)
                      return h < 12
                        ? 'Warm morning ahead ☀️ — grab something light before lectures. Snacks or a quick bite works.'
                        : h < 17
                        ? 'It\'s warm out there 🌤️ — a cold drink with your meal hits differently right now.'
                        : 'Nice warm evening 🌆 — perfect time for a full meal. Jollof, soups, or your favourite buka food.';
                    if (t >= 25)
                      return h < 12
                        ? 'Cool morning vibes ⛅ — fuel up before the day gets busy. Breakfast or a quick snack?'
                        : h < 17
                        ? 'Good afternoon weather for a proper meal 🍽️ — treat yourself between classes.'
                        : 'Cool evening on campus 🌙 — great time to order your favourite comfort food.';
                    return h < 12
                      ? 'Fresh morning 🌿 — start your day right with something filling.'
                      : h < 17
                      ? 'Good weather for a nice meal. Pick something hearty!'
                      : 'Cool night ahead 🌙 — warm food hits different. Soups, stews, or a hot plate of rice.';
                  })()}
                </p>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {recommendations?.recommendations?.length > 0
                    ? recommendations.recommendations.map(rec=>(
                        <button key={rec.menu_id}
                          onClick={()=>openVendor({vendor_id:rec.vendor_id,vendor_name:rec.vendor_name})}
                          style={{background:'rgba(11,191,191,.15)',border:'1px solid rgba(11,191,191,.3)',borderRadius:20,padding:'5px 12px',fontSize:11,fontWeight:600,color:'#7ee8e8',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
                          {rec.is_personal && <span style={{fontSize:9}}>🤍</span>}
                          +{rec.item_name} — ₦{Number(rec.price).toLocaleString()}
                        </button>
                      ))
                    : ['+Zobo Drink — ₦300','+Chicken Shawarma — ₦3000','+Club Sandwich — ₦600'].map(r=>(
                        <button key={r} onClick={async()=>{
                          const q=r.replace(/^[+]/,'').split('—')[0].trim();
                          try {
                            const {data}=await api.get('/search',{params:{q,school_id:user?.school_id}});
                            if (data.foods?.length>0) {
                              const f=data.foods[0];
                              await openVendor({vendor_id:f.vendor_id,vendor_name:f.vendor_name});
                            } else if (data.vendors?.length>0) {
                              await openVendor(data.vendors[0]);
                            } else {
                              setSearchQ(q); doSearch(q);
                            }
                          } catch { setSearchQ(q); doSearch(q); }
                        }}
                          style={{background:'rgba(11,191,191,.15)',border:'1px solid rgba(11,191,191,.3)',borderRadius:20,padding:'5px 12px',fontSize:11,fontWeight:600,color:'#7ee8e8',cursor:'pointer',fontFamily:'inherit'}}>{r}</button>
                      ))
                  }
                </div>
              </div>

             {/* POPULAR VENDORS */}
<h3 style={{margin:'0 0 12px',fontSize:15,fontWeight:800,color:DARK}}>Popular Vendors</h3>
<div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:8,marginBottom:24,scrollbarWidth:'none'}}>
  {vendors.length === 0 ? (
    <p style={{fontSize:13, color:'#7a90a4'}}>No vendors yet for your school.</p>
  ) : (
    vendors.map((v) => (
      <div 
        key={v.vendor_id} 
        onClick={() => openVendor(v)}
        style={{
          flexShrink: 0,
          width: 140,
          height: 140,
          borderRadius: 16,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          background: v.logo_url ? '#fff' : getVendorColor(v.vendor_name),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          transition: 'transform .15s'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        {v.logo_url && (
          <img 
            src={v.logo_url} 
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} 
            alt="" 
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', zIndex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {v.vendor_name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 10, display: 'inline-block' }}>
            {CAT_LABELS[v.category] || '🍽️ Food'}
          </div>
        </div>
      </div>
    ))
  )}
</div>

              {/* FEATURED MENU - real data */}
              <h3 style={{margin:'0 0 12px',fontSize:15,fontWeight:800,color:DARK}}>Featured Menu</h3>
              {featuredMenu.length === 0 ? (
                <div style={{background:'#fff',borderRadius:14,padding:'32px 20px',textAlign:'center',color:'#7a90a4',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                  <div style={{fontSize:36,marginBottom:8}}>🍽️</div>
                  <p style={{fontSize:13,margin:0}}>No menu items yet. Vendors will add items soon!</p>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:12}}>
                  {featuredMenu.map((item,i)=>(
                    <div key={item.menu_id} style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05)',cursor:'pointer',transition:'box-shadow .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.05)'}
                      onClick={()=>openVendor({vendor_id:item.vendor_id,vendor_name:item.vendor_name,category:item.category})}>
                      {item.image_url
                        ? <img src={item.image_url} alt={item.item_name} style={{width:'100%',height:110,objectFit:'cover'}}/>
                        : <div style={{height:110,background:`linear-gradient(135deg,${['#1a4a3a','#2d1a4a','#4a2a0a','#1a2a4a','#3a1a1a','#1a3a2a'][i%6]},#0d2137)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:36}}>
                            {CAT_LABELS[item.category]?.split(' ')[0] || '🍽️'}
                          </div>
                      }
                      <div style={{padding:'10px 12px'}}>
                        <div style={{fontWeight:700,fontSize:13,color:DARK,marginBottom:2}}>{item.item_name}</div>
                        <div style={{fontSize:11,color:'#7a90a4',marginBottom:6}}>{item.vendor_name}{item.prep_time ? ` · ⏱ ${item.prep_time} min` : ''}</div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontWeight:800,fontSize:14,color:TEAL}}>₦{Number(item.price).toLocaleString()}</span>
                          <button onClick={e=>{e.stopPropagation();addItem({menu_id:item.menu_id,item_name:item.item_name,price:item.price},item.vendor_id,item.vendor_name);showToast(`Added: ${item.item_name}`);}}
                            style={{width:28,height:28,borderRadius:8,background:TEAL,border:'none',cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700}}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* VENDOR MENU */}
          {tab==='home' && selectedVendor && (
            <>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:selectedVendor.is_open?20:12}}>
                <button onClick={()=>setSelectedVendor(null)} style={{background:'#fff',border:'1.5px solid #e8ecf0',borderRadius:10,width:36,height:36,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
                <div>
                  <h2 style={{margin:0,fontSize:18,fontWeight:800,color:DARK}}>{selectedVendor.vendor_name}</h2>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
                    <p style={{margin:0,fontSize:12,color:'#7a90a4'}}>{selectedVendor.is_open?' Open':' Closed'} · ⭐ {selectedVendor.rating?Number(selectedVendor.rating).toFixed(1):'New'}</p>
                    {selectedVendor.category && <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#e6fafa',color:TEAL}}>{CAT_LABELS[selectedVendor.category]||selectedVendor.category}</span>}
                  </div>
                </div>
              </div>
              {!selectedVendor.is_open && (
                <div style={{background:'#fff3cd',border:'1px solid #ffc107',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:20}}>🔒</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:'#856404'}}>This eatery is currently closed</div>
                    <div style={{fontSize:12,color:'#856404',marginTop:2}}>You can browse the menu but ordering is disabled until they open.</div>
                  </div>
                </div>
              )}
              {menuLoading ? <p style={{color:'#7a90a4',textAlign:'center',padding:40}}>Loading menu...</p>
              : menu.length===0 ? <p style={{color:'#7a90a4',textAlign:'center',padding:40}}>No menu items yet.</p>
              : (
                <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
                  {menu.map(item=>{
                    const hasCustomizations =
                    (item.variants && JSON.parse(item.variants || '[]').length > 0) ||
                    (item.toppings && JSON.parse(item.toppings || '[]').length > 0) ||
                    item.allow_design_notes == 1;
                    const qty=carts[selectedVendor?.vendor_id]?.items[item.menu_id]?.quantity||0;
                    return (
                      <div key={item.menu_id} style={{background:'#fff',borderRadius:14,padding:14,display:'flex',gap:12,alignItems:'center',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                        {item.image_url
                          ?<img src={item.image_url} alt={item.item_name} style={{width:72,height:72,borderRadius:12,objectFit:'cover',flexShrink:0}}/>
                          :<div style={{width:72,height:72,borderRadius:12,background:'#f0fafa',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,flexShrink:0}}>🍽️</div>
                        }
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,color:DARK,marginBottom:2}}>{item.item_name}</div>
                          <div style={{fontSize:11,color:'#7a90a4',marginBottom:4}}>{selectedVendor.vendor_name} · ⏱ {item.prep_time||15} min</div>

                          {/* FOODSTUFF: Variant picker */}
                          {(() => {
                            const variants = (() => { try { return JSON.parse(item.variants||'[]'); } catch { return []; } })();
                            if (variants.length > 0) return (
                              <select value={itemCustomizations[item.menu_id]?.variant?.label||''}
                                onChange={e=>{
                                  const v = variants.find(v=>v.label===e.target.value);
                                  setItemCustom(item.menu_id,'variant',v||null);
                                }}
                                style={{width:'100%',padding:'5px 8px',border:`1px solid ${TEAL}55`,borderRadius:8,fontSize:12,fontFamily:'inherit',marginBottom:4,color:DARK}}>
                                <option value="">Select quantity...</option>
                                {variants.map(v=><option key={v.label} value={v.label}>{v.label} — ₦{Number(v.price).toLocaleString()}</option>)}
                              </select>
                            );
                            return null;
                          })()}

                          {/* BAKERY: Toppings */}
                          {(() => {
                            const toppings = (() => { try { return JSON.parse(item.toppings||'[]'); } catch { return []; } })();
                            if (toppings.length > 0) return (
                              <div style={{marginBottom:4}}>
                                <div style={{fontSize:10,color:'#7a90a4',marginBottom:3}}>Toppings:</div>
                                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                                  {toppings.map(t=>{
                                    const selected = (itemCustomizations[item.menu_id]?.toppings||[]).find(x=>x.label===t.label);
                                    return (
                                      <span key={t.label} onClick={()=>toggleTopping(item.menu_id,t)}
                                        style={{fontSize:10,padding:'2px 8px',borderRadius:20,cursor:'pointer',border:`1px solid ${selected?TEAL:'#dde8e8'}`,background:selected?TEAL:'#fff',color:selected?'#fff':DARK,fontWeight:selected?700:400}}>
                                        {t.label}{t.price>0?` +₦${t.price}`:''}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                            return null;
                          })()}

                          {/* BAKERY: Design notes */}
                          {item.allow_design_notes==1&&(
                            <input type="text" placeholder="Describe your cake design (optional)..."
                              value={itemCustomizations[item.menu_id]?.designNote||''}
                              onChange={e=>setItemCustom(item.menu_id,'designNote',e.target.value)}
                              style={{width:'100%',padding:'5px 8px',border:'1px solid #e8ecf0',borderRadius:8,fontSize:11,fontFamily:'inherit',marginBottom:4,boxSizing:'border-box'}}/>
                          )}

                          <div style={{fontWeight:800,fontSize:15,color:TEAL}}>
                            ₦{Number(
                              (() => {
                                const variants = (() => { try { return JSON.parse(item.variants||'[]'); } catch { return []; } })();
                                const custom = itemCustomizations[item.menu_id]||{};
                                const base = variants.length>0 ? (custom.variant?.price||item.price) : item.price;
                                const extras = (custom.toppings||[]).reduce((s,t)=>s+(t.price||0),0);
                                return base + extras;
                              })()
                            ).toLocaleString()}
                          </div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                          {!selectedVendor?.is_open ? (
                            <span style={{fontSize:10,color:'#856404',background:'#fff3cd',padding:'4px 8px',borderRadius:8,fontWeight:600}}>Closed</span>
                          ) : qty>0?(
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <button onClick={()=>removeItem(item.menu_id,selectedVendor?.vendor_id)} style={{width:28,height:28,borderRadius:7,border:'none',background:'#f0fafa',cursor:'pointer',fontSize:16,fontWeight:700,color:TEAL}}>-</button>
                              <span style={{fontWeight:700,minWidth:16,textAlign:'center',fontSize:14}}>{qty}</span>
                              <button onClick={()=>addToCart(item)} style={{width:28,height:28,borderRadius:7,border:'none',background:TEAL,cursor:'pointer',fontSize:16,fontWeight:700,color:'#fff'}}>+</button>
                            </div>
                          ):(
                            <button onClick={()=>addToCart(item)} style={{width:34,height:34,borderRadius:10,border:'none',background:TEAL,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}><IcPlus/></button>
                          )}
                          {qty > 0 && item.item_type !== 'drink' && !hasCustomizations && (
                            <div style={{display:'flex',alignItems:'center',gap:3}}>
                              <span style={{fontSize:9,color:'#7a90a4'}}>portions:</span>
                              <select value={carts[selectedVendor?.vendor_id]?.items[item.menu_id]?.portions||1}
                                onChange={e=>setPortions(item.menu_id,selectedVendor?.vendor_id,Number(e.target.value))}
                                style={{fontSize:11,border:`1px solid ${TEAL}55`,borderRadius:6,padding:'1px 3px',fontFamily:'inherit',background:'#f0fafa',color:TEAL,fontWeight:700,cursor:'pointer'}}>
                                {[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}
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
          {tab==='map' && (
            <>
              <h2 style={{margin:'0 0 16px',fontSize:20,fontWeight:800,color:DARK}}>📍 Campus Map</h2>
              <div style={{background:'#fff',borderRadius:14,padding:'10px 14px',marginBottom:14,display:'flex',gap:10,alignItems:'center',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                <IcSearch/>
                <input placeholder="Where to on campus?" onChange={e=>doSearch(e.target.value)}
                  style={{flex:1,border:'none',outline:'none',fontFamily:'inherit',fontSize:14,color:DARK}}/>
                <button style={{background:TEAL,color:'#fff',border:'none',borderRadius:20,padding:'7px 18px',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Search</button>
              </div>
              <div ref={mapRef} style={{borderRadius:16,overflow:'hidden',height:isMobile?280:340,background:'#e8f4f4',marginBottom:16,border:'1px solid #e0f0f0'}}>
                {!mapLoaded&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#7a90a4',fontSize:14,flexDirection:'column',gap:8}}>
                  <div style={{width:36,height:36,border:'3px solid #e8ecf0',borderTopColor:TEAL,borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
                  Loading map...
                </div>}
              </div>
              {/* Route result bar */}
              <div id="map-walking-bar" style={{display:'none',background:'#e6fafa',border:`1px solid ${TEAL}33`,borderRadius:12,padding:'10px 14px',marginBottom:8,alignItems:'center',gap:8}}>
                <span style={{color:TEAL,fontSize:14}}>🚶</span>
                <span id="route-text" style={{fontSize:12,color:'#089898',fontWeight:700,flex:1}}></span>
                <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:TEAL}}><span style={{width:7,height:7,borderRadius:'50%',background:TEAL,display:'inline-block'}}/>Walking</span>
              </div>
              {/* Default hint */}
              <div id="map-tap-hint" style={{background:'#e6fafa',border:`1px solid ${TEAL}33`,borderRadius:12,padding:'10px 14px',marginBottom:20,display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:TEAL,fontSize:13}}>👣</span>
                <span style={{fontSize:12,color:'#089898',fontWeight:600}}>Tap any location to get walking time</span>
                <span style={{marginLeft:'auto',fontSize:11,color:TEAL,display:'flex',alignItems:'center',gap:4}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:TEAL,display:'inline-block'}}/>Walking
                </span>
              </div>
              <h3 style={{margin:'0 0 12px',fontSize:15,fontWeight:800,color:DARK}}>Nearby Locations</h3>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:10}}>
                {(nearbyLocations.length > 0 ? nearbyLocations : []).map(loc=>(
                  <div key={loc.id||loc.name} onClick={()=>flyToNearby(loc)} style={{background:'#fff',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',boxShadow:'0 1px 3px rgba(0,0,0,.05)',transition:'box-shadow .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.05)'}>
                    <div style={{width:32,height:32,borderRadius:8,background:'#f0fafa',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>
                      {loc.category==='eatery'?'🍽️':loc.category==='hostel'?'🏠':loc.category==='sports'?'⚽':'📍'}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:DARK,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{loc.name}</div>
                      <div style={{fontSize:11,color:'#7a90a4'}}>{loc.description||loc.category} · Tap to navigate</div>
                    </div>
                    <IcChevron/>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ORDERS */}
          {tab==='orders' && (
            <>
              <h2 style={{margin:'0 0 20px',fontSize:20,fontWeight:800,color:DARK}}>Your Orders</h2>

              {/* ── LIVE TRACKING CARD ── */}
              {trackedOrder&&!['delivered','cancelled'].includes(trackedOrder.status)&&(
                <div style={{background:'#fff',borderRadius:16,padding:20,marginBottom:20,boxShadow:'0 2px 12px rgba(0,0,0,.07)',border:`1px solid ${TEAL}33`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:8,height:8,background:'#ef4444',borderRadius:'50%',display:'inline-block',animation:'pulse 1.5s ease-in-out infinite'}}/>
                      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:DARK}}>Live Tracking</h3>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:20,background:`${statusColors[trackedOrder.status]}18`,color:statusColors[trackedOrder.status]}}>
                      {statusLabels[trackedOrder.status]}
                    </span>
                  </div>

                  {/* Vendor info */}
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,padding:'10px 12px',background:BG,borderRadius:12}}>
                    <div style={{width:38,height:38,borderRadius:10,background:TEAL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🍽️</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:DARK}}>{trackedOrder.vendor_name}</div>
                      <div style={{fontSize:11,color:'#7a90a4'}}>Order #{String(trackedOrder.order_id).slice(-6)} · ₦{Number(trackedOrder.total_amount).toLocaleString()}</div>
                    </div>
                    {trackedOrder.driver_phone&&(
                      <a href={`tel:${trackedOrder.driver_phone}`} style={{background:TEAL,color:'#fff',borderRadius:10,padding:'7px 12px',textDecoration:'none',fontSize:12,fontWeight:700}}>📞 Rider</a>
                    )}
                  </div>

                  {/* Step progress */}
                  <div style={{marginBottom:16}}>
                    {(() => {
                      const steps = [
                        {key:'paid',           label:'Paid',        icon:'💳'},
                        {key:'accepted',       label:'Accepted',    icon:'✅'},
                        {key:'preparing',      label:'Preparing',   icon:'👨‍🍳'},
                        {key:'ready',          label:'Ready',       icon:'🟢'},
                        {key:'rider_assigned', label:'Rider',       icon:'🏍️'},
                        {key:'on_the_way',     label:'On the way',  icon:'🚀'},
                        {key:'delivered',      label:'Delivered',   icon:'🎉'},
                      ];
                      const currentIdx = steps.findIndex(s=>s.key===trackedOrder.status);
                      return (
                        <div style={{display:'flex',alignItems:'center'}}>
                          {steps.map((s,i)=>{
                            const done = i <= currentIdx;
                            const active = i === currentIdx;
                            return (
                              <div key={s.key} style={{display:'flex',alignItems:'center',flex:i<steps.length-1?1:'none'}}>
                                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                                  <div style={{width:32,height:32,borderRadius:'50%',background:done?TEAL:'#e8ecf0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:done?14:12,fontWeight:700,color:done?'#fff':'#b0bec5',boxShadow:active?`0 0 0 3px ${TEAL}44`:'none',transition:'all .3s'}}>
                                    {done?s.icon:i+1}
                                  </div>
                                  <span style={{fontSize:9,fontWeight:active?700:500,color:done?TEAL:'#b0bec5',textAlign:'center',whiteSpace:'nowrap'}}>{s.label}</span>
                                </div>
                                {i<steps.length-1&&<div style={{flex:1,height:3,background:done&&i<currentIdx?TEAL:'#e8ecf0',margin:'0 4px',marginBottom:14,borderRadius:2,transition:'background .3s'}}/>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Rider info if assigned */}
                  {trackedOrder.driver_name&&(
                    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'#f0fafa',borderRadius:12,marginBottom:12}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:TEAL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🏍️</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:DARK}}>{trackedOrder.driver_name}</div>
                        <div style={{fontSize:11,color:'#7a90a4'}}>Your rider · On the way to you</div>
                      </div>
                      <div style={{marginLeft:'auto',display:'flex',gap:6}}>
                        <div style={{textAlign:'center'}}>
                          <div style={{fontWeight:800,fontSize:14,color:TEAL}}>~{trackedOrder.estimated_delivery_time||30}</div>
                          <div style={{fontSize:9,color:'#7a90a4'}}>mins ETA</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Delete if stuck pending */}
                  {trackedOrder.status==='pending'&&(
                    <button onClick={()=>deleteOrder(trackedOrder.order_id)}
                      style={{background:'#fff0f0',color:'#e74c3c',border:'none',borderRadius:10,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:12,width:'100%'}}>
                      Cancel this order
                    </button>
                  )}
                  {trackedOrder.status==='paid'&&(
                    <div style={{background:'#fff8e1',border:'1px solid #ffc107',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#856404',textAlign:'center'}}>
                      Order cannot be cancelled after payment. Contact support if needed.
                    </div>
                  )}

                  {/* Order items */}
                  <div style={{background:BG,borderRadius:12,padding:'10px 14px'}}>
                    <p style={{margin:'0 0 8px',fontSize:11,fontWeight:700,color:'#7a90a4',textTransform:'uppercase',letterSpacing:.5}}>Your Items</p>
                    {trackedOrder.items?.map((item,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:i<trackedOrder.items.length-1?4:0}}>
                        <span style={{color:DARK}}>{item.item_name} ×{item.quantity}</span>
                        <span style={{fontWeight:600,color:'#7a90a4'}}>₦{(item.price*item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ORDER HISTORY grouped by vendor ── */}
              {orders.filter(o=>['delivered','cancelled'].includes(o.status)).length > 0 && (
                <>
                  <h3 style={{margin:'0 0 12px',fontSize:13,fontWeight:700,color:'#7a90a4',textTransform:'uppercase',letterSpacing:.5}}>Order History</h3>
                  {/* Group by vendor */}
                  {Object.entries(
                    orders.filter(o=>['delivered','cancelled'].includes(o.status))
                      .reduce((acc,o)=>{
                        const key = o.vendor_name||'Unknown';
                        if (!acc[key]) acc[key]={vendor_name:key,logo_url:o.logo_url,orders:[]};
                        acc[key].orders.push(o);
                        return acc;
                      },{})
                  ).map(([vendorName, group])=>(
                    <div key={vendorName} style={{background:'#fff',borderRadius:16,overflow:'hidden',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                      {/* Vendor header */}
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:'1px solid #f0f0f0',background:'#fafafa'}}>
                        <div style={{width:36,height:36,borderRadius:10,background:TEAL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,overflow:'hidden',flexShrink:0}}>
                          {group.logo_url?<img src={group.logo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:'🍽️'}
                        </div>
                        <span style={{fontWeight:800,fontSize:14,color:DARK}}>{vendorName}</span>
                        <span style={{marginLeft:'auto',fontSize:11,color:'#7a90a4'}}>{group.orders.length} order{group.orders.length>1?'s':''}</span>
                      </div>
                      {/* Orders under this vendor */}
                      {group.orders.map((o,i)=>(
                        <div key={o.order_id} style={{padding:'14px 16px',borderBottom:i<group.orders.length-1?'1px solid #f5f5f5':'none'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                            <div>
                              <div style={{fontSize:12,color:'#7a90a4'}}>{new Date(o.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</div>
                              <div style={{fontSize:12,color:'#7a90a4',marginTop:2}}>{o.items?.map(i=>`${i.item_name} ×${i.quantity}`).join(' · ')}</div>
                            </div>
                            <span style={{fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,background:o.status==='delivered'?'#dcfce7':'#fee2e2',color:o.status==='delivered'?'#16a34a':'#dc2626',flexShrink:0}}>
                              {o.status==='delivered'?'Delivered ✓':'Cancelled'}
                            </span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span style={{fontWeight:800,fontSize:14,color:TEAL}}>₦{Number(o.total_amount).toLocaleString()}</span>
                            <div style={{display:'flex',gap:6}}>
                              {o.status==='delivered'&&<button onClick={()=>setRatingModal(o)} style={{background:'#fff8e1',color:'#92400e',border:'none',borderRadius:8,padding:'6px 10px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>⭐ Rate</button>}
                              <button onClick={()=>{o.items?.forEach(i=>addItem({menu_id:i.menu_id,item_name:i.item_name,price:i.price},o.vendor_id,o.vendor_name));setCartOpen(true);}}
                                style={{background:TEAL,color:'#fff',border:'none',borderRadius:8,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Reorder</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}

              {orders.length===0&&(
                <div style={{textAlign:'center',padding:'60px 20px',color:'#7a90a4'}}>
                  <div style={{fontSize:52,marginBottom:12}}>📦</div>
                  <p style={{fontSize:14,marginBottom:16}}>No orders yet. Start ordering!</p>
                  <button onClick={()=>setTab('home')} style={{background:TEAL,color:'#fff',border:'none',borderRadius:20,padding:'10px 24px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Browse Eateries</button>
                </div>
              )}
            </>
          )}

          {/* PROFILE */}
          {tab==='profile' && (
            <div style={{maxWidth:480}}>
              <div style={{background:'#fff',borderRadius:20,padding:28,marginBottom:16,textAlign:'center',boxShadow:'0 2px 12px rgba(0,0,0,.06)'}}>
                <div style={{width:80,height:80,background:`linear-gradient(135deg,${TEAL},#089898)`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:32,color:'#fff',fontWeight:900,boxShadow:'0 4px 16px rgba(11,191,191,.3)'}}>
                  {user?.fullname?.[0]?.toUpperCase()||'S'}
                </div>
                <h2 style={{margin:'0 0 4px',fontWeight:900,color:DARK}}>{user?.fullname}</h2>
                <p style={{margin:0,color:'#7a90a4',fontSize:13}}>{user?.email}</p>
                <span style={{display:'inline-block',marginTop:8,background:'#e6fafa',color:TEAL,fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:20}}>Student</span>
              </div>
              <div style={{background:'#fff',borderRadius:16,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                {[['📦','My Orders','orders'],['🗺️','Campus Map','map'],['🏠','Home','home']].map(([icon,label,target],i,arr)=>(
                  <button key={target} onClick={()=>setTab(target)}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'16px 18px',border:'none',borderBottom:i<arr.length-1?'1px solid #f0f0f0':'none',background:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
                    <span style={{fontSize:20}}>{icon}</span>
                    <span style={{fontWeight:600,fontSize:14,color:DARK}}>{label}</span>
                    <span style={{marginLeft:'auto'}}><IcChevron/></span>
                  </button>
                ))}
                <button onClick={logout} style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'16px 18px',border:'none',borderTop:'1px solid #f0f0f0',background:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
                  <span style={{fontSize:20}}>🚪</span>
                  <span style={{fontWeight:600,fontSize:14,color:'#dc2626'}}>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM NAV - centered with padding */}
      {isMobile && (
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:'1px solid #e8ecf0',zIndex:200,paddingBottom:'env(safe-area-inset-bottom,4px)'}}>
          <div style={{display:'flex',maxWidth:480,margin:'0 auto',padding:'0 16px'}}>
            {NAV.map(n=>{
              const active=tab===n.id;
              return (
                <button key={n.id} onClick={()=>{setTab(n.id);setSelectedVendor(null);}}
                  style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'8px 0',border:'none',background:'none',cursor:'pointer',fontFamily:'inherit',color:active?TEAL:'#7a90a4'}}>
                  <div style={{padding:'4px 16px',borderRadius:12,background:active?'#e6fafa':'none'}}>{n.icon}</div>
                  <span style={{fontSize:9,fontWeight:active?700:500}}>{n.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CART DRAWER — multi-vendor */}
      {cartOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setCartOpen(false)}>
          <div style={{background:'#fff',borderRadius:'24px 24px 0 0',width:'100%',maxWidth:520,maxHeight:'88vh',overflowY:'auto',padding:'20px 22px 32px'}} onClick={e=>e.stopPropagation()}>
            <div style={{width:40,height:4,background:'#e4e6ef',borderRadius:2,margin:'0 auto 14px'}}/>
            <h3 style={{margin:'0 0 4px',fontSize:18,fontWeight:800,color:DARK}}>Your Cart</h3>
            {vendorList.length === 0 ? (
              <p style={{textAlign:'center',color:'#7a90a4',padding:'32px 0'}}>Your cart is empty</p>
            ) : (
              <>
                {vendorList.length > 1 && (
                  <div style={{background:'#fff8e1',border:'1px solid #ffe082',borderRadius:10,padding:'8px 12px',marginBottom:14,fontSize:12,color:'#92400e'}}>
                    🛒 You have items from <b>{vendorList.length} eateries</b>. Each is a separate order and payment.
                  </div>
                )}
                {vendorList.length > 1 && (
                  <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none'}}>
                    {vendorList.map(v=>(
                      <button key={v.vendorId} onClick={()=>setCheckoutVendorId(checkoutVendorId===v.vendorId?null:v.vendorId)}
                        style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${checkoutVendorId===v.vendorId?TEAL:'#e8ecf0'}`,background:checkoutVendorId===v.vendorId?TEAL:'#fff',color:checkoutVendorId===v.vendorId?'#fff':DARK,fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',flexShrink:0}}>
                        {v.vendorName} ({v.itemCount})
                      </button>
                    ))}
                  </div>
                )}
                {vendorList.filter(v => vendorList.length===1 || !checkoutVendorId || v.vendorId===checkoutVendorId).map(v => {
                  const subtotal = v.total; // already includes portions (qty × price × portions)
                  const noPackCats = ['bakery','foodstuff','drinks'];
                  const vendorCat = vendors.find(vn=>vn.vendor_id===v.vendorId)?.category;
                  // No packing if: vendor is drinks/bakery/foodstuff category
                  // OR if ALL items in cart are drinks
                  const allDrinks = v.items.every(i => i.item_type === 'drink');
                  const vPacking = noPackCats.includes(vendorCat) || allDrinks ? 0 : 200;
                  const serviceFee = Math.round(subtotal * 0.07);
                  const grandTotal = subtotal + 300 + vPacking + serviceFee;
                  return (
                    <div key={v.vendorId} style={{marginBottom:vendorList.length>1&&!checkoutVendorId?24:0}}>
                      {vendorList.length>1&&!checkoutVendorId&&(
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,paddingBottom:8,borderBottom:'2px solid #f0fafa'}}>
                          <span style={{fontSize:16}}>🍽️</span>
                          <span style={{fontWeight:800,fontSize:14,color:DARK}}>{v.vendorName}</span>
                          <button onClick={()=>clearVendorCart(v.vendorId)} style={{marginLeft:'auto',background:'none',border:'none',color:'#ccc',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>✕ Clear</button>
                        </div>
                      )}
                      {v.items.map(item=>(
                        <div key={item.menu_id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0',borderBottom:'1px solid #f8f8f8'}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:14,color:DARK}}>{item.item_name}</div>
                            <div style={{fontSize:12,color:'#7a90a4',display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                              <span>₦{Number(item.price).toLocaleString()} × {item.quantity}</span>
                              {item.portions>1&&<span style={{background:'#e6fafa',color:'#089898',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}}>{item.portions} portions/pack</span>}
                              <span style={{color:'#089898',fontWeight:600}}>= ₦{(item.price*item.quantity*item.portions).toLocaleString()}</span>
                            </div>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <button onClick={()=>removeItem(item.menu_id,v.vendorId)} style={{width:28,height:28,borderRadius:7,border:'none',background:'#f0fafa',cursor:'pointer',fontSize:16,color:TEAL,fontWeight:700}}>-</button>
                            <span style={{fontWeight:700,minWidth:20,textAlign:'center'}}>{item.quantity}</span>
                            <button onClick={()=>addItem({menu_id:item.menu_id,item_name:item.item_name,price:item.price},v.vendorId,v.vendorName)} style={{width:28,height:28,borderRadius:7,border:'none',background:TEAL,cursor:'pointer',fontSize:16,color:'#fff',fontWeight:700}}>+</button>
                          </div>
                        </div>
                      ))}
                      <div style={{padding:'10px 0',borderBottom:'1px solid #f0f0f0'}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#7a90a4',marginBottom:5}}><span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span></div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#7a90a4',marginBottom:5}}><span>Delivery fee</span><span>₦300</span></div>
                        {vPacking>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#7a90a4',marginBottom:5}}><span>Packing fee <span style={{fontSize:10}}>(1 pack)</span></span><span>₦{vPacking}</span></div>}
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#f59e0b',marginBottom:2}}><span>Service fee (7%) </span><span>₦{serviceFee}</span></div>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:16,padding:'10px 0 14px',color:DARK}}>
                        <span>Total</span><span style={{color:TEAL}}>₦{grandTotal.toLocaleString()}</span>
                      </div>
                      <button onClick={()=>openDeliveryModal(v.vendorId, v.vendorName)} disabled={checkoutLoading}
                        style={{width:'100%',padding:13,background:TEAL,color:'#fff',border:'none',borderRadius:14,fontWeight:700,fontSize:14,cursor:checkoutLoading?'not-allowed':'pointer',opacity:checkoutLoading?0.7:1,fontFamily:'inherit'}}>
                        {checkoutLoading?'Processing...':`Continue to pay ₦${grandTotal.toLocaleString()} — ${v.vendorName}`}
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
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setDeliveryModal(null)}>
          <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:400,padding:28}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 6px',fontWeight:800,color:DARK}}>Where should we deliver?</h3>
            <p style={{margin:'0 0 18px',fontSize:13,color:'#7a90a4'}}>Enter your hostel, hall, or location on campus</p>
            <input
              autoFocus
              type="text"
              value={deliveryAddr}
              onChange={e=>setDeliveryAddr(e.target.value)}
              placeholder="e.g. Hall 6, Room 204 or SUB Gate"
              style={{width:'100%',padding:'12px 14px',border:'1.5px solid #e8ecf0',borderRadius:12,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:14}}
            />
            <div style={{background:'#e6fafa',borderRadius:12,padding:'10px 14px',marginBottom:18,fontSize:12,color:'#089898'}}>
              💡 Your location helps the rider find you. Be specific — include room number if possible.
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setDeliveryModal(null)} style={{flex:1,padding:12,border:'1px solid #e8ecf0',borderRadius:12,background:'#fff',cursor:'pointer',fontFamily:'inherit',fontWeight:600,color:'#7a90a4'}}>Cancel</button>
              <button onClick={()=>handleCheckout(deliveryModal.vendorId)} disabled={!deliveryAddr.trim()||checkoutLoading}
                style={{flex:2,padding:12,background:deliveryAddr.trim()?TEAL:'#ccc',color:'#fff',border:'none',borderRadius:12,fontWeight:700,fontSize:14,cursor:deliveryAddr.trim()?'pointer':'not-allowed',fontFamily:'inherit'}}>
                {checkoutLoading?'Processing...':'Confirm & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM / ALERT MODAL */}
      {confirmModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:340,padding:28,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <h3 style={{margin:'0 0 10px',fontWeight:800,color:DARK,fontSize:17}}>{confirmModal.title}</h3>
            <p style={{margin:'0 0 24px',fontSize:14,color:'#7a90a4',lineHeight:1.6}}>{confirmModal.message}</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setConfirmModal(null)}
                style={{flex:1,padding:12,border:'1px solid #e8ecf0',borderRadius:12,background:'#fff',cursor:'pointer',fontFamily:'inherit',fontWeight:600,color:'#7a90a4',fontSize:14}}>
                {confirmModal.onConfirm ? 'Cancel' : 'OK'}
              </button>
              {confirmModal.onConfirm && (
                <button onClick={confirmModal.onConfirm}
                  style={{flex:1,padding:12,border:'none',borderRadius:12,background:'#e74c3c',color:'#fff',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:14}}>
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast&&(
        <div style={{position:'fixed',bottom:isMobile?72:24,left:'50%',transform:'translateX(-50%)',background:DARK,color:'#fff',padding:'10px 20px',borderRadius:30,fontSize:13,fontWeight:600,zIndex:600,whiteSpace:'nowrap',boxShadow:'0 4px 16px rgba(0,0,0,.2)',animation:'fadeIn .2s ease'}}>
          {toast}
        </div>
      )}

      {ratingModal&&<RatingModal order={ratingModal} onClose={()=>setRatingModal(null)} onSubmit={async(oid,vr,dr)=>{try{await api.post('/ratings',{order_id:oid,vendor_rating:vr,driver_rating:dr});setRatingModal(null);showToast('Rating submitted!');}catch{}}}/>}

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

function RatingModal({order,onClose,onSubmit}) {
  const [vR,setVR]=useState(5);const[dR,setDR]=useState(5);
  const Stars=({value,onChange})=>(
    <div style={{display:'flex',gap:4}}>
      {[1,2,3,4,5].map(s=><button key={s} onClick={()=>onChange(s)} style={{background:'none',border:'none',cursor:'pointer',fontSize:26,color:s<=value?'#f59e0b':'#e4e6ef'}}>★</button>)}
    </div>
  );
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:20,padding:28,width:'100%',maxWidth:360}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:'0 0 20px',fontWeight:800}}>Rate your experience</h3>
        <div style={{marginBottom:18}}>
          <p style={{fontSize:14,fontWeight:600,marginBottom:8}}> {order.vendor_name}</p>
          <Stars value={vR} onChange={setVR}/>
        </div>
        {order.driver_name&&<div style={{marginBottom:18}}><p style={{fontSize:14,fontWeight:600,marginBottom:8}}> Rider: {order.driver_name}</p><Stars value={dR} onChange={setDR}/></div>}
        <button onClick={()=>onSubmit(order.order_id,vR,dR)} style={{width:'100%',padding:12,background:'#0BBFBF',color:'#fff',border:'none',borderRadius:12,fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Submit Rating</button>
      </div>
    </div>
  );
}
