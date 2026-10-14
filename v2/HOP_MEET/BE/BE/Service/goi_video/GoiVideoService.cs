using BE.Data;
using BE.Dtos;
using BE.Model;
using Microsoft.EntityFrameworkCore;

namespace BE.Service.goi_video
{
    public class GoiVideoService : IGoiVideoService
    {
        public const int MaxPeople = 9;
        public const int RingSeconds = 30;

        // Call.CallType
        private const string Personal = "personal";
        private const string Group = "group";

        // Call.Status
        private const string Ringing = "ringing";
        private const string Active = "active";
        private const string Ended = "ended";
        private const string Cancelled = "cancelled";

        // CallMember.ResponseStatus (phan hoi voi tieng chuong)
        private const string Pending = "pending";
        private const string Accepted = "accepted";
        private const string Declined = "declined";
        private const string NoAnswer = "no_answer";

        // CallMember.Result
        private const string Connected = "connected";
        private const string Missed = "missed";

        private readonly AppDbContext _db;
        private readonly OnlineUsers _online;

        public GoiVideoService(AppDbContext db, OnlineUsers online)
        {
            _db = db;
            _online = online;
        }

        public async Task<CallViewDto> StartCallAsync(long ownerId, List<string> emails, CancellationToken ct = default)
        {
            var list = (emails ?? new List<string>())
                .Where(e => !string.IsNullOrWhiteSpace(e))
                .Select(User.NormalizeEmail)
                .Distinct()
                .ToList();

            if (list.Count == 0) throw new InvalidOperationException("Hãy nhập email người nhận.");
            if (list.Count > MaxPeople) throw new InvalidOperationException($"Chỉ gọi được tối đa {MaxPeople} người một lúc.");

            var owner = await _db.Users.FirstAsync(u => u.Id == ownerId, ct);
            if (list.Contains(owner.Email)) throw new InvalidOperationException("Không thể tự gọi cho chính mình.");

            var users = await _db.Users.Where(u => list.Contains(u.Email)).ToListAsync(ct);
            var missing = list.Except(users.Select(u => u.Email)).ToList();
            if (missing.Count > 0) throw new InvalidOperationException($"Chưa có tài khoản: {string.Join(", ", missing)}");

            var now = DateTime.UtcNow;
            var call = new Call
            {
                OwnerId = owner.Id,
                Owner = owner,
                CallType = users.Count == 1 ? Personal : Group,
                Status = Ringing,
                CreatedAt = now,
            };

            // nguoi goi vao phong ngay, ngoi cho nguoi kia nghe may
            var ownerMember = new CallMember
            {
                UserId = owner.Id,
                User = owner,
                Email = owner.Email,
                DisplayName = owner.DisplayName,
                DeliveryChannel = "app",
                DeliveryStatus = "sent",
                InvitedAt = now,
                ResponseStatus = Accepted,
                RespondedAt = now,
                Result = Connected,
            };
            ownerMember.JoinLogs.Add(new CallJoinLog { JoinedAt = now });
            call.Members.Add(ownerMember);

            foreach (var u in users)
            {
                call.Members.Add(new CallMember
                {
                    UserId = u.Id,
                    User = u,
                    Email = u.Email,
                    DisplayName = u.DisplayName,
                    DeliveryChannel = "app",
                    DeliveryStatus = _online.IsOnline(u.Id) ? "sent" : "offline",
                    InvitedAt = now,
                    RingExpiresAt = now.AddSeconds(RingSeconds),
                    ResponseStatus = Pending,
                    Result = Pending,
                });
            }

            _db.Calls.Add(call);
            await _db.SaveChangesAsync(ct);

            return ToDto(call);
        }

        public async Task<CallViewDto> AcceptAsync(long callId, long userId, CancellationToken ct = default)
        {
            var call = await LoadCallAsync(callId, ct);
            var me = MemberOf(call, userId);

            if (IsOver(call)) throw new InvalidOperationException("Cuộc gọi đã kết thúc.");
            if (me.ResponseStatus != Pending) throw new InvalidOperationException("Cuộc gọi này không còn đổ chuông.");

            var now = DateTime.UtcNow;
            me.ResponseStatus = Accepted;
            me.RespondedAt = now;
            me.Result = Connected;
            OpenLog(me, now);

            if (call.Status == Ringing)
            {
                call.Status = Active;
                call.StartedAt = now;
            }

            await _db.SaveChangesAsync(ct);
            return ToDto(call);
        }

