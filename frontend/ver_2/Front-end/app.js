const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const os = require("os");

const app = express();
const port = 3969;

app.use(bodyParser.json()); // Phục vụ file tĩnh từ thư mục
// app.use(
//   express.static(path.join(__dirname, "Screens"), {
//     "Content-Type": "text/html",
//   })
// );
app.get("/Screens/:filename", (req, res) => {
    res.sendFile(path.join(__dirname, "Screens", req.params.filename));
  });
  
app.get("/img/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "img", req.params.filename));
});

// app.use(
//   express.static(path.join(__dirname, "img"), {
//     setHeaders: (res, path, stat) => {
//       const extname = path.extname(path).toLowerCase();
//       switch (extname) {
//         case ".png":
//           res.setHeader("Content-Type", "image/png");
//           break;
//         case ".jpg":
//         case ".jpeg":
//           res.setHeader("Content-Type", "image/jpeg");
//           break;
//         case ".gif":
//           res.setHeader("Content-Type", "image/gif");
//           break;
//         case ".svg":
//           res.setHeader("Content-Type", "image/svg+xml");
//           break;
//         // Thêm các loại hình ảnh khác tại đây
//       }
//     },
//   })
// );

// app.use(
//   express.static(path.join(__dirname, "CSS"), { "Content-Type": "text/css" })
// );

// Biến để lưu trạng thái đăng nhập

app.get("/CSS/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "CSS", req.params.filename));
});

let isLoggedIn = false;

// Middleware kiểm tra trạng thái đăng nhập
function checkLogin(req, res, next) {
  if (isLoggedIn) {
    next(); // Nếu đã đăng nhập, cho phép truy cập
  } else {
    res.redirect("/Main/Login.html"); // Nếu chưa đăng nhập, chuyển hướng đến trang đăng nhập
  }
}

// Route cho trang đăng nhập
app.get("/Main/Login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "Main", "Login.html"));
});

// Route mặc định
app.get("/", (req, res) => {
  res.redirect("/Main/Login.html"); // Chuyển hướng đến trang đăng nhập
});

// Xử lý đăng nhập
// app.post("/login", (req, res) => {
//   const { username, password } = req.body;

//   // Kiểm tra thông tin đăng nhập (thay thế bằng logic thực tế)
//   if (username === "admin" && password === "password") {
//     isLoggedIn = true; // Đặt trạng thái đăng nhập
//     res.json({ success: true });
//   } else {
//     res.json({ success: false, message: "Thông tin đăng nhập không đúng" });
//   }
// });

// Route cho trang chính (cần đăng nhập)
app.get("/main", checkLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "Screens", "Home.html"));
});

// Route cho chấm điểm (cần đăng nhập)
app.post("/grade", checkLogin, (req, res) => {
  const essayText = req.body.text;

  // Giả lập một điểm số cho bài làm
  const score = Math.floor(Math.random() * 101);

  res.json({ score: score });
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
