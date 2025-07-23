// DB 연결 (MySQL)
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "academy",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // ON DUPLICATE KEY UPDATE를 사용하려면 date 형식 호환을 위해 추가
    dateStrings: true
});

module.exports = pool;
