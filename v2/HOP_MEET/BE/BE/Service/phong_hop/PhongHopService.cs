using System.Security.Cryptography;
using BE.Data;
using BE.Dtos;
using BE.Model;
using Microsoft.EntityFrameworkCore;

namespace BE.Service.phong_hop
{
    public class PhongHopService : IPhongHopService
    {
        private const string StatusOpen = "open";
        private const string StatusEnded = "ended";
        private const string AdmissionOpen = "open";
        private const string AdmissionApproval = "approval";
        private const int MaxMessageLength = 4000;

        private readonly AppDbContext _db;

        public PhongHopService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<CreatedMeetingDto> CreateMeetingAsync(long userId, CancellationToken ct = default)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                ?? throw new InvalidOperationException("Không tìm thấy tài khoản.");

            var now = DateTime.UtcNow;
            var meeting = new Meeting
            {
                OwnerId = user.Id,
                Title = $"Cuộc họp của {user.DisplayName}",
                MeetingType = "online",
                CreationMode = "instant",
                AdmissionMode = AdmissionOpen,
                JoinCode = await NewJoinCodeAsync(ct),
                Status = StatusOpen,
                OpenedAt = now,
                CreatedAt = now,
                UpdatedAt = now,
            };

          
            meeting.Members.Add(new MeetingMember
            {
                UserId = user.Id,
                DisplayName = user.DisplayName,
                CreatedAt = now,
            });

            _db.Meetings.Add(meeting);
            await _db.SaveChangesAsync(ct);

            return new CreatedMeetingDto(meeting.Id, meeting.JoinCode!);
        }

        public async Task<MeetingInfoDto?> GetMeetingInfoAsync(string joinCode, long userId, CancellationToken ct = default)
        {
            var meeting = await FindOpenMeetingAsync(joinCode, ct);
            if (meeting is null) return null;

            return new MeetingInfoDto(
                meeting.Id,
                meeting.Title,
                meeting.JoinCode!,
                meeting.OwnerId == userId,
                meeting.AdmissionMode == AdmissionApproval);
        }

        public async Task<bool?> SetAdmissionAsync(string joinCode, long userId, bool requireApproval, CancellationToken ct = default)
        {
            var meeting = await FindOpenMeetingAsync(joinCode, ct);
            if (meeting is null) return null;

            if (meeting.OwnerId != userId)
                throw new UnauthorizedAccessException("Chỉ chủ phòng mới đổi được chế độ duyệt.");

            meeting.AdmissionMode = requireApproval ? AdmissionApproval : AdmissionOpen;
            meeting.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return requireApproval;
        }

