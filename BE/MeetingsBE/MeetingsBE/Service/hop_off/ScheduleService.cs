using System.Net.Mail;
using MeetingsBE.Dtos;
using MeetingsBE.Hubs;
using MeetingsBE.Models;
using Microsoft.EntityFrameworkCore;

namespace MeetingsBE.Service;

public sealed class ScheduleService : IScheduleService
{
    public const int MaxInvitees = 50;
    public const int MaxTitle = 200;
    public const int MaxLocation = 500;
    public const int MaxDescription = 2000;

   
    public static readonly TimeSpan KeepAfterStart = TimeSpan.FromHours(3);

    private const string NotFoundMessage = "Không tìm thấy cuộc họp.";

    private readonly MeetingDbContext _db;
    private readonly IScheduleNotifier _notifier;
    private readonly ILogger<ScheduleService> _logger;

    public ScheduleService(MeetingDbContext db, IScheduleNotifier notifier, ILogger<ScheduleService> logger)
    {
        _db = db;
        _notifier = notifier;
        _logger = logger;
    }

    public async Task<ScheduleResult<IReadOnlyList<ScheduleView>>> ListAsync(long userId, CancellationToken ct)
    {
        var me = await FindUserAsync(userId, ct);

        if (me == null)
            return new(ScheduleError.Unauthorized);

        var from = DateTime.UtcNow - KeepAfterStart;

        var meetings = await MeetingsQuery()
            .Where(m => m.ScheduledStartAt >= from
                && (m.OwnerId == userId || m.MeetingInvites.Any(i => i.Email == me.Email)))
            .OrderBy(m => m.ScheduledStartAt)
            .ThenBy(m => m.Id)
            .ToListAsync(ct);

        var users = await UsersByEmailAsync(meetings.SelectMany(m => m.MeetingInvites), ct);

        return new(ScheduleError.None, meetings.Select(m => ToView(m, me, users)).ToList());
    }

    public async Task<ScheduleResult<PendingCountResponse>> PendingCountAsync(long userId, CancellationToken ct)
    {
        var me = await FindUserAsync(userId, ct);

        if (me == null)
            return new(ScheduleError.Unauthorized);

        var now = DateTime.UtcNow;

        var count = await _db.MeetingInvites
            .Where(i => i.Email == me.Email
                && i.Response == MeetingInvite.ResponsePending
                && i.Meeting.MeetingType == Meeting.TypeOffline
                && i.Meeting.Status != Meeting.StatusCancelled
                && i.Meeting.ScheduledStartAt > now)
            .CountAsync(ct);

        return new(ScheduleError.None, new PendingCountResponse(count));
    }

    public async Task<ScheduleResult<ScheduleView>> GetAsync(long userId, long meetingId, CancellationToken ct)
    {
        var me = await FindUserAsync(userId, ct);

        if (me == null)
            return new(ScheduleError.Unauthorized);

        var meeting = await MeetingsQuery().FirstOrDefaultAsync(m => m.Id == meetingId, ct);

        if (meeting == null)
            return new(ScheduleError.NotFound, Message: NotFoundMessage);

        if (meeting.OwnerId != userId)
            return new(ScheduleError.Forbidden, Message: "Chỉ người tạo cuộc họp mới xem được.");

        return new(ScheduleError.None, ToView(meeting, me, await UsersByEmailAsync(meeting.MeetingInvites, ct)));
    }



