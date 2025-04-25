const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/rainfall", async (req, res) => {
  const region = req.query.region;
  if (!region) {
    return res.status(400).json({ error: "region 파라미터가 필요합니다." });
  }

  const apiUrl = `http://openapi.seoul.go.kr:8088/484c634d63796f75373754726c6b6b/json/ListRainfallService/1/5/${encodeURIComponent(
    region
  )}`;

  try {
    const response = await axios.get(apiUrl);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "API 요청 실패", details: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ 백엔드 서버 실행 중: http://localhost:${PORT}`);
});