        public async Task<CallViewDto> DeclineAsync(long callId, long userId, CancellationToken ct = default)
        {
            var call = await LoadCallAsync(callId, ct);
            var me = MemberOf(call, userId);

            if (IsOver(call) || me.ResponseStatus != Pending) return ToDto(call);

            var now = DateTime.UtcNow;
            me.ResponseStatus = Declined;
            me.RespondedAt = now;
            me.Result = Declined;

            EndIfNobodyAnswers(call, Declined, now);

            await _db.SaveChangesAsync(ct);
            return ToDto(call);
        }

        public async Task<CallViewDto> LeaveAsync(long callId, long userId, CancellationToken ct = default)
        {
            var call = await LoadCallAsync(callId, ct);
            var me = MemberOf(call, userId);

            if (IsOver(call)) return ToDto(call);

            var now = DateTime.UtcNow;
            CloseLog(me, now);
            RemoveJoinRequest(me);

            var isOwner = me.UserId == call.OwnerId;

            if (call.Status == Ringing && isOwner)
            {
                // nguoi goi huy khi chua ai nghe
                EndCall(call, Cancelled, "caller_cancelled", now);
            }
            else if (call.CallType == Personal)
            {
                EndCall(call, Ended, "participant_left", now);
            }
            else
            {
                
                if (isOwner)
                {
                    foreach (var m in call.Members.Where(m => m.JoinRequest != null))
                    {
                        RemoveJoinRequest(m);
                        OpenLog(m, now);
                    }
                }

                if (!call.Members.Any(InRoom) && !call.Members.Any(IsRinging))
                    EndCall(call, Ended, "all_left", now);
            }

            await _db.SaveChangesAsync(ct);
            return ToDto(call);
        }

        public async Task<CallViewDto> EndForAllAsync(long callId, long userId, CancellationToken ct = default)
        {
            var call = await LoadCallAsync(callId, ct);

            if (call.OwnerId != userId) throw new InvalidOperationException("Chỉ người gọi mới kết thúc được cho tất cả.");
            if (IsOver(call)) return ToDto(call);

            EndCall(call, Ended, "owner_ended_all", DateTime.UtcNow);

            await _db.SaveChangesAsync(ct);
            return ToDto(call);
        }

        public async Task<CallViewDto> RejoinAsync(long callId, long userId, CancellationToken ct = default)
        {
            var call = await LoadCallAsync(callId, ct);
            var me = MemberOf(call, userId);

            if (IsOver(call)) throw new InvalidOperationException("Cuộc gọi đã kết thúc.");

            // tai lai trang giua cuoc goi: BE van tinh dang o trong phong -> vao thang
            if (InRoom(me)) return ToDto(call);

            if (me.ResponseStatus == Pending) throw new InvalidOperationException("Hãy bấm Nghe để vào cuộc gọi.");
            if (call.CallType == Personal) throw new InvalidOperationException("Cuộc gọi 1–1 đã kết thúc với bạn.");

            var now = DateTime.UtcNow;
            var owner = call.Members.First(m => m.UserId == call.OwnerId);

            // chinh nguoi goi, hoac nguoi goi khong con trong phong -> vao thang
            if (me.UserId == call.OwnerId || !InRoom(owner))
            {
                OpenLog(me, now);
                me.Result = Connected;
            }
            else if (me.JoinRequest is null)
            {
                me.JoinRequest = new CallJoinReq { RequestedAt = now };
            }

            await _db.SaveChangesAsync(ct);
            return ToDto(call);
        }

        public async Task<CallViewDto> ApproveRejoinAsync(long callId, long ownerId, long userId, bool accept, CancellationToken ct = default)
        {
            var call = await LoadCallAsync(callId, ct);

            if (call.OwnerId != ownerId) throw new InvalidOperationException("Chỉ người gọi mới duyệt được.");
            if (IsOver(call)) throw new InvalidOperationException("Cuộc gọi đã kết thúc.");

            var target = MemberOf(call, userId);
            if (target.JoinRequest is null) throw new InvalidOperationException("Người này không còn chờ duyệt.");

            RemoveJoinRequest(target);

            if (accept)
            {
                OpenLog(target, DateTime.UtcNow);
                target.Result = Connected;
            }

            await _db.SaveChangesAsync(ct);
            return ToDto(call);
        }

        public async Task<List<CallViewDto>> GetMyCallsAsync(long userId, CancellationToken ct = default)
        {
            var calls = await QueryCalls()
                .Where(c => (c.Status == Ringing || c.Status == Active) && c.Members.Any(m => m.UserId == userId))
                .ToListAsync(ct);

            return calls.Select(ToDto).ToList();
        }

