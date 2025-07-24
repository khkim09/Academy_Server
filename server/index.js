const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const db = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// 라우터 등록

// 1. 신규 등록 (분반, 학생) 라우터
const registrationRoutes = require('./routes/registration');
app.use('/api/registration', registrationRoutes);

// 2. 파일 내보내기 라우터 (엑셀 다운로드)
const exportRoutes = require('./routes/export');
app.use('/api/export', exportRoutes);

// 3. 출결 관리용 라우터
const attendanceRoutes = require('./routes/attendance');
app.use('/api/attendance', attendanceRoutes);

// 4. 성적 입력용 라우터
const scoreRoutes = require('./routes/scores');
app.use('/api/scores', scoreRoutes);

// 5. 강의 자료 업로드용 라우터
const materialRoutes = require('./routes/materials');
app.use('/api/materials', materialRoutes);

// 6. 회차 관리 라우터
const roundRoutes = require('./routes/rounds');
app.use('/api/rounds', roundRoutes);

app.get('/', (req, res) => {
    res.send('API 서버가 정상 작동 중입니다.');
});

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
