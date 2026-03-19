/**
 * UnimapPlus — ML Recommendation Engine
 * 
 * Algorithm: Collaborative Filtering + Context Awareness
 * 
 * Factors weighted:
 *   1. User's personal order history (what they usually order)
 *   2. Weather context (hot → cold drinks, rainy → soups)
 *   3. Time of day (morning → light, afternoon → filling, evening → comfort)
 *   4. Item popularity across all users in same school
 *   5. Vendor is currently open
 * 
 * Returns top 3 recommended items with reasoning.
 */

const pool = require('../config/db');

// Weather → food tag mappings
const WEATHER_TAGS = {
  hot:   ['cold', 'chilled', 'drink', 'light', 'salad', 'smoothie', 'zobo', 'ice'],
  warm:  ['light', 'snack', 'shawarma', 'sandwich', 'wrap'],
  cool:  ['soup', 'stew', 'rice', 'filling', 'hearty', 'jollof'],
  rainy: ['hot', 'soup', 'pepper', 'warm', 'comfort', 'stew', 'ofe'],
};

const TIME_TAGS = {
  morning:   ['light', 'snack', 'breakfast', 'quick', 'bread', 'egg'],
  afternoon: ['rice', 'protein', 'filling', 'lunch', 'stew'],
  evening:   ['comfort', 'soup', 'stew', 'full', 'dinner'],
  night:     ['light', 'snack', 'quick', 'soup'],
};

