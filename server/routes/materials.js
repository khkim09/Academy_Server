// 강의 자료 업로드 관련
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

// Multer-S3 설정: 파일을 서버를 거치지 않고 바로 S3로 업로드
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET_NAME,
        acl: 'private', // 외부에서 직접 접근 불가, 서버를 통해서만 접근 가능
        key: function (req, file, cb) {
            // 파일명을 "materials/타임스탬프_원본파일명" 형태로 S3에 저장
            cb(null, `materials/${Date.now()}_${file.originalname}`);
        }
    })
});


// === API 엔드포인트 목록 ===

/**
 * @route   POST /api/materials/upload
 * @desc    강의 자료(PDF)를 S3에 업로드하고, 그 정보를 DB에 저장
 * @access  Private
 */
router.post('/upload', upload.single('materialFile'), async (req, res) => {
    // 프론트에서 보낸 'roundId', 'materialName', 'totalPages' 정보와
    // S3 업로드 후 반환된 파일 정보('key', 'location')를 받음
    // 자료명이 없을 경우, 원본 파일명을 사용하도록 기본값 설정
    let { roundId, materialName, totalPages } = req.body;
    const { key, location, originalname } = req.file;

    if (!materialName)
        materialName = originalname;

    try {
        // materials 테이블에 파일 정보 저장
        const sql = `
            INSERT INTO materials (round_id, material_name, file_key, file_url, total_pages)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(sql,
            [roundId, materialName, key, location, totalPages]);

        // 성공 시, 생성된 material의 ID와 URL을 프론트로 반환 (편집 페이지로 바로 이동시키기 위함)
        res.status(201).json({
            message: '강의 자료가 성공적으로 업로드 되었습니다.',
            materialId: result.insertId,
            materialUrl: location
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: '해당 회차에는 이미 자료가 등록되어 있습니다.' });
        }
        console.error('강의 자료 업로드 오류:', err);
        res.status(500).json({ error: 'DB 저장 중 오류 발생' });
    }
});

/**
 * @route   GET /api/materials/list
 * @desc    등록된 모든 강의 자료 목록 조회
 * @access  Private
 */
router.get('/list', async (req, res) => {
    try {
        // rounds 테이블과 JOIN하여 분반명, 회차 번호까지 함께 조회
        const sql = `
            SELECT m.*, r.class_name, r.round_number 
            FROM materials m 
            JOIN rounds r ON m.round_id = r.id 
            ORDER BY m.uploaded_at DESC`;
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (err) {
        console.error('자료 목록 조회 오류:', err);
        res.status(500).json({ error: '목록 조회 오류' });
    }
});

/**
 * @route   GET /api/materials/:id
 * @desc    특정 강의 자료의 상세 정보(PDF URL, 문제 영역 좌표) 조회 (에디터 페이지용)
 * @access  Private
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. material 정보 조회
        const [materialRows] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
        if (materialRows.length === 0) return res.status(404).json({ error: '자료를 찾을 수 없습니다.' });

        // 2. 해당 material에 저장된 문제 영역 좌표 정보 조회
        const [regionRows] = await pool.query('SELECT * FROM question_regions WHERE material_id = ? ORDER BY question_number ASC', [id]);

        // 3. 두 정보를 합쳐서 프론트로 전송
        res.json({ material: materialRows[0], regions: regionRows });
    } catch (err) {
        console.error('자료 상세 정보 조회 오류:', err);
        res.status(500).json({ error: '자료 정보 조회 오류' });
    }
});

/**
 * @route   POST /api/materials/define-regions
 * @desc    관리자가 편집기에서 그린 문제 영역 좌표들을 DB에 저장
 * @access  Private
 */
router.post('/define-regions', async (req, res) => {
    const { materialId, regions } = req.body;
    if (!materialId || !regions) return res.status(400).json({ error: '필수 정보 누락' });

    // 여러 개의 쿼리를 안전하게 실행하기 위해 트랜잭션 사용
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 기존에 저장된 영역이 있다면 모두 삭제 (덮어쓰기 방식)
        await connection.query('DELETE FROM question_regions WHERE material_id = ?', [materialId]);

        // 프론트에서 받은 모든 영역 정보를 하나씩 DB에 삽입
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

/**
 * @route   GET /api/materials/generate-note-images
 * @desc    학생의 오답 정보와 문제 영역 좌표를 이용해 실시간으로 오답노트 이미지 생성
 * @access  Private
 */
router.get('/generate-note-images', async (req, res) => {
    const { studentPhone, roundId } = req.query;
    try {
        // 1. 학생의 성적 정보에서 틀린 문항 번호 목록(예: "3,7,15")을 가져옴
        const [scoreRows] = await pool.query('SELECT wrong_questions FROM scores WHERE phone = ? AND round_id = ?', [studentPhone, roundId]);
        if (scoreRows.length === 0 || !scoreRows[0].wrong_questions) return res.json([]);

        // 2. 텍스트를 숫자 배열로 변환
        const incorrectNumbers = scoreRows[0].wrong_questions.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        if (incorrectNumbers.length === 0) return res.json([]);

        // 3. 해당 회차의 원본 PDF 파일 정보와, 틀린 문항 번호에 해당하는 영역 좌표들을 DB에서 조회
        const sql = `
            SELECT m.file_key, qr.question_number, qr.page_number, qr.x, qr.y, qr.width, qr.height
            FROM materials m
            JOIN question_regions qr ON m.id = qr.material_id
            WHERE m.round_id = ? AND qr.question_number IN (?)
            ORDER BY qr.question_number ASC`;
        const [regionRows] = await pool.query(sql, [roundId, incorrectNumbers]);
        if (regionRows.length === 0) return res.json([]);

        // 4. S3에서 원본 PDF 파일을 다운로드
        const s3Object = await s3.getObject({ Bucket: process.env.S3_BUCKET_NAME, Key: regionRows[0].file_key }).promise();
        const pdfDoc = await PDFDocument.load(s3Object.Body);

        // 5. 각 문제 영역을 비동기적으로 잘라내어 이미지(Base64)로 변환
        const imagePromises = regionRows.map(async (region) => {
            const page = pdfDoc.getPages()[region.page_number - 1]; // 페이지는 0부터 시작
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // pdf-lib의 좌표계(좌측 하단이 0,0)에 맞게 y 좌표 변환
            const cropBox = {
                x: region.x,
                y: pageHeight - region.y - region.height,
                width: region.width,
                height: region.height
            };

            // 새로운 빈 PDF 문서를 만들고, 원본 페이지의 특정 영역만 복사
            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(pdfDoc, [region.page_number - 1]);
            copiedPage.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
            newPdf.addPage(copiedPage);

            // 잘라낸 PDF를 Base64 데이터 URI로 변환하여 프론트에서 바로 이미지로 사용
            const pdfBytes = await newPdf.saveAsBase64({ dataUri: true });
            return { question_number: region.question_number, imageData: pdfBytes };
        });

        // 6. 모든 이미지 생성이 완료되면 결과를 프론트로 전송
        const images = await Promise.all(imagePromises);
        res.json(images);

    } catch (err) {
        console.error('오답노트 이미지 생성 오류:', err);
        res.status(500).json({ error: '오답노트 생성 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
