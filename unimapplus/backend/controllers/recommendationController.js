/**
 * UnimapPlus — Recommendation Engine
 *
 * Factors:
 *   1. Weather context (primary signal — mapped to item categories/types)
 *   2. Time of day
 *   3. Campus popularity (last 30 days, same school)
 *   4. Personal history (diversity tie-breaker only — capped so it can't dominate)
 *   5. Vendor is open
 *   6. Excludes foodstuff vendors
 *   7. Enforces diversity across vendors AND item types
 */

const pool = require('../config/db');

// Weather context → preferred item types / categories
const WEATHER_PREFERRED = {
  hot:   ['drink', 'smoothie', 'snack', 'light', 'cold', 'chilled', 'zobo', 'ice cream', 'salad', 'fruit'],
  warm:  ['snack', 'shawarma', 'sandwich', 'wrap', 'light', 'drink'],
  cool:  ['rice', 'soup', 'stew', 'jollof', 'pasta', 'protein', 'beans', 'yam', 'swallow', 'banga', 'egusi', 'ofe'],
  rainy: ['soup', 'pepper', 'stew', 'hot', 'swallow', 'ofe', 'egusi', 'banga', 'oha', 'rice', 'tea', 'pap', 'akamu'],
};

// Weather context → items that should NOT appear
const WEATHER_EXCLUDED = {
  hot:   ['pepper soup', 'ofe', 'egusi', 'hot chocolate', 'heavy'],
  warm:  [],
  cool:  ['ice cream', 'frozen'],
  rainy: ['ice cream', 'cold drink', 'smoothie', 'chilled', 'frozen', 'ice'],
};

// Vendor category → weather fit (must match exact values from vendors_tb.category)
// african_food, fast_food, snacks, drinks, bakery, foodstuff
const CATEGORY_WEATHER_FIT = {
  hot:   ['drinks', 'snacks'],
  warm:  ['snacks', 'fast_food', 'bakery'],
  cool:  ['african_food', 'fast_food'],
  rainy: ['african_food'],
};

const TIME_PREFERRED = {
  morning:   ['bread', 'egg', 'tea', 'akara', 'pap', 'oat', 'light', 'snack', 'quick', 'breakfast', 'akamu'],
  afternoon: ['rice', 'protein', 'filling', 'lunch', 'stew', 'swallow', 'beans', 'jollof', 'fried rice'],
  evening:   ['soup', 'stew', 'swallow', 'comfort', 'dinner', 'full', 'pasta', 'chicken'],
  night:     ['light', 'snack', 'quick', 'soup', 'small chops'],
};

