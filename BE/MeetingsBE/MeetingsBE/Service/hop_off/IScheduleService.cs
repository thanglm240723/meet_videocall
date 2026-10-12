using MeetingsBE.Dtos;

namespace MeetingsBE.Service;

public enum ScheduleError
{
    None,
    InvalidRequest,
    Unauthorized,
    NotFound,
    Forbidden,
    Gone
}

public sealed record ScheduleResult<T>(ScheduleError Error, T? Data = null, string? Message = null) where T : class;

public interface IScheduleService
{
  
    Task<ScheduleResult<IReadOnlyList<ScheduleView>>> ListAsync(long userId, CancellationToken ct);

    
    Task<ScheduleResult<PendingCountResponse>> PendingCountAsync(long userId, CancellationToken ct);

    Task<ScheduleResult<ScheduleView>> GetAsync(long userId, long meetingId, CancellationToken ct);

    Task<ScheduleResult<ScheduleView>> CreateAsync(long userId, CreateScheduleRequest request, CancellationToken ct);

    Task<ScheduleResult<ScheduleView>> RespondAsync(long userId, long meetingId, bool accept, CancellationToken ct);

    Task<ScheduleResult<ScheduleView>> CancelAsync(long userId, long meetingId, CancellationToken ct);

    Task<ScheduleResult<ScheduleView>> MarkAttendanceAsync(long userId, long meetingId, MarkAttendanceRequest request, CancellationToken ct);
}
