using BE.Data;
using BE.Dtos;
using BE.Model;
using Microsoft.EntityFrameworkCore;

namespace BE.Service.lich_hop
{
    // Lich hop offline: tao, moi, tham gia / tu choi, huy, diem danh.
    // Nguoi duoc moi luu o Meeting_invites (theo email, phai co tai khoan).
    public class LichHopService(AppDbContext db)
    {
        private const string StatusScheduled = "scheduled";
        private const string StatusCancelled = "cancelled";
        private const int MaxInvitees = 50;

        // timestamp luu khong mui gio -> doc ra la Unspecified, gan lai Utc de JSON co 'Z'
        private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);
        private static DateTime? Utc(DateTime? d) => d is null ? null : Utc(d.Value);

        public async Task<List<ScheduleViewDto>> ListAsync(long userId, CancellationToken ct)
        {
            var email = await EmailOfAsync(userId, ct);
            var meetings = await Query()
                .Where(m => m.OwnerId == userId || m.Invites.Any(i => i.Email == email))
                .OrderBy(m => m.ScheduledStartAt)
                .ToListAsync(ct);

            return await ToViewsAsync(meetings, userId, email, ct);
        }

        public async Task<int> PendingCountAsync(long userId, CancellationToken ct)
        {
            var email = await EmailOfAsync(userId, ct);
            var now = DateTime.UtcNow;

            return await db.MeetingInvites.CountAsync(i => i.Email == email && i.Response == "pending"
                && i.Meeting.MeetingType == "offline" && i.Meeting.Status == StatusScheduled
                && i.Meeting.ScheduledStartAt > now, ct);
        }

        public async Task<ScheduleViewDto?> GetAsync(long meetingId, long userId, CancellationToken ct)
        {
            var email = await EmailOfAsync(userId, ct);
            var meeting = await Query().FirstOrDefaultAsync(m => m.Id == meetingId, ct);

            if (meeting is null || (meeting.OwnerId != userId && meeting.Invites.All(i => i.Email != email)))
                return null;

            return (await ToViewsAsync([meeting], userId, email, ct))[0];
        }

        public async Task<ScheduleResult> CreateAsync(long userId, NewScheduleRequest req, CancellationToken ct)
        {
            var owner = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                ?? throw new InvalidOperationException("Không tìm thấy tài khoản.");

            var title = req.Title?.Trim() ?? "";
            var location = req.Location?.Trim() ?? "";
            var startAt = req.StartAt.ToUniversalTime();

            if (title.Length is 0 or > 200) throw new InvalidOperationException("Tiêu đề không hợp lệ (1–200 ký tự).");
            if (location.Length is 0 or > 500) throw new InvalidOperationException("Địa điểm không hợp lệ (1–500 ký tự).");
            if (startAt <= DateTime.UtcNow) throw new InvalidOperationException("Giờ bắt đầu phải ở tương lai.");

            var emails = (req.Emails ?? []).Where(e => !string.IsNullOrWhiteSpace(e))
                .Select(User.NormalizeEmail).Where(e => e != owner.Email).Distinct().ToList();

            if (emails.Count == 0) throw new InvalidOperationException("Hãy mời ít nhất một người.");
            if (emails.Count > MaxInvitees) throw new InvalidOperationException($"Chỉ mời được tối đa {MaxInvitees} người.");

            var invitees = await db.Users.Where(u => emails.Contains(u.Email)).ToListAsync(ct);
            var missing = emails.Except(invitees.Select(u => u.Email)).ToList();

            if (missing.Count > 0)
                throw new InvalidOperationException($"Chưa có tài khoản: {string.Join(", ", missing)}.");

            var now = DateTime.UtcNow;
            var meeting = new Meeting
            {
                OwnerId = userId,
                Title = title,
                Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
                MeetingType = "offline",
                CreationMode = "scheduled",
                ScheduledStartAt = startAt,
                Location = location,
                Status = StatusScheduled,
                CreatedAt = now,
                UpdatedAt = now,
            };

            foreach (var email in emails)
                meeting.Invites.Add(new MeetingInvite { Email = email, DeliveryStatus = "sent", LastSentAt = now, CreatedAt = now });

            db.Meetings.Add(meeting);
            await db.SaveChangesAsync(ct);

            var view = (await GetAsync(meeting.Id, userId, ct))!;
            var notice = new ScheduleNoticeDto("invited", meeting.Id, title, Utc(startAt), owner.DisplayName, null);

            return new ScheduleResult(view, notice, invitees.Select(u => u.Id).ToList());
        }

