const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const db = require('./db');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
    // .env 파일의 CORS_ORIGIN 값을 사용합니다.
    // 배포 환경(Render)에서는 Render에 설정된 환경 변수 값을 사용합니다.
    origin: process.env.CORS_ORIGIN,
    credentials: true, // 필요 시 쿠키/인증 헤더 교환을 허용
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

app.get('/', (req, res) => {
    res.send('API 서버가 정상 작동 중입니다.');
});

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
