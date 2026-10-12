using System.Net.Mail;
using MeetingsBE.Dtos;
using MeetingsBE.Hubs;
using MeetingsBE.Models;
using Microsoft.EntityFrameworkCore;

namespace MeetingsBE.Service;

public sealed class CallService : ICallService
{
    public const int MaxCallees = 9;
    public static readonly TimeSpan RingTime = TimeSpan.FromSeconds(30);
    public static readonly TimeSpan RoomLifetime = TimeSpan.FromHours(2);

    private const string DailyDown = "Không kết nối được Daily, thử lại sau.";
    private const string CallOver = "Cuộc gọi đã kết thúc.";

    private readonly MeetingDbContext _db;
    private readonly IDailyClient _daily;
    private readonly ICallNotifier _notifier;
    private readonly CallPresence _presence;
    private readonly CallLocks _locks;
    private readonly ILogger<CallService> _logger;

    public CallService(MeetingDbContext db,IDailyClient daily,ICallNotifier notifier, CallPresence presence, CallLocks locks,ILogger<CallService> logger)
    {
        _db = db;
        _daily = daily;
        _notifier = notifier;
        _presence = presence;
        _locks = locks;
        _logger = logger;
    }

    public async Task<CallResult<CallJoinInfo>> StartAsync(long userId, IReadOnlyList<string> emails, CancellationToken ct)
    {
        var wanted = (emails ?? [])
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(User.NormalizeEmail)
            .Distinct()
            .ToList();

        if (wanted.Count == 0)
            return new(CallError.InvalidRequest, Message: "Chưa nhập email.");

        if (wanted.Count > MaxCallees)
            return new(CallError.InvalidRequest, Message: $"Tối đa {MaxCallees} người.");

        var invalid = wanted.Where(e => !IsEmail(e)).ToList();

        if (invalid.Count > 0)
            return new(CallError.InvalidRequest, Message: $"Email không hợp lệ: {string.Join(", ", invalid)}");

        var caller = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (caller == null)
            return new(CallError.Unauthorized);

        if (wanted.Contains(caller.Email))
            return new(CallError.InvalidRequest, Message: "Không thể tự gọi cho chính mình.");

        var callees = await _db.Users.Where(u => wanted.Contains(u.Email)).ToListAsync(ct);
        var missing = wanted.Except(callees.Select(u => u.Email)).ToList();

        if (missing.Count > 0)
            return new(CallError.NotFound, Message: $"Chưa có tài khoản: {string.Join(", ", missing)}");

        var now = DateTime.UtcNow;
        var expiresAt = now.Add(RoomLifetime);

        var call = Call.Start(caller.Id, callees.Count > 1, now);
        var owner = CallMember.Owner(caller, now);
        owner.Join(now);
        call.CallMembers.Add(owner);

        foreach (var callee in callees)
            call.CallMembers.Add(CallMember.Callee(callee, _presence.IsOnline(callee.Id), now, RingTime));

        DailyRoomResponse room;
        string token;

        try
        {
            room = await _daily.CreateRoomAsync($"call-{Guid.NewGuid():N}", callees.Count + 1, Utc(expiresAt), ct);
            token = await _daily.CreateTokenAsync(room.DailyRoomName, caller.Id, caller.DisplayName, true, Utc(expiresAt), ct);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Không tạo được phòng Daily cho cuộc gọi của user {UserId}", userId);
            return new(CallError.DailyUnavailable, Message: DailyDown);
        }

        call.DailyRoom = CallDailyRoom.Create(call, room.DailyRoomName, room.DailyRoomUrl, now, expiresAt);
        _db.Calls.Add(call);
        await _db.SaveChangesAsync(ct);

        var view = ToView(call);
        await _notifier.IncomingCallAsync(callees.Select(c => c.Id), view);

        return new(CallError.None, new CallJoinInfo(view, room.DailyRoomUrl, token));
    }

    public Task<CallResult<CallJoinInfo>> AcceptAsync(long userId, long callId, CancellationToken ct)
    {
        return WithCallAsync<CallJoinInfo>(userId, callId, ct, async (call, me, now) =>
        {
            if (call.IsOver)
                return new(CallError.Gone, Message: CallOver);

            if (!me.IsRinging)
            {
                return new(CallError.Gone, Message: me.ResponseStatus == CallMember.ResponseAccepted
                    ? "Đã nghe máy ở thiết bị khác."
                    : "Cuộc gọi không còn đổ chuông.");
            }

            var token = await TokenAsync(call, me, ct);

            if (token == null)
                return new(CallError.DailyUnavailable, Message: DailyDown);

            me.Accept(now);
            call.Activate(now);

            var view = await CommitAsync(call, ct);
            return new(CallError.None, new CallJoinInfo(view, call.DailyRoom!.DailyRoomUrl, token));
        });
    }

