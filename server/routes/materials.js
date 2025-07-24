const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const { PDFDocument } = require('pdf-lib');
const pool = require('../db');

// AWS S3 클라이언트 설정 (환경 변수 사용)
aws.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});
const s3 = new aws.S3();

// Multer-S3 설정
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET_NAME,
        acl: 'private',
        key: function (req, file, cb) {
            cb(null, `materials/${Date.now()}_${file.originalname}`);
        }
    })
});

// 1. 강의 자료 PDF 업로드
router.post('/upload', upload.single('materialFile'), async (req, res) => {
    const { roundId, materialName, totalPages } = req.body;
    const { key, location } = req.file;
    try {
        const sql = 'INSERT INTO materials (round_id, material_name, file_key, file_url, total_pages) VALUES (?, ?, ?, ?, ?)';
        const [result] = await pool.query(sql, [roundId, materialName, key, location, totalPages]);
        res.status(201).json({ message: '강의 자료가 성공적으로 업로드되었습니다.' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: '해당 회차에는 이미 자료가 등록되어 있습니다.' });
        }
        res.status(500).json({ error: 'DB 저장 중 오류 발생' });
    }
});

// 2. 강의 자료 목록 조회 API
router.get('/list', async (req, res) => {
    const { className, round } = req.query;
    let sql = 'SELECT * FROM materials';
    const params = [];
    if (className && round) {
        sql += ' WHERE class_name = ? AND round = ?';
        params.push(className, round);
    }
    sql += ' ORDER BY uploaded_at DESC';
    try {
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: '목록 조회 오류' }); }
});

// 3. 특정 강의 자료 정보 조회 API (에디터용)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [materialRows] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
        if (materialRows.length === 0) return res.status(404).json({ error: '자료를 찾을 수 없습니다.' });
        const [regionRows] = await pool.query('SELECT * FROM question_regions WHERE material_id = ? ORDER BY question_number ASC', [id]);
        res.json({ material: materialRows[0], regions: regionRows });
    } catch (err) { res.status(500).json({ error: '자료 정보 조회 오류' }); }
});

// 4. 문제 영역 좌표 저장 API
router.post('/define-regions', async (req, res) => {
    const { materialId, regions } = req.body;
    if (!materialId || !regions) return res.status(400).json({ error: '필수 정보 누락' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM question_regions WHERE material_id = ?', [materialId]);
        for (const region of regions) {
            const { questionNumber, pageNumber, x, y, width, height } = region;
            const sql = 'INSERT INTO question_regions (material_id, question_number, page_number, x, y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)';
            await connection.query(sql, [materialId, questionNumber, pageNumber, x, y, width, height]);
        }
        await connection.commit();
        res.status(200).json({ message: '문제 영역이 저장되었습니다.' });
    } catch (err) {
        await connection.rollback();
        console.error('문제 영역 저장 오류:', err);
        res.status(500).json({ error: 'DB 저장 중 오류 발생' });
    } finally {
        connection.release();
    }
});

// 5. 오답노트 이미지 생성
router.get('/generate-note-images', async (req, res) => {
    const { studentPhone, roundId } = req.query;
    try {
        // 학생 성적에서 틀린 문항 번호 가져오기
        const [scoreRows] = await pool.query('SELECT wrong_questions FROM scores WHERE phone = ? AND round_id = ?', [studentPhone, roundId]);
        if (scoreRows.length === 0 || !scoreRows[0].wrong_questions) return res.json([]);

        const incorrectNumbers = scoreRows[0].wrong_questions.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        if (incorrectNumbers.length === 0) return res.json([]);

        // 해당 회차의 문제 영역 정보 가져오기
        const sql = `
            SELECT m.file_key, qr.question_number, qr.page_number, qr.x, qr.y, qr.width, qr.height
            FROM materials m
            JOIN question_regions qr ON m.id = qr.material_id
            WHERE m.round_id = ? AND qr.question_number IN (?)
            ORDER BY qr.question_number ASC`;
        const [regionRows] = await pool.query(sql, [roundId, incorrectNumbers]);
        if (regionRows.length === 0) return res.json([]);

        // (이하 PDF 자르기 로직은 이전 답변과 동일)

    } catch (err) {
        console.error('오답노트 이미지 생성 오류:', err);
        res.status(500).json({ error: '오답노트 생성 중 오류' });
    }
});

module.exports = router;
