using MeetingsBE.Dtos;
using MeetingsBE.Models;
using MeetingsBE.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using static MeetingsBE.Service.IAutheService;

namespace MeetingsBE.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAutheService _authService;
        private readonly IJwtService _jwtService;

        public AuthController(IAutheService authService, IJwtService jwtService)
        {
            _authService = authService;
            _jwtService = jwtService;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
        {
            var result = await _authService.LoginAsync(request, ct);

            if (result.Error != AuthError.None || result.User == null)
            {
                return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });
            }

            return Ok(AuthResponse(result.User));
        }

        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
        {
            var result = await _authService.RegisterAsync(request, ct);

            if (result.Error == AuthError.EmailTaken)
            {
                return Conflict(new { message = "Email đã được sử dụng." });
            }

            if (result.User == null)
            {
                return BadRequest(new { message = "Đăng ký thất bại." });
            }

            return Ok(AuthResponse(result.User));
        }

        [HttpGet("me")]
        public async Task<IActionResult> Me(CancellationToken ct)
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!long.TryParse(value, out var userId))
            {
                return Unauthorized();
            }

            var user = await _authService.GetByIdAsync(userId, ct);

            if (user == null)
            {
                return Unauthorized();
            }

            return Ok(UserResponse(user));
        }

        private object AuthResponse(User user) => new
        {
            accessToken = _jwtService.GenerateTokenAsync(user),
            user = UserResponse(user)
        };

        private static object UserResponse(User user) => new
        {
            id = user.Id,
            email = user.Email,
            name = user.DisplayName
        };
    }
}
