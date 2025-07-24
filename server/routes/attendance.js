const express = require('express');
const router = express.Router();
const pool = require('../db');

// 모든 분반 목록 불러오기
router.get('/classes', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT class_name FROM classes ORDER BY class_name ASC');
        res.json(rows.map(row => row.class_name));
    } catch (err) {
        console.error('분반 목록 조회 오류:', err);
        res.status(500).json({ error: '분반 목록 조회 중 서버 오류가 발생했습니다.' });
    }
});

// 이름으로 학생 검색
router.get('/search-students', async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: '검색어가 필요합니다.' });
    try {
        const query = "SELECT class_name, student_name, phone, school FROM class_rosters WHERE student_name LIKE ? ORDER BY student_name";
        const [rows] = await pool.query(query, [`%${name}%`]);
        res.json(rows);
    } catch (err) {
        console.error('학생 검색 오류:', err);
        res.status(500).json({ error: '학생 검색 중 서버 오류가 발생했습니다.' });
    }
});

// 특정 학생의 전체 출결 기록 조회
router.get('/student-history', async (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: '학생의 연락처는 필수입니다.' });
    try {
        const query = 'SELECT date, class_name, status FROM attendance WHERE phone = ? ORDER BY date DESC';
        const [rows] = await pool.query(query, [phone]);
        res.json(rows);
    } catch (err) {
        console.error('학생 출결 기록 조회 오류:', err);
        res.status(500).json({ error: '학생 출결 기록 조회 중 서버 오류가 발생했습니다.' });
    }
});

// 출결 정보 저장
router.post('/save', async (req, res) => {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: '저장할 출결 기록이 없습니다.' });
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const record of records) {
            const { class_name, student_name, phone, date, status } = record;
            const sql = 'INSERT INTO attendance (class_name, student_name, phone, date, status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)';
            await connection.query(sql, [class_name, student_name, phone, date, status]);
        }
        await connection.commit();
        res.status(200).json({ message: '출결 정보가 성공적으로 저장되었습니다.' });
    } catch (err) {
        await connection.rollback();
        console.error('출결 정보 저장 오류:', err);
        res.status(500).json({ error: '출결 정보 저장 중 서버 오류가 발생했습니다.' });
    } finally {
        connection.release();
    }
});

// [수정] 출결 정보 불러오기 (분반 + 날짜)
router.get('/get', async (req, res) => {
    const { class_name, date } = req.query;
    if (!date) return res.status(400).json({ error: '날짜는 필수입니다.' });

    try {
        let query;
        let params = [date];

        // [수정] '전체 분반'일 경우, 모든 학생 명단을 가져오도록 쿼리 변경
        if (class_name === '전체 분반') {
            query = `
                SELECT r.class_name, r.student_name, r.phone, r.school, a.status 
                FROM class_rosters AS r 
                LEFT JOIN attendance AS a ON r.phone = a.phone AND a.date = ? 
                ORDER BY r.class_name, r.student_name`;
        } else {
            query = `
                SELECT r.class_name, r.student_name, r.phone, r.school, a.status 
                FROM class_rosters AS r 
                LEFT JOIN attendance AS a ON r.phone = a.phone AND a.date = ? 
                WHERE r.class_name = ? 
                ORDER BY r.student_name`;
            params.push(class_name);
        }
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('출결 정보 조회 오류:', err);
        res.status(500).json({ error: '출결 정보 조회 중 서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
