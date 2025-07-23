use academy;

-- 데이터 간의 연결(외래 키) 제약 조건을 일시적으로 비활성화합니다.
SET
    FOREIGN_KEY_CHECKS = 0;

-- 각 테이블의 모든 데이터를 깨끗하게 삭제하고 초기화합니다.
TRUNCATE TABLE attendance;

TRUNCATE TABLE scores;

TRUNCATE TABLE class_rosters;

TRUNCATE TABLE classes;

-- 비활성화했던 외래 키 제약 조건을 다시 활성화합니다.
SET
    FOREIGN_KEY_CHECKS = 1;