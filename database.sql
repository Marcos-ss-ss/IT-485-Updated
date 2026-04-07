DROP DATABASE IF EXISTS umb_exchange;
CREATE DATABASE umb_exchange;
USE umb_exchange;

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- LISTINGS
-- =========================
CREATE TABLE listings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    edition VARCHAR(100) NULL,
    price DECIMAL(10,2) NOT NULL,
    book_condition VARCHAR(50) NOT NULL,
    rating INT NULL,
    description TEXT NULL,
    seller_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
);

-- =========================
-- MESSAGES
-- =========================
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    message TEXT NOT NULL,
    listing_id INT NULL,
    course_code VARCHAR(20) NULL,
    book_title VARCHAR(255) NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL
);

-- =========================
-- OPTIONAL TEST USERS
-- =========================
INSERT INTO users (email) VALUES
('student1@umb.edu'),
('student2@umb.edu'),
('student3@umb.edu');

-- =========================
-- OPTIONAL TEST LISTINGS
-- =========================
INSERT INTO listings
(course_code, title, edition, price, book_condition, rating, description, seller_email)
VALUES
('CS105', 'Computer Concepts Textbook', '5th Edition', 35.00, 'Like New', 4, 'Clean copy with minimal highlighting.', 'student1@umb.edu'),
('CS105', 'Intro to Computing Workbook', '2nd Edition', 20.00, 'Used', 3, 'Some wear but still usable.', 'student2@umb.edu'),
('IT240', 'Web Fluency Textbook', '3rd Edition', 40.00, 'Good', 5, 'Very helpful for the class.', 'student3@umb.edu'),
('IT285L', 'Ethics in Computing', '1st Edition', 25.00, 'Used', 4, 'Good condition overall.', 'student1@umb.edu');

-- =========================
-- OPTIONAL TEST MESSAGES
-- =========================
INSERT INTO messages
(sender_id, receiver_id, message, listing_id, course_code, book_title)
VALUES
(2, 1, 'Hey, is this CS105 book still available?', 1, 'CS105', 'Computer Concepts Textbook'),
(1, 2, 'Yes, it is still available.', 1, 'CS105', 'Computer Concepts Textbook'),
(3, 1, 'Would you take $20 for Ethics in Computing?', 4, 'IT285L', 'Ethics in Computing'),
(1, 3, 'I can do $22.', 4, 'IT285L', 'Ethics in Computing');