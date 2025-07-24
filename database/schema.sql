CREATE DATABASE IF NOT EXISTS academy;

USE academy;

-- 1. 분반 정보
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL UNIQUE
);

-- 2. 학생 명단 정보
CREATE TABLE IF NOT EXISTS class_rosters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    student_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    school VARCHAR(50),
    UNIQUE KEY `unique_roster_entry` (`class_name`, `phone`)
);

-- 3. 회차 정보 (독립적 관리의 핵심)
CREATE TABLE IF NOT EXISTS rounds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    round_number INT NOT NULL,
    round_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_round` (`class_name`, `round_number`)
);

-- 4. 강의 자료 (회차에 종속)
CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_id INT NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    file_key VARCHAR(255) NOT NULL,
    file_url VARCHAR(1024) NOT NULL,
    total_pages INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_material_for_round` (`round_id`),
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

-- 5. 성적 기록 (회차에 종속)
CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_id INT NOT NULL,
    student_name VARCHAR(50),
    phone VARCHAR(20),
    school VARCHAR(50),
    test_score INT,
    total_question INT,
    wrong_questions TEXT,
    assignment1 VARCHAR(10),
    assignment2 VARCHAR(10),
    memo TEXT,
    UNIQUE KEY `unique_score_for_student_round` (`phone`, `round_id`),
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

-- 6. 문제 영역 좌표
CREATE TABLE IF NOT EXISTS question_regions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    question_number INT NOT NULL,
    page_number INT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT NOT NULL,
    height FLOAT NOT NULL,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    UNIQUE KEY unique_region (material_id, question_number)
);

-- 7. 출결 정보
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    student_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    status ENUM('O', 'X') NOT NULL,
    UNIQUE KEY `unique_attendance_record` (`class_name`, `phone`, `date`)
);