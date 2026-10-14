using BE.Dtos;
using BE.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;

namespace BE.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
        {
            try
            {
                var user = await _authService.RegisterUserAsync(request, ct);
                return Ok(user);
            }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
        {
            try
            {
                return Ok(await _authService.LoginUserAsync(request, ct));
            }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> Me(CancellationToken ct)
        {
            var sub = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            if (!long.TryParse(sub, out var id)) return Unauthorized();

            var user = await _authService.GetUserAsync(id, ct);
            return user is null ? NotFound() : Ok(user);
        }
    }
}