    public async Task<ScheduleResult<ScheduleView>> CreateAsync(long userId, CreateScheduleRequest request, CancellationToken ct)
    {
        var me = await FindUserAsync(userId, ct);

        if (me == null)
            return new(ScheduleError.Unauthorized);

        var title = request.Title?.Trim() ?? "";
        var location = request.Location?.Trim() ?? "";

        if (title.Length == 0)
            return new(ScheduleError.InvalidRequest, Message: "Vui lòng nhập tiêu đề.");

        if (title.Length > MaxTitle)
            return new(ScheduleError.InvalidRequest, Message: $"Tiêu đề tối đa {MaxTitle} ký tự.");

        if (location.Length == 0)
            return new(ScheduleError.InvalidRequest, Message: "Vui lòng nhập địa điểm.");

        if (location.Length > MaxLocation)
            return new(ScheduleError.InvalidRequest, Message: $"Địa điểm tối đa {MaxLocation} ký tự.");

        if (request.Description?.Trim().Length > MaxDescription)
            return new(ScheduleError.InvalidRequest, Message: $"Mô tả tối đa {MaxDescription} ký tự.");

        if (request.StartAt is not DateTimeOffset startAt)
            return new(ScheduleError.InvalidRequest, Message: "Vui lòng chọn giờ bắt đầu.");

        var now = DateTime.UtcNow;
        var start = startAt.UtcDateTime;

        if (start <= now)
            return new(ScheduleError.InvalidRequest, Message: "Giờ bắt đầu phải ở tương lai.");

        var wanted = (request.Emails ?? [])
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(User.NormalizeEmail)
            .Distinct()
            .ToList();

        if (wanted.Count == 0)
            return new(ScheduleError.InvalidRequest, Message: "Chưa mời ai.");

        if (wanted.Count > MaxInvitees)
            return new(ScheduleError.InvalidRequest, Message: $"Tối đa {MaxInvitees} người.");

        var invalid = wanted.Where(e => !IsEmail(e)).ToList();

        if (invalid.Count > 0)
            return new(ScheduleError.InvalidRequest, Message: $"Email không hợp lệ: {string.Join(", ", invalid)}");

        if (wanted.Contains(me.Email))
            return new(ScheduleError.InvalidRequest, Message: "Không thể tự mời chính mình.");

        var invitees = await _db.Users.AsNoTracking().Where(u => wanted.Contains(u.Email)).ToListAsync(ct);
        var missing = wanted.Except(invitees.Select(u => u.Email)).ToList();

        if (missing.Count > 0)
            return new(ScheduleError.NotFound, Message: $"Chưa có tài khoản: {string.Join(", ", missing)}");

        var meeting = Meeting.CreateOffline(userId, title, request.Description, start, location, now);

        foreach (var email in wanted)
            meeting.MeetingInvites.Add(MeetingInvite.For(email, now));

        _db.Meetings.Add(meeting);
        await _db.SaveChangesAsync(ct);

        await NotifyAsync(invitees.Select(u => u.Id), Notice("invited", meeting, me), meeting.Id);

        return new(ScheduleError.None, ToView(meeting, me, invitees.ToDictionary(u => u.Email)));
    }

    public async Task<ScheduleResult<ScheduleView>> RespondAsync(long userId, long meetingId, bool accept, CancellationToken ct)
    {
        var me = await FindUserAsync(userId, ct);

        if (me == null)
            return new(ScheduleError.Unauthorized);

        var meeting = await _db.Meetings
            .Include(m => m.Owner)
            .Include(m => m.MeetingInvites)
            .FirstOrDefaultAsync(m => m.Id == meetingId && m.MeetingType == Meeting.TypeOffline, ct);

        var invite = meeting?.MeetingInvites.FirstOrDefault(i => i.Email == me.Email);

        if (meeting == null || invite == null)
            return new(ScheduleError.NotFound, Message: NotFoundMessage);

        if (meeting.IsCancelled)
            return new(ScheduleError.Gone, Message: "Cuộc họp đã bị huỷ.");

        var now = DateTime.UtcNow;

        if (meeting.ScheduledStartAt <= now)
            return new(ScheduleError.Gone, Message: "Cuộc họp đã bắt đầu.");

        invite.Respond(accept, now);
        await _db.SaveChangesAsync(ct);

        await NotifyAsync([meeting.OwnerId], Notice("responded", meeting, me, invite.Response), meeting.Id);

        return new(ScheduleError.None, ToView(meeting, me, await UsersByEmailAsync(meeting.MeetingInvites, ct)));
    }

    public async Task<ScheduleResult<ScheduleView>> CancelAsync(long userId, long meetingId, CancellationToken ct)
    {
        var me = await FindUserAsync(userId, ct);

        if (me == null)
            return new(ScheduleError.Unauthorized);

        var meeting = await _db.Meetings
            .Include(m => m.Owner)
            .Include(m => m.MeetingInvites)
            .FirstOrDefaultAsync(m => m.Id == meetingId && m.MeetingType == Meeting.TypeOffline, ct);

        if (meeting == null)
            return new(ScheduleError.NotFound, Message: NotFoundMessage);

        if (meeting.OwnerId != userId)
            return new(ScheduleError.Forbidden, Message: "Chỉ người tạo cuộc họp mới huỷ được.");

        var users = await UsersByEmailAsync(meeting.MeetingInvites, ct);

        if (meeting.IsCancelled)
            return new(ScheduleError.None, ToView(meeting, me, users));

        meeting.Cancel(DateTime.UtcNow);
        await _db.SaveChangesAsync(ct);

        await NotifyAsync(users.Values.Select(u => u.Id), Notice("cancelled", meeting, me), meeting.Id);

        return new(ScheduleError.None, ToView(meeting, me, users));
    }

