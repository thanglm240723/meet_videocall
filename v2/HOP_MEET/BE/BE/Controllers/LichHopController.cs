using System.IdentityModel.Tokens.Jwt;
using BE.Dtos;
using BE.Realtime;
using BE.Service.lich_hop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace BE.Controllers
{
    
    [ApiController]
    [Route("api/schedules")]
    [Authorize]
    public class LichHopController(LichHopService lichHop, IHubContext<CuocGoiHub> hub) : ControllerBase
    {
        private long UserId => long.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

        [HttpGet]
        public async Task<IActionResult> List(CancellationToken ct) => Ok(await lichHop.ListAsync(UserId, ct));

        [HttpGet("pending-count")]
        public async Task<IActionResult> PendingCount(CancellationToken ct) =>
            Ok(new { count = await lichHop.PendingCountAsync(UserId, ct) });

        [HttpGet("{id:long}")]
        public async Task<IActionResult> Get(long id, CancellationToken ct)
        {
            var view = await lichHop.GetAsync(id, UserId, ct);
            return view is null ? NotFound(new { message = "Không tìm thấy cuộc họp." }) : Ok(view);
        }

        [HttpPost]
        public Task<IActionResult> Create([FromBody] NewScheduleRequest req, CancellationToken ct) =>
            Run(() => lichHop.CreateAsync(UserId, req, ct));

        [HttpPost("{id:long}/respond")]
        public Task<IActionResult> Respond(long id, [FromBody] RespondRequest req, CancellationToken ct) =>
            Run(() => lichHop.RespondAsync(id, UserId, req.Accept, ct));

        [HttpPost("{id:long}/cancel")]
        public Task<IActionResult> Cancel(long id, CancellationToken ct) =>
            Run(() => lichHop.CancelAsync(id, UserId, ct));

        [HttpPost("{id:long}/attendance")]
        public Task<IActionResult> Attendance(long id, [FromBody] AttendanceRequest req, CancellationToken ct) =>
            Run(async () => new ScheduleResult(await lichHop.MarkAttendanceAsync(id, UserId, req, ct), null, []));

        private async Task<IActionResult> Run(Func<Task<ScheduleResult>> action)
        {
            try
            {
                var result = await action();

                if (result.Notice is not null && result.NotifyUserIds.Count > 0)
                {
                    var groups = result.NotifyUserIds.Select(CuocGoiHub.UserGroup).ToList();
                    await hub.Clients.Groups(groups).SendAsync("ScheduleChanged", result.Notice);
                }

                return Ok(result.View);
            }
            catch (KeyNotFoundException) { return NotFound(new { message = "Không tìm thấy cuộc họp." }); }
            catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message }); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }
    }
}
