-- ============================================================
-- UnimapPlus Database Schema v3.0 — CLEAN FRESH INSTALL
-- Run this on a brand new Aiven MySQL database
-- ============================================================

-- Using Aiven's defaultdb

CREATE TABLE IF NOT EXISTS schools (
  school_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  location VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schools (name, location) VALUES
  ('University of Benin (UNIBEN)', 'Ugbowo, Benin City, Edo State'),
  ('University of Lagos (UNILAG)', 'Lagos'),
  ('Obafemi Awolowo University (OAU)', 'Ile-Ife, Osun State'),
  ('University of Ibadan (UI)', 'Ibadan, Oyo State'),
  ('Ahmadu Bello University (ABU)', 'Zaria, Kaduna State'),
  ('Igbinedion University Okada (IUO)', 'Okada, Edo State'),
  ('Wellspring University', 'Benin City, Edo State');

CREATE TABLE IF NOT EXISTS students_tb (
  st_id INT AUTO_INCREMENT PRIMARY KEY,
  fullname VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  passwd VARCHAR(255) NOT NULL,
  school_id INT,
  phone VARCHAR(20),
  delivery_address TEXT,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

CREATE TABLE IF NOT EXISTS vendors_tb (
  vendor_id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  passwd VARCHAR(255) NOT NULL,
  school_id INT,
  phone VARCHAR(20),
  bank_name VARCHAR(100),
  account_number VARCHAR(20),
  account_name VARCHAR(200),
  paystack_subaccount_code VARCHAR(100),
  location_name VARCHAR(300),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  description TEXT,
  category VARCHAR(100),
  logo_url VARCHAR(500),
  is_open BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_ratings INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

CREATE TABLE IF NOT EXISTS drivers_tb (
  driver_id INT AUTO_INCREMENT PRIMARY KEY,
  fullname VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  passwd VARCHAR(255) NOT NULL,
  school_id INT,
  phone VARCHAR(20),
  bank_name VARCHAR(100),
  account_number VARCHAR(20),
  account_name VARCHAR(200),
  paystack_subaccount_code VARCHAR(100),
  is_available BOOLEAN DEFAULT FALSE,
  current_latitude DECIMAL(10,8),
  current_longitude DECIMAL(11,8),
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_ratings INT DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  today_earnings DECIMAL(12,2) DEFAULT 0.00,
  total_deliveries INT DEFAULT 0,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

CREATE TABLE IF NOT EXISTS menu_items (
  menu_id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(500),
  tags JSON,
  prep_time INT DEFAULT 15,
  prep_time_unit VARCHAR(10) DEFAULT 'mins',
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors_tb(vendor_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(36) PRIMARY KEY,
  student_id INT NOT NULL,
  vendor_id INT NOT NULL,
  driver_id INT,
  total_amount DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 300.00,
  vendor_amount DECIMAL(10,2),
  rider_amount DECIMAL(10,2),
  status ENUM('pending','paid','accepted','preparing','ready','rider_assigned','picked_up','on_the_way','delivered','cancelled','refunded') DEFAULT 'pending',
  payment_reference VARCHAR(100),
  payment_status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  delivery_address TEXT,
  delivery_latitude DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),
  rider_latitude DECIMAL(10,8),
  rider_longitude DECIMAL(11,8),
  estimated_delivery_time INT DEFAULT 30,
  special_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students_tb(st_id),
  FOREIGN KEY (vendor_id) REFERENCES vendors_tb(vendor_id),
  FOREIGN KEY (driver_id) REFERENCES drivers_tb(driver_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  menu_id INT,
  item_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campus_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT,
  name VARCHAR(300) NOT NULL,
  category ENUM('eatery','landmark','hostel','department','faculty','admin','sports','other') DEFAULT 'landmark',
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

-- REAL UNIBEN GPS COORDINATES (verified)
INSERT INTO campus_locations (school_id, name, category, latitude, longitude, description) VALUES
(1, 'Main Gate Shopping Complex',        'eatery',   6.39845037, 5.61008487, 'Shopping and food vendors at main gate'),
(1, 'John Harris Library (JHL)',         'landmark', 6.39653577, 5.61658694, 'Main University Library'),
(1, 'Home and Away',                     'eatery',   6.39613061, 5.61481668, 'Popular eatery on campus'),
(1, '1000LT Faculty of Physical Sci.',  'faculty',  6.40035277, 5.61849667, 'Large lecture theatre'),
(1, 'Akindeko Main Auditorium',          'landmark', 6.39983033, 5.61384036, 'Main convocation auditorium'),
(1, 'Festus Iyayi Hall',                 'hostel',   6.39854023, 5.61818553, 'Festus Iyayi student hall'),
(1, 'Faculty of Engineering',            'faculty',  6.40185567, 5.61529214, 'Faculty of Engineering & Technology'),
(1, 'Faculty of Social Sciences',        'faculty',  6.40357545, 5.62108157, 'Faculty of Social Sciences'),
(1, 'Faculty of Law',                    'faculty',  6.40079540, 5.62170038, 'Faculty of Law'),
(1, 'Medical Complex',                   'landmark', 6.39549612, 5.62360262, 'UNIBEN Medical & Health Complex'),
(1, 'Saint Albert Catholic Church',      'landmark', 6.40162082, 5.61112952, 'Catholic Church on campus'),
(1, 'Hall 2 Carpark',                    'landmark', 6.39753569, 5.61930107, 'Hall 2 area & carpark'),
(1, 'KeyStone Hostel',                   'hostel',   6.39894878, 5.62501478, 'KeyStone private hostel'),
(1, 'Hall 7',                            'hostel',   6.39800816, 5.62538215, 'Hall 7 student hostel'),
(1, 'Hall 6',                            'hostel',   6.39822721, 5.62608232, 'Hall 6 student hostel'),
(1, 'Food Court (Buka)',                 'eatery',   6.39534948, 5.61937022, 'Main campus food court'),
(1, 'UNIBEN MicroFinance Bank',          'landmark', 6.39668956, 5.61765005, 'University MicroFinance Bank');

CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  student_id INT NOT NULL,
  vendor_id INT,
  driver_id INT,
  vendor_rating INT CHECK (vendor_rating BETWEEN 1 AND 5),
  driver_rating INT CHECK (driver_rating BETWEEN 1 AND 5),
  vendor_review TEXT,
  driver_review TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  UNIQUE KEY unique_order_rating (order_id, student_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_type ENUM('student','vendor','driver') NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  type VARCHAR(50),
  reference_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_student ON orders(student_id);
CREATE INDEX idx_orders_vendor ON orders(vendor_id);
CREATE INDEX idx_orders_driver ON orders(driver_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_menu_vendor ON menu_items(vendor_id);
CREATE INDEX idx_menu_tags ON menu_items((CAST(tags AS CHAR(500))));
CREATE INDEX idx_drivers_available ON drivers_tb(is_available, school_id);
CREATE INDEX idx_vendors_school ON vendors_tb(school_id);
CREATE INDEX idx_students_school ON students_tb(school_id);
CREATE INDEX idx_locations_school ON campus_locations(school_id);

-- ============================================================
-- MIGRATIONS — run these if upgrading an existing database
-- ============================================================
-- Add prep_time_unit column (for vendors that use days instead of minutes)
-- ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS prep_time_unit VARCHAR(10) DEFAULT 'mins';

CREATE TABLE IF NOT EXISTS email_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(200) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  purpose VARCHAR(50) DEFAULT 'school_verify',
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_email (email),
  INDEX idx_otp_expires (expires_at)
);
