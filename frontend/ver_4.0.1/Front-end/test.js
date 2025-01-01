const dotenv = require("dotenv");

const fs = require("fs");
const { mkdir } = require("fs/promises");
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const path = require("path");

const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
  } = require("@google/generative-ai");
  const { GoogleAIFileManager } = require("@google/generative-ai/server");

  dotenv.config();
  
  const apiKey = process.env.API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);
  
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
  
  async function run() {
    // TODO Make these files available on the local file system
    // You may need to update the file paths
    
    // download submission
    const fileUrl = "https://learn.s4h.edu.vn/webservice/pluginfile.php/1981/assignsubmission_file/submission_files/195/Bibliometric%20Study%20Recommendation%20based%20on%20Artificial%20Intelligence%20for%20iLearning%20Education.pdf?token=31c5930785a5715f8cc7fb22934408d9";
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
    console.log(result.response.text());
  }
  
  run();
