const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('../db');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-roster', upload.single('rosterFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '엑셀 파일이 필요합니다.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        let totalProcessed = 0;
        let totalAdded = 0;
        let sheetsProcessed = 0;

        for (const sheetName of workbook.SheetNames) {
            await connection.query('INSERT IGNORE INTO classes (class_name) VALUES (?)', [sheetName]);
            sheetsProcessed++;

            const worksheet = workbook.Sheets[sheetName];
            const students = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

            if (students.length === 0) continue;

            const validStudents = students.filter(student => student['이름'] && student['전화번호']);
            totalProcessed += validStudents.length;

            if (validStudents.length === 0) continue;

            const values = validStudents.map(student => [
                sheetName,
                String(student['이름']).trim(),
                String(student['전화번호']).trim(),
                student['학교'] || ''
            ]);

            const sql = 'INSERT IGNORE INTO class_rosters (class_name, student_name, phone, school) VALUES ?';
            const [result] = await connection.query(sql, [values]);
            totalAdded += result.affectedRows;
        }

        await connection.commit();

        res.status(200).json({
            message: `총 ${sheetsProcessed}개 시트 처리 완료.`,
            totalCount: totalProcessed,
            addedCount: totalAdded,
            skippedCount: totalProcessed - totalAdded,
        });

    } catch (err) {
        await connection.rollback();
        console.error('엑셀 업로드 처리 오류:', err);
        res.status(500).json({ error: err.message || '파일 처리 중 오류가 발생했습니다. 엑셀 양식을 확인해주세요.' });
    } finally {
        connection.release();
    }
});

module.exports = router;
