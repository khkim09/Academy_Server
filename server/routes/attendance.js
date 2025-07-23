// 서버 코드
const express = require('express');
const router = express.Router();
const db = require('../db');

// --- 분반 관리 ---

// GET: 모든 분반 목록 불러오기
router.get('/classes', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT class_name FROM classes ORDER BY class_name ASC'
        );
        const classNames = rows.map(row => row.class_name);
        res.json(classNames);
    } catch (err) {
        console.error('DB 분반 목록 조회 오류:', err);
        res.status(500).json({ error: '❌ 분반 목록 조회 오류 (서버 오류)' });
    }
});

// POST: 새 분반 추가하기 ('신규 등록' 페이지에서 사용될 API)
router.post('/classes', async (req, res) => {
    const { className } = req.body;
    if (!className) {
        return res.status(400).json({ error: '❌ 분반 이름 입력 필수' });
    }

    try {
        await db.query(
            'INSERT INTO classes (class_name) VALUES (?)', [className]
        );
        res.status(201).json({ message: '✅ 분반 추가 성공' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: '❌ 이미 존재하는 분반입니다.' });
        }
        console.error('DB 분반 추가 오류:', err);
        res.status(500).json({ error: '❌ 분반 추가 중 서버 오류' });
    }
});

// --- 출결 관리 ---

// 이름으로 학생 검색 API (부분 일치, 전체 조회)
router.get('/search-students', async (req, res) => {
    const { name } = req.query;

    try {
        let query;
        let params = [];

        if (name && name.trim() !== '') {
            // 검색어가 있으면: 부분 일치(LIKE) 검색
            query = `
                SELECT class_name, student_name, phone, school
                FROM class_rosters
                WHERE student_name
                LIKE ?
                ORDER BY student_name, class_name
            `;
            params.push(`%${name}%`);
        } else {
            // 검색어가 없으면: 전체 학생 조회
            query = `
                SELECT class_name, student_name, phone, school
                FROM class_rosters
                ORDER BY student_name, class_name
            `;
        }
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('학생 검색 오류:', err);
        res.status(500).json({ error: '❌ 학생 검색 중 서버 오류가 발생했습니다.' });
    }
});

// 특정 학생의 전체 출결 기록 조회 API
router.get('/student-history', async (req, res) => {
    const { phone } = req.query;
    if (!phone)
        return res.status(400).json({ error: '❌ 학생 식별자(phone)는 필수입니다.' });

    try {
        const query = 'SELECT date, status FROM attendance WHERE phone = ? ORDER BY date DESC';
        const [rows] = await db.query(query, [phone]);
        res.json(rows);
    } catch (err) {
        console.error('학생 출결 기록 조회 오류:', err);
        res.status(500).json({ error: '❌ 학생 출결 기록 조회 중 서버 오류 발생' });
    }
});

// 출결 정보 저장 (트랜잭션 및 별칭 사용)
router.post('/save', async (req, res) => {
    const { records } = req.body;
    if (!records || !Array.isArray(records))
        return res.status(400).json({ error: '❌ records 형식이 올바르지 않습니다.' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const promises = records.map(record => {
            const { class_name, student_name, phone, date, status } = record;
            const sql = `
                INSERT INTO attendance (class_name, student_name, phone, date, status)
                VALUES (?, ?, ?, ?, ?)
                AS new_record
                ON DUPLICATE KEY UPDATE status = new_record.status
            `;

            return connection.query(sql,
                [class_name, student_name, phone, date, status]);
        });

        await Promise.all(promises);
        await connection.commit();
        res.status(200).json({ message: '✅ 출결 정보 저장 완료' });
    } catch (err) {
        await connection.rollback();
        console.error('DB 저장 오류:', err);
        res.status(500).json({ error: '❌ 출결 정보 저장 중 서버 오류가 발생했습니다.' });
    } finally {
        connection.release();
    }
});

// 출결 정보 불러오기 (분반 + 날짜) + 전체 분반 한 번에 조회
router.get('/get', async (req, res) => {
    const { class_name, date } = req.query;
    if (!date)
        return res.status(400).json({ error: '❌ 날짜 입력 필수' });

    try {
        let query;
        const params = [date];

        // '전체 분반' 또는 '특정 분반'에 따라 분기
        if (class_name === '전체 분반') {
            query = `
                SELECT
                    r.class_name,
                    r.student_name,
                    r.phone,
                    r.school,
                COALESCE(a.status, '결석') AS status
                FROM class_rosters AS r
                LEFT JOIN attendance AS a
                ON r.class_name = a.class_name AND r.phone = a.phone AND a.date = ?
                ORDER BY r.class_name, r.student_name;
            `;
        } else if (class_name) {
            query = `
                SELECT
                    r.class_name,
                    r.student_name,
                    r.phone,
                    r.school,
                COALESCE(a.status, '결석') AS status
                FROM class_rosters AS r
                LEFT JOIN attendance AS a
                ON r.class_name = a.class_name AND r.phone = a.phone AND a.date = ?
                WHERE r.class_name = ?
                ORDER BY r.student_name;
            `;
            params.push(class_name);
        } else {
            return res.json([]);
        }

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('출결 조회 오류:', err);
        res.status(500).json({ error: '❌ 출결 정보 호출 중 오류 발생' });
    }
});

module.exports = router;