function getTimeSlot(hour) {
  if (hour >= 6  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getWeatherContext(temp, weatherDesc = '') {
  const desc = weatherDesc.toLowerCase();
  if (desc.includes('rain') || desc.includes('storm') || desc.includes('shower')) return 'rainy';
  if (temp >= 33) return 'hot';
  if (temp >= 28) return 'warm';
  return 'cool';
}

// Items that are BAD in certain weather (hard penalty/filter)
const WEATHER_BAD_MATCH = {
  rainy: ['ice cream', 'cold', 'chilled', 'frozen', 'smoothie', 'ice'],
  hot:   ['hot', 'pepper soup', 'ofe', 'egusi', 'stew', 'heavy'],
  cool:  [], // nothing is really bad in cool weather
  warm:  [], // nothing is really bad in warm weather
};

// Items that are BAD at certain times
const TIME_BAD_MATCH = {
  morning: ['heavy', 'full', 'dinner'],
  night:   ['heavy meal'],
  afternoon: [],
  evening: [],
};

/**
 * Score a menu item based on context + user history
 * Weather is a GATE — bad weather matches apply a hard penalty
 * that can override even strong personal history
 */
function scoreItem(item, userOrderCounts, weatherContext, timeSlot, popularityMap) {
  let score = 0;
  const tags = (() => {
    try { return JSON.parse(item.tags || '[]').map(t => t.toLowerCase()); }
    catch { return []; }
  })();
  const name = (item.item_name || '').toLowerCase();
  const fullText = name + ' ' + tags.join(' ');

  // === WEATHER GATE — check for bad matches first ===
  const badWeatherWords = WEATHER_BAD_MATCH[weatherContext] || [];
  const isBadWeatherMatch = badWeatherWords.some(kw => fullText.includes(kw));
  
  // If it's a bad weather match, apply a heavy penalty
  // This ensures ice cream won't be recommended on a cold/rainy day
  // even if the user orders it all the time
  if (isBadWeatherMatch) {
    score -= 60; // strong enough to kill even frequent personal orders
  }

  // === TIME GATE — check for bad time matches ===
  const badTimeWords = TIME_BAD_MATCH[timeSlot] || [];
  const isBadTimeMatch = badTimeWords.some(kw => fullText.includes(kw));
  if (isBadTimeMatch) {
    score -= 30;
  }

  // 1. PERSONAL HISTORY (weight: 40% but capped at 50pts so weather gate wins)
  const personalOrders = Math.min(userOrderCounts[item.menu_id] || 0, 5);
  score += personalOrders * 10; // max 50pts from history

  // 2. WEATHER MATCH — positive bonus (weight: 25%)
  const weatherKeywords = WEATHER_TAGS[weatherContext] || [];
  const weatherMatches = weatherKeywords.filter(kw => fullText.includes(kw)).length;
  score += weatherMatches * 25;

  // 3. TIME OF DAY MATCH — (weight: 20%)
  const timeKeywords = TIME_TAGS[timeSlot] || [];
  const timeMatches = timeKeywords.filter(kw => fullText.includes(kw)).length;
  score += timeMatches * 20;

  // 4. CAMPUS POPULARITY — (weight: 15%)
  const popularity = popularityMap[item.menu_id] || 0;
  score += Math.min(popularity, 10) * 1.5;

  // 5. BONUS: vendor is open
  if (item.is_open) score += 10;

  return score;
}

/**
 * GET /api/recommendations
 * Query params: temp, weather_desc, school_id
 */
async function getRecommendations(req, res) {
  try {
    const studentId = req.user.id;
    const { temp = 28, weather_desc = '', school_id } = req.query;
    const tempNum = parseFloat(temp);
    const hour = new Date().getHours();
    const timeSlot = getTimeSlot(hour);
    const weatherContext = getWeatherContext(tempNum, weather_desc);

    // 1. Get user's order history — count how many times each item was ordered
    const [history] = await pool.query(`
      SELECT oi.menu_id, COUNT(*) as order_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE o.student_id = ? AND o.status = 'delivered'
      GROUP BY oi.menu_id
      ORDER BY order_count DESC
    `, [studentId]);

    const userOrderCounts = {};
    history.forEach(h => { userOrderCounts[h.menu_id] = parseInt(h.order_count); });

    // 2. Get campus-wide popularity (what other students order most)
    const [popular] = await pool.query(`
      SELECT oi.menu_id, COUNT(*) as total_orders
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      JOIN vendors_tb v ON o.vendor_id = v.vendor_id
      WHERE o.status = 'delivered'
        AND (v.school_id = ? OR ? IS NULL)
        AND o.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY oi.menu_id
    `, [school_id || null, school_id || null]);

    const popularityMap = {};
    popular.forEach(p => { popularityMap[p.menu_id] = parseInt(p.total_orders); });

    // 3. Get all available menu items from open vendors
    const [items] = await pool.query(`
      SELECT m.*, v.vendor_name, v.is_open, v.vendor_id,
             v.category as vendor_category
      FROM menu_items m
      JOIN vendors_tb v ON m.vendor_id = v.vendor_id
      WHERE m.is_available = TRUE
        AND v.is_open = TRUE
        AND (v.school_id = ? OR ? IS NULL)
      ORDER BY RAND()
      LIMIT 100
    `, [school_id || null, school_id || null]);

    // 4. Score each item
    const scored = items.map(item => ({
      ...item,
      score: scoreItem(item, userOrderCounts, weatherContext, timeSlot, popularityMap),
      is_personal: (userOrderCounts[item.menu_id] || 0) > 0,
    }));

    // 5. Sort by score, take top 5 then pick 3 diverse ones (different vendors if possible)
    scored.sort((a, b) => b.score - a.score);

    const top = [];
    const usedVendors = new Set();
    for (const item of scored) {
      if (top.length >= 3) break;
      // Prefer items from different vendors for diversity
      if (!usedVendors.has(item.vendor_id) || top.length < 2) {
        top.push(item);
        usedVendors.add(item.vendor_id);
      }
    }

    // 6. Generate human-readable reasoning
    const reason = (() => {
      const d = weather_desc || '';
      if (d.toLowerCase().includes('rain'))
        return 'Rainy day on campus 🌧️ — stay in, order hot pepper soup or ofe onugbu. Warm and comforting.';
      if (tempNum >= 34)
        return hour < 12
          ? 'Already scorching this morning ☀️ — start with something cold. Zobo or chilled drinks are calling.'
          : hour < 17
          ? 'Afternoon heat is real 🥵 — cold drinks, light snacks, or a chilled shawarma. Stay refreshed.'
          : 'Warm evening today 🌇 — order something to keep you cool. Zobo, cold drinks, or light bites.';
      if (tempNum >= 30)
        return hour < 12
          ? 'Warm morning ahead ☀️ — grab something light before lectures.'
          : hour < 17
          ? "It's warm out there 🌤️ — a cold drink with your meal hits differently right now."
          : 'Nice warm evening 🌆 — perfect time for a full meal. Jollof, soups, or your favourite buka food.';
      if (tempNum >= 25)
        return hour < 12
          ? 'Cool morning vibes ⛅ — fuel up before the day gets busy.'
          : hour < 17
          ? 'Good afternoon weather for a proper meal 🍽️ — treat yourself between classes.'
          : 'Cool evening on campus 🌙 — great time to order your favourite comfort food.';
      return hour < 12
        ? 'Fresh morning 🌿 — start your day right with something filling.'
        : hour < 17
        ? 'Good weather for a nice meal. Pick something hearty!'
        : 'Cool night ahead 🌙 — warm food hits different. Soups, stews, or a hot plate of rice.';
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

/**
 * GET /api/recommendations/stats
 * Returns user preference insights (for future ML dashboard)
 */
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