        public async Task<JoinCheckResult> CheckJoinAsync(string joinCode, long userId, CancellationToken ct = default)
        {
            var meeting = await FindOpenMeetingAsync(joinCode, ct)
                ?? throw new InvalidOperationException("Phòng không tồn tại hoặc đã kết thúc.");

            var isOwner = meeting.OwnerId == userId;

            // da tung duoc vao -> vao lai khong can duyet
            var member = await _db.MeetingMembers
                .FirstOrDefaultAsync(m => m.MeetingId == meeting.Id && m.UserId == userId, ct);
            if (member is not null) return new JoinCheckResult(meeting, member, isOwner);

            if (isOwner || meeting.AdmissionMode != AdmissionApproval)
            {
                member = await AddMemberAsync(meeting.Id, userId, ct);
                return new JoinCheckResult(meeting, member, isOwner);
            }

            // phong bat duyet: luu yeu cau lai, cho chu phong duyet
            var hasRequest = await _db.MeetingJoinReqs
                .AnyAsync(r => r.MeetingId == meeting.Id && r.UserId == userId, ct);
            if (!hasRequest)
            {
                _db.MeetingJoinReqs.Add(new MeetingJoinReq
                {
                    MeetingId = meeting.Id,
                    UserId = userId,
                    RequestedAt = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync(ct);
            }

            return new JoinCheckResult(meeting, null, false);
        }

        public async Task ApproveJoinAsync(long meetingId, long userId, bool accept, CancellationToken ct = default)
        {
            await CancelJoinRequestAsync(meetingId, userId, ct);

            if (!accept) return;

            var exists = await _db.MeetingMembers.AnyAsync(m => m.MeetingId == meetingId && m.UserId == userId, ct);
            if (!exists) await AddMemberAsync(meetingId, userId, ct);
        }

        public Task CancelJoinRequestAsync(long meetingId, long userId, CancellationToken ct = default)
        {
            return _db.MeetingJoinReqs
                .Where(r => r.MeetingId == meetingId && r.UserId == userId)
                .ExecuteDeleteAsync(ct);
        }

        public async Task OpenJoinLogAsync(long memberId, CancellationToken ct = default)
        {
            // moi member chi co 1 log dang mo (vd: mo 2 tab thi dong log cu)
            await CloseJoinLogAsync(memberId, ct);

            _db.MeetingJoinLogs.Add(new MeetingJoinLog
            {
                MemberId = memberId,
                JoinedAt = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync(ct);
        }

        public Task CloseJoinLogAsync(long memberId, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;

            return _db.MeetingJoinLogs
                .Where(l => l.MemberId == memberId && l.LeftAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.LeftAt, now), ct);
        }

        public async Task<List<ChatMessageDto>> GetMessagesAsync(long meetingId, CancellationToken ct = default)
        {
            var rows = await _db.MeetingMessages
                .Where(m => m.MeetingId == meetingId)
                .OrderByDescending(m => m.SentAt).ThenByDescending(m => m.Id)
                .Take(200)
                .Select(m => new { m.Id, m.Member.UserId, m.Member.DisplayName, m.Content, m.SentAt })
                .ToListAsync(ct);

            return rows
                .OrderBy(m => m.SentAt).ThenBy(m => m.Id)
                .Select(m => new ChatMessageDto(m.Id, m.UserId, m.DisplayName, m.Content, ToUnixMs(m.SentAt)))
                .ToList();
        }

        public async Task<ChatMessageDto> SaveMessageAsync(long meetingId, long memberId, string text, CancellationToken ct = default)
        {
            var content = text?.Trim() ?? "";
            if (content.Length == 0) throw new InvalidOperationException("Tin nhắn trống.");
            if (content.Length > MaxMessageLength) throw new InvalidOperationException("Tin nhắn quá dài.");

            var member = await _db.MeetingMembers.FirstAsync(m => m.Id == memberId, ct);

            var message = new MeetingMessage
            {
                MeetingId = meetingId,
                MemberId = memberId,
                Content = content,
                SentAt = DateTime.UtcNow,
            };
            _db.MeetingMessages.Add(message);
            await _db.SaveChangesAsync(ct);

            return new ChatMessageDto(message.Id, member.UserId, member.DisplayName, content, ToUnixMs(message.SentAt));
        }

        public Task SetMutedByOwnerAsync(long meetingId, long userId, bool muted, CancellationToken ct = default)
        {
            return _db.MeetingMembers
                .Where(m => m.MeetingId == meetingId && m.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsMutedByOwner, muted), ct);
        }

        public Task DeleteMessagesAsync(long meetingId, CancellationToken ct = default)
        {
            return _db.MeetingMessages
                .Where(m => m.MeetingId == meetingId)
                .ExecuteDeleteAsync(ct);
        }

        public async Task EndMeetingAsync(long meetingId, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;

            await _db.Meetings
                .Where(m => m.Id == meetingId && m.EndedAt == null)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(m => m.Status, StatusEnded)
                    .SetProperty(m => m.EndedAt, now)
                    .SetProperty(m => m.UpdatedAt, now), ct);

            await _db.MeetingJoinReqs.Where(r => r.MeetingId == meetingId).ExecuteDeleteAsync(ct);
            await DeleteMessagesAsync(meetingId, ct);
        }

        private Task<Meeting?> FindOpenMeetingAsync(string joinCode, CancellationToken ct)
        {
            var code = (joinCode ?? "").Replace(" ", "").ToUpperInvariant();

            return _db.Meetings.FirstOrDefaultAsync(
                m => m.JoinCode == code && m.Status == StatusOpen && m.EndedAt == null, ct);
        }

        private async Task<MeetingMember> AddMemberAsync(long meetingId, long userId, CancellationToken ct)
        {
            var user = await _db.Users.FirstAsync(u => u.Id == userId, ct);

            var member = new MeetingMember
            {
                MeetingId = meetingId,
                UserId = userId,
                DisplayName = user.DisplayName,
                CreatedAt = DateTime.UtcNow,
            };
            _db.MeetingMembers.Add(member);
            await _db.SaveChangesAsync(ct);

            return member;
        }

        // ma 16 ky tu hex, vd 3F9A1C7E40B2D85A
        private async Task<string> NewJoinCodeAsync(CancellationToken ct)
        {
            while (true)
            {
                var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(8));
                var taken = await _db.Meetings.AnyAsync(m => m.JoinCode == code, ct);
                if (!taken) return code;
            }
        }

        private static long ToUnixMs(DateTime utc) =>
            new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
    }
}