        public async Task<List<CallViewDto>> ExpireRingingAsync(CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;

            var callIds = await _db.CallMembers
                .Where(m => m.ResponseStatus == Pending && m.RingExpiresAt != null && m.RingExpiresAt < now
                    && (m.Call.Status == Ringing || m.Call.Status == Active))
                .Select(m => m.CallId)
                .Distinct()
                .ToListAsync(ct);

            if (callIds.Count == 0) return new List<CallViewDto>();

            var calls = await QueryCalls().Where(c => callIds.Contains(c.Id)).ToListAsync(ct);

            foreach (var call in calls)
            {
                foreach (var m in call.Members.Where(m => IsRinging(m) && m.RingExpiresAt < now))
                {
                    m.ResponseStatus = NoAnswer;
                    m.Result = Missed;
                }

                EndIfNobodyAnswers(call, NoAnswer, now);
            }

            await _db.SaveChangesAsync(ct);
            return calls.Select(ToDto).ToList();
        }

        public async Task<CallInRoomInfo> CheckInRoomAsync(long callId, long userId, CancellationToken ct = default)
        {
            var call = await LoadCallAsync(callId, ct);
            var me = MemberOf(call, userId);

            if (IsOver(call)) throw new InvalidOperationException("Cuộc gọi đã kết thúc.");
            if (!InRoom(me)) throw new InvalidOperationException("Bạn chưa ở trong cuộc gọi này.");

            return new CallInRoomInfo(me.DisplayName ?? me.Email, me.UserId == call.OwnerId);
        }


        private IQueryable<Call> QueryCalls() =>
            _db.Calls
                .Include(c => c.Owner)
                .Include(c => c.Members).ThenInclude(m => m.JoinLogs.Where(l => l.LeftAt == null))
                .Include(c => c.Members).ThenInclude(m => m.JoinRequest)
                .AsSplitQuery();

        private async Task<Call> LoadCallAsync(long callId, CancellationToken ct) =>
            await QueryCalls().FirstOrDefaultAsync(c => c.Id == callId, ct)
                ?? throw new InvalidOperationException("Không tìm thấy cuộc gọi.");

        private static CallMember MemberOf(Call call, long userId) =>
            call.Members.FirstOrDefault(m => m.UserId == userId)
                ?? throw new InvalidOperationException("Bạn không thuộc cuộc gọi này.");

        private static bool IsOver(Call call) => call.Status == Ended || call.Status == Cancelled;

        private static bool InRoom(CallMember m) => m.JoinLogs.Any(l => l.LeftAt == null);

        private static bool IsRinging(CallMember m) => m.ResponseStatus == Pending;

        private static void OpenLog(CallMember m, DateTime now)
        {
            if (!InRoom(m)) m.JoinLogs.Add(new CallJoinLog { JoinedAt = now });
        }

        private static void CloseLog(CallMember m, DateTime now)
        {
            foreach (var log in m.JoinLogs.Where(l => l.LeftAt == null))
                log.LeftAt = now;
        }

        private void RemoveJoinRequest(CallMember m)
        {
            if (m.JoinRequest is null) return;

            _db.CallJoinReqs.Remove(m.JoinRequest);
            m.JoinRequest = null;
        }

     
        private void EndIfNobodyAnswers(Call call, string reason, DateTime now)
        {
            if (call.Status == Ringing && !call.Members.Any(IsRinging))
                EndCall(call, Ended, reason, now);
        }

        private void EndCall(Call call, string status, string reason, DateTime now)
        {
            call.Status = status;
            call.EndReason = reason;
            call.EndedAt = now;

            foreach (var m in call.Members)
            {
                CloseLog(m, now);
                RemoveJoinRequest(m);

                if (IsRinging(m))
                {
                    m.ResponseStatus = NoAnswer;
                    m.Result = Missed;
                }
            }
        }

        private CallViewDto ToDto(Call call) => new(
            call.Id,
            call.CallType,
            call.Status,
            call.EndReason,
            call.OwnerId,
            call.Owner.DisplayName,
            call.StartedAt is DateTime s ? DateTime.SpecifyKind(s, DateTimeKind.Utc) : null,
            call.Members
                .OrderBy(m => m.UserId == call.OwnerId ? 0 : 1).ThenBy(m => m.Id)
                .Select(m => new CallMemberDto(
                    m.UserId ?? 0,
                    m.DisplayName ?? m.Email,
                    m.Email,
                    m.UserId == call.OwnerId,
                    m.ResponseStatus,
                    m.Result,
                    InRoom(m),
                    m.UserId is long id && _online.IsOnline(id),
                    m.JoinRequest != null))
                .ToList());
    }
}