function getTimeSlot(hour) {
  if (hour >= 6  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getWeatherContext(temp, weatherDesc = '') {
  const desc = weatherDesc.toLowerCase();
  // Thunderstorm at high temp is still hot weather for food purposes
  // Only treat as rainy if it's actually raining AND not very hot
  const isRaining = desc.includes('rain') || desc.includes('shower') || desc.includes('drizzle');
  const isThunderstorm = desc.includes('thunderstorm');
  if (isRaining && !isThunderstorm && temp < 32) return 'rainy';
  if (temp >= 33) return 'hot';
  if (temp >= 28) return 'warm';
  return 'cool';
}

function scoreItem(item, userOrderCounts, weatherContext, timeSlot, popularityMap) {
  let score = 0;

  const name = (item.item_name || '').toLowerCase();
  const vendorCat = (item.vendor_category || '').toLowerCase();
  const tags = (() => {
    try { return JSON.parse(item.tags || '[]').map(t => t.toLowerCase()); }
    catch { return []; }
  })();
  const fullText = name + ' ' + tags.join(' ');

  // === HARD EXCLUDE — bad weather match kills the item ===
  const excluded = WEATHER_EXCLUDED[weatherContext] || [];
  if (excluded.some(kw => fullText.includes(kw))) {
    return -999;
  }

  // === 1. WEATHER MATCH (40pts max) — name/tag keyword match ===
  const weatherKeywords = WEATHER_PREFERRED[weatherContext] || [];
  const weatherMatches = weatherKeywords.filter(kw => fullText.includes(kw)).length;
  score += Math.min(weatherMatches * 20, 40);

  // === 2. VENDOR CATEGORY WEATHER FIT (20pts) ===
  const catFit = CATEGORY_WEATHER_FIT[weatherContext] || [];
  if (catFit.some(c => vendorCat.includes(c))) {
    score += 20;
  }

  // === 3. TIME OF DAY MATCH (20pts max) ===
  const timeKeywords = TIME_PREFERRED[timeSlot] || [];
  const timeMatches = timeKeywords.filter(kw => fullText.includes(kw)).length;
  score += Math.min(timeMatches * 10, 20);

  // === 4. CAMPUS POPULARITY (15pts max — normalised) ===
  const popularity = popularityMap[item.menu_id] || 0;
  score += Math.min(popularity * 1.5, 15);

  // === 5. PERSONAL HISTORY (10pts max — diversity tie-breaker only) ===
  const personalOrders = Math.min(userOrderCounts[item.menu_id] || 0, 2);
  score += personalOrders * 5;

  // === 6. VENDOR OPEN BONUS ===
  if (item.is_open) score += 5;

  return score;
}

async function getRecommendations(req, res) {
  try {
    const studentId = req.user.id;
    const { temp = 28, weather_desc = '', school_id } = req.query;
    const tempNum = parseFloat(temp);
    const hour = new Date().getHours();
    const timeSlot = getTimeSlot(hour);
    const weatherContext = getWeatherContext(tempNum, weather_desc);

    // 1. User order history (capped — only used as tie-breaker)
    const [history] = await pool.query(`
      SELECT oi.menu_id, COUNT(*) as order_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE o.student_id = ? AND o.status = 'delivered'
      GROUP BY oi.menu_id
      ORDER BY order_count DESC
      LIMIT 20
    `, [studentId]);

    const userOrderCounts = {};
    history.forEach(h => { userOrderCounts[h.menu_id] = parseInt(h.order_count); });

    // 2. Campus-wide popularity (last 30 days, same school)
    const [popular] = await pool.query(`
      SELECT oi.menu_id, COUNT(*) as total_orders
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      JOIN vendors_tb v ON o.vendor_id = v.vendor_id
      WHERE o.status = 'delivered'
        AND o.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND (v.school_id = ? OR ? IS NULL)
      GROUP BY oi.menu_id
    `, [school_id || null, school_id || null]);

    const popularityMap = {};
    popular.forEach(p => { popularityMap[p.menu_id] = parseInt(p.total_orders); });

    // 3. All available items — exclude foodstuff vendors entirely
    const [items] = await pool.query(`
      SELECT m.*, v.vendor_name, v.is_open, v.vendor_id,
             v.category as vendor_category
      FROM menu_items m
      JOIN vendors_tb v ON m.vendor_id = v.vendor_id
      WHERE m.is_available = TRUE
        AND v.is_open = TRUE
        AND v.category != 'foodstuff'
        AND (v.school_id = ? OR ? IS NULL)
    `, [school_id || null, school_id || null]);

    // 4. Score all items
    const scored = items
      .map(item => ({
        ...item,
        score: scoreItem(item, userOrderCounts, weatherContext, timeSlot, popularityMap),
        is_personal: (userOrderCounts[item.menu_id] || 0) > 0,
      }))
      .filter(item => item.score > -999)
      .sort((a, b) => b.score - a.score);

    // 5. Pick top 5 with strict diversity:
    //    - No two items from the same vendor
    //    - No two items of the same item_type
    //    - Introduce controlled randomness by shuffling items within score bands
    //      (items within 5pts of each other are treated as equivalent)
    const bandSize = 5;
    // Group into score bands and shuffle within each band
    const bands = [];
    let i = 0;
    while (i < scored.length) {
      const bandScore = scored[i].score;
      const band = [];
      while (i < scored.length && scored[i].score >= bandScore - bandSize) {
        band.push(scored[i]);
        i++;
      }
      // Shuffle within band
      for (let j = band.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [band[j], band[k]] = [band[k], band[j]];
      }
      bands.push(...band);
    }

    const top = [];
    const usedVendors = new Set();
    const usedTypes = new Set();
    for (const item of bands) {
      if (top.length >= 5) break;
      const itype = (item.item_type || 'other').toLowerCase();
      if (usedVendors.has(item.vendor_id)) continue;
      if (usedTypes.has(itype) && top.length >= 2) continue;
      top.push(item);
      usedVendors.add(item.vendor_id);
      usedTypes.add(itype);
    }

    // 6. Weather-aware reason text
    const reason = (() => {
      const d = (weather_desc || '').toLowerCase();
      const t = tempNum;
      const h = hour;
      const isActuallyRainy = (d.includes('rain') || d.includes('shower') || d.includes('drizzle')) && !d.includes('thunderstorm') && t < 32;
      if (isActuallyRainy)
        return 'Rainy day on campus 🌧️ — perfect for something hot and filling. Soups, stews, or a warm plate hit different right now.';
      if (t >= 34)
        return h < 12
          ? 'Already scorching this morning ☀️ — start with something cold or light. Cold drinks and quick bites are calling.' 
          : h < 17
          ? 'Afternoon heat is real 🥵 — cold drinks and light food are your best bet right now.'
          : 'Warm evening 🌇 — keep it light and refreshing.';
      if (t >= 30)
        return h < 12
          ? 'Warm morning ahead ☀️ — grab something light before lectures.'
          : h < 17
          ? 'Warm afternoon 🌤️ — a cold drink alongside your meal hits differently right now.'
          : 'Nice warm evening 🌆 — a full plate of your favourite food sounds right.';
      if (t >= 25)
        return h < 12
          ? 'Cool morning ⛅ — fuel up before the day gets busy.'
          : h < 17
          ? 'Good afternoon weather 🍽️ — treat yourself to a proper meal between classes.'
          : 'Cool evening on campus 🌙 — great time to order your favourite comfort food.';
      return h < 12
        ? 'Fresh morning 🌿 — start your day right with something filling.'
        : h < 17
        ? 'Good weather for a proper meal. Hearty food awaits!'
        : 'Cool night ahead 🌙 — warm soups, stews, or a hot plate of rice.';
    })();

    return res.json({
      success: true,
      recommendations: top.map(item => ({
        menu_id: item.menu_id,
        item_name: item.item_name,
        price: item.price,
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name,
        image_url: item.image_url,
        is_personal: item.is_personal,
        score: Math.round(item.score),
      })),
      context: { timeSlot, weatherContext, temp: tempNum },
      reason,
    });

  } catch (err) {
    console.error('Recommendation error:', err);
    return res.status(500).json({ success: false, message: 'Recommendation failed' });
  }
}

async function getUserPreferenceStats(req, res) {
  try {
    const studentId = req.user.id;

    const [topItems] = await pool.query(`
      SELECT oi.item_name, COUNT(*) as times_ordered, SUM(oi.price * oi.quantity) as total_spent
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE o.student_id = ? AND o.status = 'delivered'
      GROUP BY oi.item_name
      ORDER BY times_ordered DESC
      LIMIT 5
    `, [studentId]);

    const [topVendors] = await pool.query(`
      SELECT v.vendor_name, COUNT(*) as order_count
      FROM orders o
      JOIN vendors_tb v ON o.vendor_id = v.vendor_id
      WHERE o.student_id = ? AND o.status = 'delivered'
      GROUP BY v.vendor_id
      ORDER BY order_count DESC
      LIMIT 3
    `, [studentId]);

    return res.json({
      success: true,
      topItems,
      topVendors,
      message: topItems.length === 0 ? 'Order more to get personalized recommendations!' : null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error' });
  }
}

module.exports = { getRecommendations, getUserPreferenceStats };
