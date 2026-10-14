using MeetingsBE.Dtos;

namespace MeetingsBE.Service;

public enum CallError
{
    None,
    InvalidRequest,
    Unauthorized,
    NotFound,
    Forbidden,
    Gone,
    DailyUnavailable
}

public sealed record CallResult<T>(CallError Error, T? Data = null, string? Message = null) where T : class;

public interface ICallService
{
    Task<CallResult<CallJoinInfo>> StartAsync(long userId, IReadOnlyList<string> emails, CancellationToken ct);

    Task<CallResult<CallJoinInfo>> AcceptAsync(long userId, long callId, CancellationToken ct);

    Task<CallResult<CallView>> DeclineAsync(long userId, long callId, CancellationToken ct);

    Task<CallResult<CallView>> CancelAsync(long userId, long callId, CancellationToken ct);

    Task<CallResult<CallView>> LeaveAsync(long userId, long callId, CancellationToken ct);

    Task<CallResult<CallView>> EndForAllAsync(long userId, long callId, CancellationToken ct);

    Task<CallResult<CallJoinInfo>> RejoinAsync(long userId, long callId, CancellationToken ct);

    Task<IReadOnlyList<CallView>> GetMyCallsAsync(long userId, CancellationToken ct);

    Task ExpireRingsAsync(DateTime now, CancellationToken ct);

    Task HandleOfflineAsync(long userId, CancellationToken ct);
}
