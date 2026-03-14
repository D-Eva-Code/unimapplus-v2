
-- UnimapPlus Database Schema v2.0


CREATE DATABASE IF NOT EXISTS unimapplus;
USE unimapplus;


CREATE TABLE IF NOT EXISTS schools (
  school_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  location VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schools (name, location) VALUES
  ('University of Benin (UNIBEN)', 'Benin City, Edo State'),
  ('University of Lagos (UNILAG)', 'Lagos'),
  ('Obafemi Awolowo University (OAU)', 'Ile-Ife, Osun State'),
  ('University of Ibadan (UI)', 'Ibadan, Oyo State'),
  ('Ahmadu Bello University (ABU)', 'Zaria, Kaduna State'),
  ('Igbinedion University Okada (IUO)', 'Okada, Edo State'),
  ('Wellspring University', 'Benin City, Edo State');

-- Students
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

-- Vendors
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
  logo_url VARCHAR(500),
  is_open BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_ratings INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

-- Riders/Drivers
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

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  menu_id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(500),
  tags JSON,
  -- tags example: ["spicy", "vegetarian", "popular", "new"]
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors_tb(vendor_id) ON DELETE CASCADE
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(36) PRIMARY KEY,
  student_id INT NOT NULL,
  vendor_id INT NOT NULL,
  driver_id INT,
  total_amount DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 200.00,
  vendor_amount DECIMAL(10,2),
  rider_amount DECIMAL(10,2),
  status ENUM('pending','paid','accepted','preparing','rider_assigned','picked_up','on_the_way','delivered','cancelled','refunded') DEFAULT 'pending',
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

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  menu_id INT,
  item_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Campus Locations (for the map)
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

-- UNIBEN Locations
INSERT INTO campus_locations (school_id, name, category, latitude, longitude, description) VALUES
(1, 'UNIBEN Main Gate', 'landmark', 6.3719, 5.6230, 'Main entrance to University of Benin'),
(1, 'Faculty of Engineering Canteen', 'eatery', 6.3745, 5.6218, 'Popular canteen near Engineering faculty'),
(1, 'Ekiosa Market Eateries', 'eatery', 6.3698, 5.6245, 'Multiple food vendors near Ekiosa'),
(1, 'UNIBEN Medical Centre', 'landmark', 6.3752, 5.6190, 'University Medical Centre'),
(1, 'Sports Complex', 'sports', 6.3760, 5.6205, 'UNIBEN Sports Complex'),
(1, 'Law Faculty', 'faculty', 6.3730, 5.6235, 'Faculty of Law'),
(1, 'Arts Theatre', 'department', 6.3715, 5.6250, 'Arts & Science Theatre'),
(1, 'Student Union Building (SUB)', 'landmark', 6.3725, 5.6225, 'Student Union Building - food stalls nearby'),
(1, 'Hall 1 Cafeteria', 'eatery', 6.3740, 5.6210, 'Cafeteria near Hall 1'),
(1, 'UNIBEN Library', 'landmark', 6.3735, 5.6220, 'Main University Library');

-- Ratings
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

-- Notifications
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

-- Paystack subaccounts cache
CREATE TABLE IF NOT EXISTS paystack_subaccounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_type ENUM('vendor','driver') NOT NULL,
  subaccount_code VARCHAR(100) NOT NULL,
  business_name VARCHAR(200),
  account_number VARCHAR(20),
  bank_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_orders_student ON orders(student_id);
CREATE INDEX idx_orders_vendor ON orders(vendor_id);
CREATE INDEX idx_orders_driver ON orders(driver_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_menu_vendor ON menu_items(vendor_id);
CREATE INDEX idx_menu_tags ON menu_items((CAST(tags AS CHAR(500))));
CREATE INDEX idx_drivers_available ON drivers_tb(is_available, school_id);
CREATE INDEX idx_vendors_school ON vendors_tb(school_id);
CREATE INDEX idx_students_school ON students_tb(school_id);
