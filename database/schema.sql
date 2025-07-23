-- 데이터베이스가 없다면 'academy'라는 이름으로 생성합니다.
CREATE DATABASE IF NOT EXISTS academy;

-- 'academy' 데이터베이스를 사용합니다.
USE academy;

/* 1. 분반별 학생 명단(Roster)을 위한 `class_rosters` 테이블 */
CREATE TABLE IF NOT EXISTS class_rosters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    student_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    school VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_roster_entry` (`class_name`, `phone`)
);

/* 2. 출결 상태 관리를 위한 `attendance` 테이블 */
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    student_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    status ENUM('O', 'X') NOT NULL,
    UNIQUE KEY `unique_attendance_record` (`class_name`, `phone`, `date`)
);

/* 3. 분반별 관리 위한 classes 테이블 */
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL UNIQUE
);

/* 4. 성적 관리를 위한 scores 테이블 */
CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT,
    -- [추가] 어떤 시험지에 대한 성적인지 명확히 연결
    class_name VARCHAR(50),
    round VARCHAR(20),
    date DATE,
    student_name VARCHAR(50),
    phone VARCHAR(20),
    school VARCHAR(50),
    test_score INT,
    total_question INT,
    wrong_questions TEXT,
    assignment1 VARCHAR(10),
    assignment2 VARCHAR(10),
    memo TEXT,
    UNIQUE KEY `unique_score_record` (`phone`, `material_id`),
    -- [수정] 학생은 특정 시험지에 대해 하나의 성적만 가짐
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE
    SET
        NULL
);

/* 5. 강의 자료 (PDF) 정보 저장 테이블 */
CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    round VARCHAR(50) NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    file_key VARCHAR(255) NOT NULL,
    file_url VARCHAR(1024) NOT NULL,
    total_pages INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_material (class_name, round)
);

/* 6. 문제 영역 좌표 저장 테이블 */
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