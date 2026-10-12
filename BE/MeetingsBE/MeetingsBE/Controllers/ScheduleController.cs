using MeetingsBE.Dtos;
using MeetingsBE.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace MeetingsBE.Controllers
{
   
    [ApiController]
    [Authorize]
    [Route("api/schedules")]
    public class ScheduleController : ControllerBase
    {
        private readonly IScheduleService _schedules;

        public ScheduleController(IScheduleService schedules)
        {
            _schedules = schedules;
        }

        [HttpGet]
        public async Task<IActionResult> List(CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            return ToResponse(await _schedules.ListAsync(userId.Value, ct));
        }

        [HttpGet("pending-count")]
        public async Task<IActionResult> PendingCount(CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            return ToResponse(await _schedules.PendingCountAsync(userId.Value, ct));
        }

        [HttpGet("{meetingId:long}")]
        public async Task<IActionResult> Get([FromRoute] long meetingId, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            return ToResponse(await _schedules.GetAsync(userId.Value, meetingId, ct));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateScheduleRequest request, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            return ToResponse(await _schedules.CreateAsync(userId.Value, request, ct));
        }

        [HttpPost("{meetingId:long}/respond")]
        public async Task<IActionResult> Respond([FromRoute] long meetingId, [FromBody] RespondScheduleRequest request, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            return ToResponse(await _schedules.RespondAsync(userId.Value, meetingId, request.Accept, ct));
        }

        [HttpPost("{meetingId:long}/cancel")]
        public async Task<IActionResult> Cancel([FromRoute] long meetingId, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            return ToResponse(await _schedules.CancelAsync(userId.Value, meetingId, ct));
        }

        [HttpPost("{meetingId:long}/attendance")]
        public async Task<IActionResult> MarkAttendance([FromRoute] long meetingId, [FromBody] MarkAttendanceRequest request, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            return ToResponse(await _schedules.MarkAttendanceAsync(userId.Value, meetingId, request, ct));
        }

        private IActionResult ToResponse<T>(ScheduleResult<T> result) where T : class
        {
            return result.Error switch
            {
                ScheduleError.None => Ok(result.Data),
                ScheduleError.Unauthorized => Unauthorized(),
                ScheduleError.NotFound => NotFound(new { message = result.Message ?? "Không tìm thấy cuộc họp." }),
                ScheduleError.Forbidden => StatusCode(
                    StatusCodes.Status403Forbidden,
                    new { message = result.Message ?? "Không có quyền." }),
                ScheduleError.Gone => Conflict(new { message = result.Message ?? "Cuộc họp đã bị huỷ hoặc đã bắt đầu." }),
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
