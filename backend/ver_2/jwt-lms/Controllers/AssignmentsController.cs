using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Microsoft.Extensions.Logging;

namespace jwt_lms.Controllers
{

    [ApiController]
    [Route("[controller]")]
    public class AssignmentsController : ControllerBase
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<AssignmentsController> _logger;

        public AssignmentsController(HttpClient httpClient, ILogger<AssignmentsController> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        [HttpGet("assigns/{cmid}")]
        public async Task<IActionResult> FetchCourses(string cmid)
        {
            var url = $"{API.MoodleUrl}/webservice/rest/server.php";
            var token = Request.Cookies["token"]; // Lấy token từ cookie

            if (string.IsNullOrEmpty(token))
            {
                return Unauthorized("Token không hợp lệ hoặc không tồn tại.");
            }

            var parameters = new
            {
                moodlewsrestformat = "json",
                wstoken = token,
                wsfunction = "core_course_get_course_module",
                cmid = cmid
            };

            try
            {
                var content = new FormUrlEncodedContent(parameters.ToKeyValuePairs());
                var response = await _httpClient.GetAsync($"{url}?{await content.ReadAsStringAsync()}");

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Error fetching courses: {errorContent}");
                    return BadRequest($"Error fetching courses: {errorContent}");
                }

                var jsonResponse = await response.Content.ReadAsStringAsync();
                _logger.LogInformation($"Phản hồi từ Moodle: {jsonResponse}");

                if (string.IsNullOrWhiteSpace(jsonResponse))
                {
                    return BadRequest("Không có dữ liệu trả về từ API.");
                }

                dynamic data;
                try
                {
                    data = JsonConvert.DeserializeObject(jsonResponse);
                }
                catch (JsonException ex)
                {
                    _logger.LogError(ex, "Lỗi phân tích cú pháp JSON.");
                    return BadRequest("Lỗi phân tích cú pháp dữ liệu.");
                }

                // Kiểm tra lỗi từ Moodle
                if (data.errorcode != null)
                {
                    return BadRequest(data.message.ToString());
                }

                // In ra toàn bộ thông tin
                var fullResponse = JsonConvert.SerializeObject(data, Formatting.Indented);
                _logger.LogInformation($"Dữ liệu chi tiết: {fullResponse}");

                return Ok(fullResponse);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Đã xảy ra lỗi khi gọi API Moodle.");
                return StatusCode(500, $"Đã xảy ra lỗi máy chủ: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi không xác định.");
                return StatusCode(500, "Đã xảy ra lỗi không xác định.");
            }
        }
    }
}