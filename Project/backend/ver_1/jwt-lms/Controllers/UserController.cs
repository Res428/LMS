using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace jwt_lms.Controllers
{
    // Model cho yêu cầu đăng nhập
    public class LoginRequest
    {
        public string Username { get; set; }
        public string Password { get; set; }
    }

    [ApiController]
    [Route("[controller]")]
    public class UserController : ControllerBase
    {
        private readonly HttpClient _httpClient;

        public UserController(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            // Kiểm tra dữ liệu đầu vào
            if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest("Tên người dùng và mật khẩu không được để trống.");
            }

            // Tạo URL cho API
            var url = $"{API.MoodleUrl}/login/token.php?service=moodle_mobile_app&username={Uri.EscapeDataString(request.Username)}&password={Uri.EscapeDataString(request.Password)}";

            try
            {
                // Gọi API
                var response = await _httpClient.PostAsync(url, null);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    return BadRequest($"Đăng nhập không thành công: {errorContent}");
                }

                var jsonResponse = await response.Content.ReadAsStringAsync();
                dynamic json = JsonConvert.DeserializeObject(jsonResponse);

                // Kiểm tra lỗi
                if (json.error != null)
                {
                    return BadRequest(json.error.ToString());
                }

                // Xóa token cũ nếu có
                if (Request.Cookies.ContainsKey("token"))
                {
                    Response.Cookies.Delete("token");
                }

                // Lưu token mới vào cookie
                Response.Cookies.Append("token", json.token.ToString(), new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.Strict
                });

                // Trả về token cho client
                return Ok(new { Token = json.token.ToString() });
            }
            catch (Exception ex)
            {
                // Log lỗi
                Console.WriteLine($"Lỗi: {ex.Message}");
                return StatusCode(500, "Đã xảy ra lỗi máy chủ.");
            }
        }
    }
}