    public Task<CallResult<CallView>> DeclineAsync(long userId, long callId, CancellationToken ct)
    {
        return WithCallAsync<CallView>(userId, callId, ct, async (call, me, now) =>
        {
            if (call.IsOver || !me.IsRinging)
                return new(CallError.None, ToView(call));

            me.Decline(now);
            FinishIfNobodyRinging(call, now);

            return new(CallError.None, await CommitAsync(call, ct));
        });
    }

    public Task<CallResult<CallView>> CancelAsync(long userId, long callId, CancellationToken ct)
    {
        return WithCallAsync<CallView>(userId, callId, ct, async (call, me, now) =>
        {
            if (!me.IsOwner)
                return new(CallError.Forbidden, Message: "Chỉ người gọi mới huỷ được cuộc gọi.");

            return await LeaveCoreAsync(call, me, now, ct);
        });
    }

    public Task<CallResult<CallView>> LeaveAsync(long userId, long callId, CancellationToken ct)
    {
        return WithCallAsync<CallView>(userId, callId, ct, (call, me, now) => LeaveCoreAsync(call, me, now, ct));
    }

    public Task<CallResult<CallView>> EndForAllAsync(long userId, long callId, CancellationToken ct)
    {
        return WithCallAsync<CallView>(userId, callId, ct, async (call, me, now) =>
        {
            if (!me.IsOwner || !call.IsGroup)
                return new(CallError.Forbidden, Message: "Chỉ người gọi mới kết thúc được cuộc gọi.");

            if (call.IsOver)
                return new(CallError.None, ToView(call));

            call.Finish(Call.EndOwnerEndedAll, now);

            return new(CallError.None, await CommitAsync(call, ct));
        });
    }

    public Task<CallResult<CallJoinInfo>> RejoinAsync(long userId, long callId, CancellationToken ct)
    {
        return WithCallAsync<CallJoinInfo>(userId, callId, ct, async (call, me, now) =>
        {
            if (call.IsOver)
                return new(CallError.Gone, Message: CallOver);

            if (!call.IsGroup && !me.InRoom && !me.IsRinging)
                return new(CallError.Forbidden, Message: "Cuộc gọi 1-1 này không vào lại được.");

            var token = await TokenAsync(call, me, ct);

            if (token == null)
                return new(CallError.DailyUnavailable, Message: DailyDown);

            if (me.IsRinging)
                me.Accept(now);
            else
                me.Join(now);

            if (!me.IsOwner)
                call.Activate(now);

            var view = await CommitAsync(call, ct);
            return new(CallError.None, new CallJoinInfo(view, call.DailyRoom!.DailyRoomUrl, token));
        });
    }

    public async Task<IReadOnlyList<CallView>> GetMyCallsAsync(long userId, CancellationToken ct)
    {
        var calls = await CallsQuery()
            .Where(c => (c.Status == Call.StatusRinging || c.Status == Call.StatusActive)
                        && c.CallMembers.Any(m => m.UserId == userId))
            .ToListAsync(ct);

        return calls
            .Where(c =>
            {
                var me = c.CallMembers.First(m => m.UserId == userId);
                return me.IsRinging || me.InRoom || (c.IsGroup && c.Status == Call.StatusActive);
            })
            .Select(ToView)
            .ToList();
    }

    public async Task ExpireRingsAsync(DateTime now, CancellationToken ct)
    {
        var callIds = await _db.CallMembers
            .Where(m => m.DeliveryChannel == CallMember.ChannelInApp
                        && m.ResponseStatus == CallMember.ResponsePending
                        && m.RingExpiresAt <= now
                        && (m.Call.Status == Call.StatusRinging || m.Call.Status == Call.StatusActive))
            .Select(m => m.CallId)
            .Distinct()
            .ToListAsync(ct);

        foreach (var callId in callIds)
        {
            using var _ = await _locks.AcquireAsync(callId, ct);

            var call = await LoadAsync(callId, ct);

            if (call == null || call.IsOver)
                continue;

            foreach (var member in call.CallMembers.Where(m => m.IsRinging && m.RingExpiresAt <= now))
                member.Miss(now);

            FinishIfNobodyRinging(call, now);
            await CommitAsync(call, ct);
        }
    }

