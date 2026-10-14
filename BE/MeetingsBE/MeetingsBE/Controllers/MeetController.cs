using MeetingsBE.Dtos;
using MeetingsBE.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using static MeetingsBE.Service.IMeetService;

namespace MeetingsBE.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/meetrooms")]
    public class MeetController : ControllerBase
    {
        private readonly IMeetService _meetService;

        public MeetController(IMeetService meetService)
        {
            _meetService = meetService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateMeetRoom(CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            var result = await _meetService.CreateAsync(
                userId.Value,
                ct);

            return ToResponse(result);
        }

        [HttpGet("{joinCode}")]
        public async Task<IActionResult> GetMeetRoom([FromRoute] string joinCode, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            var result = await _meetService.GetAsync(userId.Value, joinCode, ct);

            return ToResponse(result);
        }

        [HttpPost("{joinCode}/join")]
        public async Task<IActionResult> JoinMeetRoom([FromRoute] string joinCode, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            var result = await _meetService.JoinAsync(userId.Value, joinCode, ct);

            return ToResponse(result);
        }

        // Chủ phòng bật/tắt "phải duyệt mới được vào".
        [HttpPut("{joinCode}/admission")]
        public async Task<IActionResult> SetAdmission( [FromRoute] string joinCode, [FromBody] UpdateAdmissionRequest request, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            var result = await _meetService.SetAdmissionAsync(userId.Value, joinCode, request.RequireApproval, ct);

            return ToResponse(result);
        }

        // Chủ phòng khoá / mở khoá: khoá rồi thì không ai lấy được token vào thêm.
        [HttpPut("{joinCode}/lock")]
        public async Task<IActionResult> SetLock([FromRoute] string joinCode, [FromBody] UpdateLockRequest request, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            var result = await _meetService.SetLockAsync(userId.Value, joinCode, request.Locked, ct);

            return ToResponse(result);
        }

        // Chủ phòng kết thúc cuộc họp cho tất cả mọi người.
        [HttpPost("{joinCode}/end")]
        public async Task<IActionResult> EndMeeting([FromRoute] string joinCode, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            var result = await _meetService.EndAsync(userId.Value, joinCode, ct);

            return ToResponse(result);
        }

        private IActionResult ToResponse<T>(MeetResult<T> result) where T : class
        {
            return result.Error switch
            {
                MeetError.None => Ok(result.Data),
                MeetError.Unauthorized => Unauthorized(),
                MeetError.NotFound => NotFound(new { message = result.Message ?? "Không tìm thấy cuộc họp." }),
                MeetError.Forbidden => StatusCode(
                    StatusCodes.Status403Forbidden,
                    new { message = result.Message ?? "Không có quyền." }),
                MeetError.Ended => StatusCode(
                    StatusCodes.Status410Gone,
                    new { message = result.Message ?? "Cuộc họp đã kết thúc." }),
                MeetError.DailyUnavailable => StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    new { message = "Không kết nối được Daily, thử lại sau." }),
                _ => BadRequest(new { message = result.Message ?? "Dữ liệu không hợp lệ." })
            };
        }

        private long? GetCurrentUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            return long.TryParse(value, out var id) ? id : null;
        }
    }
}