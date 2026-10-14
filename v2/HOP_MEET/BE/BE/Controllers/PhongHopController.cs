using System.IdentityModel.Tokens.Jwt;
using BE.Dtos;
using BE.Service.phong_hop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BE.Controllers
{

    [ApiController]
    [Route("api/meetrooms")]
    [Authorize]
    public class PhongHopController : ControllerBase
    {
        private readonly IPhongHopService _phongHop;

        public PhongHopController(IPhongHopService phongHop)
        {
            _phongHop = phongHop;
        }

        private long UserId => long.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

        [HttpPost]
        public async Task<IActionResult> Create(CancellationToken ct)
        {
            try
            {
                return Ok(await _phongHop.CreateMeetingAsync(UserId, ct));
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpGet("{joinCode}")]
        public async Task<IActionResult> GetInfo(string joinCode, CancellationToken ct)
        {
            var info = await _phongHop.GetMeetingInfoAsync(joinCode, UserId, ct);

            return info is null
                ? NotFound(new { message = "Không tìm thấy cuộc họp hoặc cuộc họp đã kết thúc." })
                : Ok(info);
        }

        [HttpPut("{joinCode}/admission")]
        public async Task<IActionResult> SetAdmission(string joinCode, [FromBody] SetAdmissionRequest request, CancellationToken ct)
        {
            try
            {
                var result = await _phongHop.SetAdmissionAsync(joinCode, UserId, request.RequireApproval, ct);

                return result is null
                    ? NotFound(new { message = "Không tìm thấy cuộc họp." })
                    : Ok(new { requireApproval = result.Value });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
        }
    }
}
