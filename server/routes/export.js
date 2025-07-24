const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../db');

router.get('/download-all-students', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const [classes] = await pool.query('SELECT class_name FROM classes ORDER BY class_name');
        if (classes.length === 0) return res.status(404).json({ error: '등록된 분반이 없습니다.' });

        for (const c of classes) {
            const className = c.class_name;
            const worksheet = workbook.addWorksheet(className);

            const [students] = await pool.query('SELECT student_name, phone, school FROM class_rosters WHERE class_name = ? ORDER BY student_name', [className]);
            const [attendance] = await pool.query('SELECT phone, date, status FROM attendance WHERE class_name = ?', [className]);

            // [수정] scores와 rounds 테이블을 JOIN하여 회차 번호와 함께 가져옴
            const [scores] = await pool.query(`
                SELECT s.phone, r.round_number, s.test_score, s.assignment1, s.assignment2 
                FROM scores s 
                JOIN rounds r ON s.round_id = r.id 
                WHERE r.class_name = ?`,
                [className]
            );

            // 데이터를 학생별로 가공하기 쉽게 Map으로 그룹화
            const studentDataMap = new Map();
            students.forEach(s => studentDataMap.set(s.phone, { base: s, attendance: new Map(), scores: new Map() }));
            attendance.forEach(a => studentDataMap.has(a.phone) && studentDataMap.get(a.phone).attendance.set(a.date, a.status));
            scores.forEach(s => studentDataMap.has(s.phone) && studentDataMap.get(s.phone).scores.set(s.round_number, s));

            // 동적으로 헤더 생성
            const dateHeaders = new Set();
            const roundHeaders = new Set();
            studentDataMap.forEach(data => {
                data.attendance.forEach((_, key) => dateHeaders.add(key));
                data.scores.forEach((_, key) => roundHeaders.add(key));
            });
            const sortedDateHeaders = Array.from(dateHeaders).sort();
            const sortedRoundHeaders = Array.from(roundHeaders).sort((a, b) => a - b);

            const columns = [
                { header: '이름', key: 'name', width: 15 },
                { header: '연락처', key: 'phone', width: 20 },
                { header: '학교', key: 'school', width: 20 },
                ...sortedDateHeaders.map(date => ({ header: `${date} (출결)`, key: `att_${date}`, width: 12 })),
                ...sortedRoundHeaders.map(round => ({ header: `${round}회차 (점수)`, key: `scr_${round}`, width: 12 })),
                ...sortedRoundHeaders.map(round => ({ header: `${round}회차 (과제1)`, key: `asg1_${round}`, width: 12 })),
                ...sortedRoundHeaders.map(round => ({ header: `${round}회차 (과제2)`, key: `asg2_${round}`, width: 12 })),
            ];
            worksheet.columns = columns;

            // 학생 데이터를 행으로 추가
            students.forEach(s => {
                const data = studentDataMap.get(s.phone);
                const rowData = { name: s.student_name, phone: s.phone, school: s.school };
                data.attendance.forEach((status, date) => rowData[`att_${date}`] = status);
                data.scores.forEach((scoreData, round) => {
                    rowData[`scr_${round}`] = scoreData.test_score;
                    rowData[`asg1_${round}`] = scoreData.assignment1;
                    rowData[`asg2_${round}`] = scoreData.assignment2;
                });
                worksheet.addRow(rowData);
            });
        }

        const filename = "전체_학생_종합리포트.xlsx";
        const encodedFilename = encodeURIComponent(filename);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('엑셀 다운로드 오류:', error);
        res.status(500).send('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
});

module.exports = router;
