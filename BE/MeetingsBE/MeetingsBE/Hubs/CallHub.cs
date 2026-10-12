using System.Security.Claims;
using MeetingsBE.Dtos;
using MeetingsBE.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MeetingsBE.Hubs;

[Authorize]
public sealed class CallHub : Hub
{
    private readonly ICallService _calls;
    private readonly CallPresence _presence;

    public CallHub(ICallService calls, CallPresence presence)
    {
        _calls = calls;
        _presence = presence;
    }

    public override Task OnConnectedAsync()
    {
        _presence.Connected(UserId, Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _presence.Disconnected(UserId, Context.ConnectionId, DateTime.UtcNow);
        return base.OnDisconnectedAsync(exception);
    }

    public async Task<CallJoinInfo> StartCall(string[] emails)
        => Unwrap(await _calls.StartAsync(UserId, emails, Context.ConnectionAborted));

    public async Task<CallJoinInfo> Accept(long callId)
        => Unwrap(await _calls.AcceptAsync(UserId, callId, Context.ConnectionAborted));

    public async Task Decline(long callId)
        => Unwrap(await _calls.DeclineAsync(UserId, callId, Context.ConnectionAborted));

    public async Task Cancel(long callId)
        => Unwrap(await _calls.CancelAsync(UserId, callId, Context.ConnectionAborted));

    public async Task Leave(long callId)
        => Unwrap(await _calls.LeaveAsync(UserId, callId, Context.ConnectionAborted));

    public async Task EndForAll(long callId)
        => Unwrap(await _calls.EndForAllAsync(UserId, callId, Context.ConnectionAborted));

    public async Task<CallJoinInfo> Rejoin(long callId)
        => Unwrap(await _calls.RejoinAsync(UserId, callId, Context.ConnectionAborted));

    public Task<IReadOnlyList<CallView>> GetMyCalls()
        => _calls.GetMyCallsAsync(UserId, Context.ConnectionAborted);

    private long UserId
        => long.TryParse(Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id)
            ? id
            : throw new HubException("Chưa đăng nhập.");

    private static T Unwrap<T>(CallResult<T> result) where T : class
    {
        if (result.Error == CallError.None && result.Data != null)
            return result.Data;

        throw new HubException(result.Message ?? result.Error switch
        {
            CallError.Unauthorized => "Chưa đăng nhập.",
            CallError.NotFound => "Không tìm thấy cuộc gọi.",
            CallError.Forbidden => "Không có quyền.",
            CallError.Gone => "Cuộc gọi đã kết thúc.",
            CallError.DailyUnavailable => "Không kết nối được Daily, thử lại sau.",
            _ => "Dữ liệu không hợp lệ."
        });
    }
}
