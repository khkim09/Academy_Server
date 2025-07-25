const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../db');

router.get('/download-all-students', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();

        // 1. DB에 등록된 모든 분반 이름 호출
        const [classes] = await db.query('SELECT class_name FROM classes ORDER BY class_name');
        if (classes.length === 0)
            return res.status(404).json({ error: '데이터베이스에 등록된 분반이 없습니다.' });

        // 2. 각 분반별로 시트 생성
        for (const c of classes) {
            const className = c.class_name;
            const worksheet = workbook.addWorksheet(className);

            // 3. 해당 분반의 학생, 출결, 성적 데이터 호출
            const [students] = await db.query('SELECT student_name, phone, school FROM class_rosters WHERE class_name = ? ORDER BY student_name', [className]);
            const [attendance] = await db.query('SELECT phone, date, status FROM attendance WHERE class_name = ?', [className]);
            const [scores] = await db.query('SELECT phone, round, date, test_score, assignment1, assignment2 FROM scores WHERE class_name = ?', [className]);

            // 4. 데이터를 학생별, 날짜/회차별로 조회하기 쉽게 Map으로 가공
            const studentDataMap = new Map();
            students.forEach(s => studentDataMap.set(s.phone, { base: s, records: new Map() }));

            attendance.forEach(a => {
                if (studentDataMap.has(a.phone)) {
                    const dateStr = new Date(a.date).toISOString().split('T')[0];
                    const studentRecords = studentDataMap.get(a.phone).records;
                    if (!studentRecords.has(dateStr))
                        studentRecords.set(dateStr, {});

                    studentRecords.get(dateStr).attendance = a.status;
                }
            });
            scores.forEach(s => {
                if (studentDataMap.has(s.phone)) {
                    const dateStr = s.date ?
                        new Date(s.date).toISOString().split('T')[0] : `(날짜없음-${s.round}회차)`;
                    const studentRecords = studentDataMap.get(s.phone).records;
                    if (!studentRecords.has(dateStr))
                        studentRecords.set(dateStr, {});

                    studentRecords.get(dateStr).score = s.test_score;
                    studentRecords.get(dateStr).assignment1 = s.assignment1;
                    studentRecords.get(dateStr).assignment2 = s.assignment2;
                }
            });

            // 5. 동적으로 헤더를 생성합니다.
            const dateHeaders = new Set();
            studentDataMap.forEach(data => data.records.forEach((_, key) => dateHeaders.add(key)));
            const sortedDateHeaders = Array.from(dateHeaders).sort();

            const headers = [
                { header: '이름', key: 'name', width: 15 },
                { header: '전화번호', key: 'phone', width: 20 },
                { header: '학교', key: 'school', width: 20 },
            ];
            sortedDateHeaders.forEach(date => {
                headers.push({ header: `${date} (출결)`, key: `att_${date}`, width: 12 });
                headers.push({ header: `${date} (점수)`, key: `scr_${date}`, width: 12 });
                headers.push({ header: `${date} (과제1)`, key: `asg1_${date}`, width: 12 });
                headers.push({ header: `${date} (과제2)`, key: `asg2_${date}`, width: 12 });
            });
            worksheet.columns = headers;

            // 6. 학생 데이터를 행으로 추가합니다.
            students.forEach(s => {
                const data = studentDataMap.get(s.phone);
                const rowData = { name: s.student_name, phone: s.phone, school: s.school };
                sortedDateHeaders.forEach(date => {
                    const record = data.records.get(date) || {};
                    rowData[`att_${date}`] = record.attendance || '-';
                    rowData[`scr_${date}`] = record.score ?? '-';
                    rowData[`asg1_${date}`] = record.assignment1 || '-';
                    rowData[`asg2_${date}`] = record.assignment2 || '-';
                });
                worksheet.addRow(rowData);
            });
        }

        // 7. 한글 파일명 안전한 인코딩
        const filename = "전체_학생_종합리포트.xlsx";
        const encodedFilename = encodeURIComponent(filename);

        // 8. 모든 시트가 생성된 후, 마지막에 한번만 응답을 보냅니다.
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