    public async Task HandleOfflineAsync(long userId, CancellationToken ct)
    {
        var callIds = await _db.CallJoinLogs
            .Where(l => l.LeftAt == null
                        && l.CallMember.UserId == userId
                        && (l.CallMember.Call.Status == Call.StatusRinging || l.CallMember.Call.Status == Call.StatusActive))
            .Select(l => l.CallMember.CallId)
            .Distinct()
            .ToListAsync(ct);

        foreach (var callId in callIds)
            await LeaveAsync(userId, callId, ct);
    }

    private async Task<CallResult<CallView>> LeaveCoreAsync(Call call, CallMember me, DateTime now, CancellationToken ct)
    {
        if (call.IsOver)
            return new(CallError.None, ToView(call));

        if (me.IsOwner && call.Status == Call.StatusRinging)
        {
            call.Finish(Call.EndCallerCancelled, now);
        }
        else if (me.InRoom)
        {
            me.CloseLog(now);

            if (!call.IsGroup)
                call.Finish(Call.EndParticipantLeft, now);
            else if (!call.CallMembers.Any(m => m.InRoom))
                call.Finish(Call.EndNoParticipants, now);
        }
        else
        {
            return new(CallError.None, ToView(call));
        }

        return new(CallError.None, await CommitAsync(call, ct));
    }

    private static void FinishIfNobodyRinging(Call call, DateTime now)
    {
        if (call.Status != Call.StatusRinging || call.CallMembers.Any(m => m.IsRinging))
            return;

        var allDeclined = call.CallMembers
            .Where(m => !m.IsOwner)
            .All(m => m.ResponseStatus == CallMember.ResponseDeclined);

        call.Finish(allDeclined ? Call.EndDeclined : Call.EndNoAnswer, now);
    }

    private async Task<CallResult<T>> WithCallAsync<T>(
        long userId,
        long callId,
        CancellationToken ct,
        Func<Call, CallMember, DateTime, Task<CallResult<T>>> action) where T : class
    {
        using var _ = await _locks.AcquireAsync(callId, ct);

        var call = await LoadAsync(callId, ct);

        if (call == null)
            return new(CallError.NotFound, Message: "Không tìm thấy cuộc gọi.");

        var me = call.CallMembers.FirstOrDefault(m => m.UserId == userId);

        if (me == null)
            return new(CallError.Forbidden, Message: "Bạn không thuộc cuộc gọi này.");

        return await action(call, me, DateTime.UtcNow);
    }

    private async Task<CallView> CommitAsync(Call call, CancellationToken ct)
    {
        await _db.SaveChangesAsync(ct);

        var view = ToView(call);
        var userIds = call.CallMembers.Where(m => m.UserId != null).Select(m => m.UserId!.Value).ToList();

        if (call.IsOver)
        {
            await _notifier.CallEndedAsync(userIds, view);
            _locks.Forget(call.Id);
        }
        else
        {
            await _notifier.CallUpdatedAsync(userIds, view);
        }

        return view;
    }

    private async Task<string?> TokenAsync(Call call, CallMember me, CancellationToken ct)
    {
        var room = call.DailyRoom!;

        try
        {
            return await _daily.CreateTokenAsync(
                room.DailyRoomName,
                me.UserId!.Value,
                me.DisplayName ?? me.Email,
                me.IsOwner,
                Utc(room.ExpiresAt),
                ct);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Không tạo được token Daily cho cuộc gọi {CallId}", call.Id);
            return null;
        }
    }

    private IQueryable<Call> CallsQuery()
    {
        return _db.Calls
            .Include(c => c.CallMembers).ThenInclude(m => m.CallJoinLogs)
            .Include(c => c.DailyRoom)
            .AsSplitQuery();
    }

    private Task<Call?> LoadAsync(long callId, CancellationToken ct)
        => CallsQuery().FirstOrDefaultAsync(c => c.Id == callId, ct);

    private CallView ToView(Call call)
    {
        var owner = call.CallMembers.First(m => m.IsOwner);

        return new CallView(
            call.Id,
            call.CallType,
            call.Status,
            call.EndReason,
            call.OwnerId,
            owner.DisplayName ?? owner.Email,
            call.StartedAt,
            call.CallMembers
                .OrderByDescending(m => m.IsOwner)
                .ThenBy(m => m.Id)
                .Select(m => new CallMemberView(
                    m.UserId ?? 0,
                    m.DisplayName ?? m.Email,
                    m.Email,
                    m.IsOwner,
                    m.ResponseStatus,
                    m.Result,
                    m.InRoom,
                    m.UserId is long id && _presence.IsOnline(id)))
                .ToList());
    }

    private static DateTimeOffset Utc(DateTime value)
        => new(DateTime.SpecifyKind(value, DateTimeKind.Utc));

    private static bool IsEmail(string value)
        => MailAddress.TryCreate(value, out var address) && address.Address == value;
}