    public async Task<ScheduleResult<ScheduleView>> MarkAttendanceAsync(long userId, long meetingId, MarkAttendanceRequest request, CancellationToken ct)
    {
        var me = await FindUserAsync(userId, ct);

        if (me == null)
            return new(ScheduleError.Unauthorized);

        var attendance = request.Attendance?.Trim().ToLowerInvariant();

        if (attendance == "")
            attendance = null;

        if (!MeetingInvite.IsAttendance(attendance))
            return new(ScheduleError.InvalidRequest, Message: "Trạng thái điểm danh không hợp lệ.");

        var meeting = await _db.Meetings
            .Include(m => m.Owner)
            .Include(m => m.MeetingInvites)
            .FirstOrDefaultAsync(m => m.Id == meetingId && m.MeetingType == Meeting.TypeOffline, ct);

        if (meeting == null)
            return new(ScheduleError.NotFound, Message: NotFoundMessage);

        if (meeting.OwnerId != userId)
            return new(ScheduleError.Forbidden, Message: "Chỉ người tạo cuộc họp mới điểm danh được.");

        if (meeting.IsCancelled)
            return new(ScheduleError.Gone, Message: "Cuộc họp đã bị huỷ.");

        var now = DateTime.UtcNow;

        if (meeting.ScheduledStartAt > now)
            return new(ScheduleError.Gone, Message: "Chưa đến giờ họp.");

        var email = string.IsNullOrWhiteSpace(request.Email) ? "" : User.NormalizeEmail(request.Email);
        var invite = meeting.MeetingInvites.FirstOrDefault(i => i.Email == email);

        if (invite == null)
            return new(ScheduleError.NotFound, Message: "Người này không có trong danh sách mời.");

        invite.MarkAttendance(attendance, now);
        await _db.SaveChangesAsync(ct);

        return new(ScheduleError.None, ToView(meeting, me, await UsersByEmailAsync(meeting.MeetingInvites, ct)));
    }

    private IQueryable<Meeting> MeetingsQuery()
    {
        return _db.Meetings
            .AsNoTracking()
            .Include(m => m.Owner)
            .Include(m => m.MeetingInvites)
            .Where(m => m.MeetingType == Meeting.TypeOffline)
            .AsSplitQuery();
    }

    private Task<User?> FindUserAsync(long userId, CancellationToken ct)
        => _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);

    private async Task<Dictionary<string, User>> UsersByEmailAsync(IEnumerable<MeetingInvite> invites, CancellationToken ct)
    {
        var emails = invites.Select(i => i.Email).Distinct().ToList();

        if (emails.Count == 0)
            return [];

        return await _db.Users
            .AsNoTracking()
            .Where(u => emails.Contains(u.Email))
            .ToDictionaryAsync(u => u.Email, ct);
    }

    private async Task NotifyAsync(IEnumerable<long> userIds, ScheduleNotice notice, long meetingId)
    {
        try
        {
            await _notifier.ScheduleChangedAsync(userIds, notice);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Không gửi được thông báo lịch họp {MeetingId}", meetingId);
        }
    }

    private static ScheduleNotice Notice(string kind, Meeting meeting, User actor, string? response = null)
        => new(kind, meeting.Id, meeting.Title, Utc(meeting.ScheduledStartAt!.Value), actor.DisplayName, response);

    private static ScheduleView ToView(Meeting meeting, User viewer, IReadOnlyDictionary<string, User> users)
    {
        var isOwner = meeting.OwnerId == viewer.Id;

        return new ScheduleView(
            meeting.Id,
            meeting.Title,
            meeting.Description,
            Utc(meeting.ScheduledStartAt!.Value),
            meeting.Location ?? "",
            meeting.IsCancelled ? Meeting.StatusCancelled : Meeting.StatusScheduled,
            meeting.OwnerId,
            meeting.OwnerId == viewer.Id ? viewer.DisplayName : meeting.Owner.DisplayName,
            isOwner,
            meeting.MeetingInvites.FirstOrDefault(i => i.Email == viewer.Email)?.Response,
            meeting.MeetingInvites
                .OrderBy(i => i.Id)
                .ThenBy(i => i.Email)
                .Select(i => new ScheduleAttendeeView(
                    i.Email,
                    users.TryGetValue(i.Email, out var user) ? user.DisplayName : i.Email,
                    isOwner ? i.Response : null,
                    isOwner && i.RespondedAt is DateTime at ? Utc(at) : null,
                    isOwner ? i.Attendance : null))
                .ToList());
    }

    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static bool IsEmail(string value)
        => MailAddress.TryCreate(value, out var address) && address.Address == value;
}