        public async Task<ScheduleResult> RespondAsync(long meetingId, long userId, bool accept, CancellationToken ct)
        {
            var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
            var meeting = await Query().FirstOrDefaultAsync(m => m.Id == meetingId, ct)
                ?? throw new KeyNotFoundException();
            var invite = meeting.Invites.FirstOrDefault(i => i.Email == user.Email)
                ?? throw new KeyNotFoundException();

            if (meeting.Status == StatusCancelled) throw new InvalidOperationException("Cuộc họp đã bị huỷ.");
            if (meeting.ScheduledStartAt <= DateTime.UtcNow)
                throw new InvalidOperationException("Cuộc họp đã bắt đầu, không thể đổi phản hồi.");

            invite.Response = accept ? "accepted" : "declined";
            invite.RespondedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            var view = (await GetAsync(meetingId, userId, ct))!;
            var notice = new ScheduleNoticeDto("responded", meetingId, meeting.Title,
                Utc(meeting.ScheduledStartAt!.Value), user.DisplayName, invite.Response);

            return new ScheduleResult(view, notice, [meeting.OwnerId]);
        }

        public async Task<ScheduleResult> CancelAsync(long meetingId, long userId, CancellationToken ct)
        {
            var meeting = await OwnedAsync(meetingId, userId, ct);

            if (meeting.Status != StatusCancelled)
            {
                meeting.Status = StatusCancelled;
                meeting.EndedAt = meeting.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
            }

            var emails = meeting.Invites.Select(i => i.Email).ToList();
            var ids = await db.Users.Where(u => emails.Contains(u.Email)).Select(u => u.Id).ToListAsync(ct);
            var view = (await GetAsync(meetingId, userId, ct))!;
            var notice = new ScheduleNoticeDto("cancelled", meetingId, meeting.Title,
                Utc(meeting.ScheduledStartAt!.Value), meeting.Owner.DisplayName, null);

            return new ScheduleResult(view, notice, ids);
        }

        public async Task<ScheduleViewDto> MarkAttendanceAsync(long meetingId, long userId, AttendanceRequest req, CancellationToken ct)
        {
            if (req.Attendance is not (null or "present" or "absent"))
                throw new InvalidOperationException("Giá trị điểm danh không hợp lệ.");

            var meeting = await OwnedAsync(meetingId, userId, ct);

            if (meeting.Status == StatusCancelled) throw new InvalidOperationException("Cuộc họp đã bị huỷ.");
            if (meeting.ScheduledStartAt > DateTime.UtcNow)
                throw new InvalidOperationException("Chưa đến giờ họp, chưa điểm danh được.");

            var email = User.NormalizeEmail(req.Email ?? "");
            var invite = meeting.Invites.FirstOrDefault(i => i.Email == email)
                ?? throw new InvalidOperationException("Người này không có trong danh sách mời.");

            invite.Attendance = req.Attendance;
            meeting.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            return (await GetAsync(meetingId, userId, ct))!;
        }

        private IQueryable<Meeting> Query() =>
            db.Meetings.Include(m => m.Owner).Include(m => m.Invites).Where(m => m.MeetingType == "offline");

        private async Task<Meeting> OwnedAsync(long meetingId, long userId, CancellationToken ct)
        {
            var meeting = await Query().FirstOrDefaultAsync(m => m.Id == meetingId, ct)
                ?? throw new KeyNotFoundException();

            return meeting.OwnerId == userId
                ? meeting
                : throw new UnauthorizedAccessException("Chỉ người tổ chức mới làm được việc này.");
        }

        private async Task<string> EmailOfAsync(long userId, CancellationToken ct) =>
            await db.Users.Where(u => u.Id == userId).Select(u => u.Email).FirstOrDefaultAsync(ct)
                ?? throw new InvalidOperationException("Không tìm thấy tài khoản.");

        private async Task<List<ScheduleViewDto>> ToViewsAsync(List<Meeting> meetings, long userId, string myEmail, CancellationToken ct)
        {
            var emails = meetings.SelectMany(m => m.Invites).Select(i => i.Email).Distinct().ToList();
            var names = await db.Users.Where(u => emails.Contains(u.Email))
                .ToDictionaryAsync(u => u.Email, u => u.DisplayName, ct);

            return meetings.Select(m =>
            {
                var isOwner = m.OwnerId == userId;
                var attendees = m.Invites.OrderBy(i => i.Id).Select(i => new ScheduleAttendeeDto(
                    i.Email,
                    names.GetValueOrDefault(i.Email, i.Email),
                    isOwner ? i.Response : null,
                    isOwner ? Utc(i.RespondedAt) : null,
                    isOwner ? i.Attendance : null)).ToList();

                return new ScheduleViewDto(
                    m.Id, m.Title, m.Description, Utc(m.ScheduledStartAt!.Value), m.Location ?? "", m.Status,
                    m.OwnerId, m.Owner.DisplayName, isOwner,
                    m.Invites.FirstOrDefault(i => i.Email == myEmail)?.Response,
                    attendees);
            }).ToList();
        }
    }
}
