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

/* 4. [수정됨] 성적 관리를 위한 scores 테이블 */
CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(50),
    round VARCHAR(20),
    date DATE,
    -- [추가] 회차의 시험 날짜
    student_name VARCHAR(50),
    phone VARCHAR(20),
    school VARCHAR(50),
    test_score INT,
    total_question INT,
    wrong_questions TEXT,
    assignment1 VARCHAR(10),
    assignment2 VARCHAR(10),
    memo TEXT,
    UNIQUE KEY `unique_score_record` (`class_name`, `phone`, `round`)
);

/* 5. 학생 관리를 위한 students 테이블 */
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    school VARCHAR(100)
);