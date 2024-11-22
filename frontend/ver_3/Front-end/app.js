require("dotenv").config(); // Nhập thư viện dotenv để sử dụng biến môi trường
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const os = require("os");
const fetch = require("node-fetch"); // Đảm bảo cài đặt node-fetch
const cors = require("cors");

const app = express(); // Khởi tạo ứng dụng Express
const port = 3969;

app.use(cors()); // Sử dụng middleware CORS
app.use(bodyParser.json()); // Sử dụng body-parser để phân tích JSON

// Khởi tạo GoogleGenerativeAI với API key từ biến môi trường
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Import GoogleGenerativeAI
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Các route phục vụ tệp tĩnh
app.get("/Screens/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "Screens", req.params.filename));
});

app.get("/img/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "img", req.params.filename));
});

app.get("/CSS/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "CSS", req.params.filename));
});

let isLoggedIn = false; // Biến trạng thái đăng nhập

// Middleware kiểm tra trạng thái đăng nhập
function checkLogin(req, res, next) {
  if (isLoggedIn) {
    next();
  } else {
    res.redirect("/Main/Login.html");
  }
}

// Route cho trang đăng nhập
app.get("/Main/Login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "Main", "Login.html"));
});

// Route mặc định
app.get("/", (req, res) => {
  res.redirect("/Main/Login.html");
});

// Route cho trang chính (cần đăng nhập)
app.get("/main", checkLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "Screens", "Home.html"));
});

// Route cho chấm điểm (cần đăng nhập)
// app.post("/grade", checkLogin, async (req, res) => {
//     const essayText = req.body.text;

//     try {
//         // Gọi API AI Gemini để chấm điểm
//         const response = await genAI.gradeEssay(essayText); // Giả sử có phương thức gradeEssay

//         const score = response.score; // Lấy điểm số từ phản hồi
//         res.json({ score: score });
//     } catch (error) {
//         console.error("Error calling AI Gemini API:", error);
//         res.status(500).json({ score: 0 }); // Trả về 0 nếu có lỗi
//     }
// });
app.post("/grade-essay", async (req, res) => {
  const { essay } = req.body;
  const apiUrl =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";
  const apiKey = process.env.API_KEY; // Lấy API_KEY từ biến môi trường

  try {
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: essay }] }] }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Lỗi khi gọi API" });
    }

    const data = await response.json();
    res.json(data); // Trả về dữ liệu từ API
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Có lỗi xảy ra" });
  }
});

// Hàm để lấy địa chỉ IP của máy
function getIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1"; // Trả về localhost nếu không tìm thấy địa chỉ IP
}

// Lắng nghe trên tất cả các địa chỉ IP
app.listen(port, "0.0.0.0", () => {
  const ipAddress = getIpAddress();
  console.log(
    `Server chạy tại \n http://localhost:${port} \n http://${ipAddress}:${port}`
  );
});
