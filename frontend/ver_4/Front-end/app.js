require("dotenv").config(); // Nhập thư viện dotenv để sử dụng biến môi trường
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const os = require("os");
const fetch = require("node-fetch"); // Đảm bảo cài đặt node-fetch
const cors = require("cors");
const fs = require("fs");

const { mkdir } = require("fs/promises");
const { Readable } = require('stream');
const { finished } = require('stream/promises');

const app = express(); // Khởi tạo ứng dụng Express
const port = 3969;

app.use(cors()); // Sử dụng middleware CORS
app.use(bodyParser.json()); // Sử dụng body-parser để phân tích JSON

const apiKey = process.env.API_KEY;

// Khởi tạo GoogleGenerativeAI với API key từ biến môi trường
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Import GoogleGenerativeAI
const genAI = new GoogleGenerativeAI(apiKey);
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fileManager = new GoogleAIFileManager(apiKey);

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



/**
 * Uploads the given file to Gemini.
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */
async function uploadToGemini(path, mimeType) {
  const uploadResult = await fileManager.uploadFile(path, {
    mimeType,
    displayName: path,
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

/**
 * Waits for the given files to be active.
 *
 * Some files uploaded to the Gemini API need to be processed before they can
 * be used as prompt inputs. The status can be seen by querying the file's
 * "state" field.
 *
 * This implementation uses a simple blocking polling loop. Production code
 * should probably employ a more sophisticated approach.
 */
async function waitForFilesActive(files) {
  console.log("Waiting for file processing...");
  for (const name of files.map((file) => file.name)) {
    let file = await fileManager.getFile(name);
    while (file.state === "PROCESSING") {
      process.stdout.write(".")
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      file = await fileManager.getFile(name)
    }
    if (file.state !== "ACTIVE") {
      throw Error(`File ${file.name} failed to process`);
    }
  }
  console.log("...all files ready\n");
}

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

const downloadFile = (async (url, fileName) => {
  const res = await fetch(url);
  if (!fs.existsSync("downloads")) await mkdir("downloads"); //Optional if you already have downloads directory

  const destination = path.resolve("./downloads", fileName);
  if (fs.existsSync(destination)) return;

  const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
});

const PROMPT = `
Hãy chấm điểm tệp tin này dựa trên các tiêu chí sau:
- Hiểu biết chủ đề (30%): Đánh giá mức độ chính xác và sự hiểu biết của sinh viên về đề tài.
- Phân tích và lập luận (30%): Chấm theo mức độ sâu sắc của phân tích và tính logic trong lập luận.
- Sáng tạo và tư duy phản biện (20%): Chấm sự sáng tạo, cách tiếp cận mới và tư duy phản biện.
- Cấu trúc và mạch lạc (10%): Chấm bố cục rõ ràng, các phần kết nối chặt chẽ.
- Ngữ pháp và chính tả (10%): Chấm độ chính xác về ngữ pháp, từ vựng, và lỗi chính tả.

Vui lòng trả về kết quả theo định dạng JSON với cấu trúc:
{
  "comments": {
      "tiêu_chí_1": "nhận xét chi tiết theo nội dung",
      "tiêu_chí_2": "nhận xét chi tiết theo nội dung",
      "tiêu_chí_3": "nhận xét chi tiết theo nội dung"
  },
  "total_score": tổng điểm dựa trên mức độ hoàn thành theo tiêu chí của các nội dung,
  "general_comment": "nhận xét chung",
  "recommendations": "đề xuất cải tiến những phần còn yếu"
}`;

app.post("/grade-essay", async (req, res) => {
  // TODO Make these files available on the local file system
  // You may need to update the file paths
  
  // download submission
  const fileUrl = req.body.fileUrl;
  const fileName = "submission.pdf";
  await downloadFile(fileUrl, fileName);

  const files = [
    await uploadToGemini("./downloads/" + fileName, "application/pdf"),
  ];

  // Some files have a processing delay. Wait for them to be ready.
  await waitForFilesActive(files);

  const chatSession = model.startChat({
    generationConfig,
    history: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              mimeType: files[0].mimeType,
              fileUri: files[0].uri,
            },
          },
        ],
      },
      {
        role: "user",
        parts: [
          {text: PROMPT},
        ],
      },
    ],
  });

  const result = await chatSession.sendMessage("INSERT_INPUT_HERE");
  return res.status(200).json(result.response.text());
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
