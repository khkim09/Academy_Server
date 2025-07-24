const express = require('express');
const router = express.Router();
const pool = require('../db');

// 특정 분반의 모든 회차 목록 조회
router.get('/list', async (req, res) => {
    const { className } = req.query;
    if (!className) return res.status(400).json({ error: '분반 이름은 필수입니다.' });
    try {
        const sql = 'SELECT id, round_number, round_name FROM rounds WHERE class_name = ? ORDER BY round_number ASC';
        const [rows] = await pool.query(sql, [className]);
        res.json(rows);
    } catch (err) {
        console.error('회차 목록 조회 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 새로운 회차 생성
router.post('/create', async (req, res) => {
    const { className, roundNumber, roundName } = req.body;
    if (!className || !roundNumber) {
        return res.status(400).json({ error: '분반과 회차 번호는 필수입니다.' });
    }
    try {
        const sql = 'INSERT INTO rounds (class_name, round_number, round_name) VALUES (?, ?, ?)';
        const [result] = await pool.query(sql, [className, roundNumber, roundName || `정규 ${roundNumber}회차`]);
        res.status(201).json({
            id: result.insertId,
            round_number: roundNumber,
            round_name: roundName || `정규 ${roundNumber}회차`
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: '이미 존재하는 회차 번호입니다.' });
        }
        console.error('회차 생성 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    }
});

module.exports = router;
