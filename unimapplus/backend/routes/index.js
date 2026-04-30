const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { upload } = require('../config/s3');

const { register, login, sendSchoolEmailOTP, verifySchoolEmailOTP, sendResetOTP, resetPassword, saveBankDetails, getBanks } = require('../controllers/authController');
const { getVendors, getVendorMenu, getFeaturedMenu, addMenuItem, updateMenuItem, deleteMenuItem, getVendorDashboard, toggleOpen, getOrderHistory, updateOrderStatus, toggleStockStatus } = require('../controllers/vendorController');
const { getRecommendations, getUserPreferenceStats } = require('../controllers/recommendationController');
const { checkout, verifyPayment, paystackWebhook, confirmDelivery, getStudentOrders, getOrder, deleteOrder, requestReview, updatePrice, initializePayment } = require('../controllers/orderController');
const { getRiderDashboard, toggleAvailability, acceptOrder, updateDeliveryStatus, updateLocation, getEarningsHistory } = require('../controllers/riderController');
const { getAllLocations, globalSearch, getSchools, addLocation } = require('../controllers/locationController');
const { submitRating } = require('../controllers/ratingController');

// AUTH
router.post('/auth/register', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'verify_doc', maxCount: 1 }]), register);
router.post('/auth/login', login);
router.post('/auth/send-otp', sendSchoolEmailOTP);
router.post('/auth/verify-otp', verifySchoolEmailOTP);
router.post('/auth/send-reset-otp', sendResetOTP);
router.post('/auth/reset-password', resetPassword);
router.get('/auth/banks', getBanks);
router.post('/auth/bank-details', auth, saveBankDetails);

// SCHOOLS
router.get('/schools', getSchools);

// VENDORS (public) 
router.get('/vendors', getVendors);
router.get('/vendors/:vendor_id/menu', getVendorMenu);

// VENDOR (protected)
router.get('/vendor/dashboard', auth, requireRole('vendor'), getVendorDashboard);
router.get('/vendor/orders/history', auth, requireRole('vendor'), getOrderHistory);
router.post('/vendor/toggle-open', auth, requireRole('vendor'), toggleOpen);
router.post('/vendor/menu', auth, requireRole('vendor'), upload.single('image'), addMenuItem);
router.put('/vendor/menu/:menu_id', auth, requireRole('vendor'), upload.single('image'), updateMenuItem);
router.put('/vendor/menu/:menu_id/stock', auth, requireRole('vendor'), toggleStockStatus);
router.delete('/vendor/menu/:menu_id', auth, requireRole('vendor'), deleteMenuItem);
router.put('/vendor/orders/:order_id/status', auth, requireRole('vendor'), updateOrderStatus);
router.post('/vendor/update-price', auth, requireRole('vendor'), updatePrice);

// ORDERS / CHECKOUT 
router.post('/checkout', auth, requireRole('student'), checkout);
router.get('/payment/verify', verifyPayment);
router.post('/paystack/webhook', paystackWebhook);
router.post('/orders/request-review', auth, requireRole('student'), requestReview);
router.post('/orders/initialize-payment', auth, requireRole('student'), initializePayment);

// STUDENT ORDERS
router.get('/student/orders', auth, requireRole('student'), getStudentOrders);
router.get('/orders/:order_id', auth, getOrder);
router.delete('/student/orders/:order_id', auth, requireRole('student'), deleteOrder);


// RATINGS
router.post('/ratings', auth, requireRole('student'), submitRating);

// RIDER
router.get('/rider/dashboard', auth, requireRole('driver'), getRiderDashboard);
router.post('/rider/toggle-availability', auth, requireRole('driver'), toggleAvailability);
router.post('/rider/orders/:order_id/accept', auth, requireRole('driver'), acceptOrder);
router.put('/rider/orders/:order_id/status', auth, requireRole('driver'), updateDeliveryStatus);
router.post('/rider/orders/:order_id/delivered', auth, requireRole('driver'), confirmDelivery);
router.post('/rider/location', auth, requireRole('driver'), updateLocation);
router.get('/rider/earnings', auth, requireRole('driver'), getEarningsHistory);

// LOCATIONS / SEARCH
router.get('/featured-menu', getFeaturedMenu);
router.get('/locations', getAllLocations);
router.post('/locations', addLocation);
router.get('/search', globalSearch);

// ML Recommendations
router.get('/recommendations', auth, requireRole('student'), getRecommendations);
router.get('/recommendations/stats', auth, requireRole('student'), getUserPreferenceStats);

module.exports = router;
