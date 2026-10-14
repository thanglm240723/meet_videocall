using MeetingsBE.Dtos;
using MeetingsBE.Models;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Json;
using System.Security.Cryptography;
using static MeetingsBE.Service.IMeetService;

namespace MeetingsBE.Service
{
    public class MeetService : IMeetService
    {
        private readonly MeetingDbContext _db;
        private readonly HttpClient _http;

        public MeetService(MeetingDbContext db, HttpClient http)
        {
            _db = db;
            _http = http;
        }

        public async Task<MeetResult<MeetRoomResponse>> CreateAsync(long ownerId, CancellationToken ct)
        {
            var owner = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == ownerId, ct);

            if (owner == null)
                return new(MeetError.Unauthorized);

     
            var joinCode = Convert.ToHexString(
                RandomNumberGenerator.GetBytes(8));

            var roomName = $"meet-{Guid.NewGuid():N}";

            var meeting = Meeting.Create(
                         ownerId: ownerId,
                         title: "Cuộc họp mới",
                         meetingType: Meeting.TypeOnline,
                         creationMode: "instant",
                         admissionMode: Meeting.AdmissionAuto,
                         joinCode: joinCode);

       
            DailyRoomResponse dailyRoom;

            try
            {
                dailyRoom = await CreateRoomAsync(roomName, ct);
            }
            catch (HttpRequestException)
            {
                return new(MeetError.DailyUnavailable);
            }

        
            await using var transaction =
                await _db.Database.BeginTransactionAsync(ct);

            _db.Meetings.Add(meeting);
            await _db.SaveChangesAsync(ct);

            var room = MeetingDailyRoom.Create(
                meeting.Id,
                dailyRoom.DailyRoomName,
                dailyRoom.DailyRoomUrl,
                dailyRoom.CreatedAt.UtcDateTime);

            _db.MeetingDailyRooms.Add(room);
            await _db.SaveChangesAsync(ct);

            await transaction.CommitAsync(ct);

            return new(
                MeetError.None,
                new MeetRoomResponse
                {
                    MeetingId = meeting.Id,
                    OwnerId = meeting.OwnerId,
                    IsOwner = meeting.OwnerId == ownerId,
                    Title = meeting.Title,
                    MeetingType = meeting.MeetingType,
                    CreationMode = meeting.CreationMode,
                    AdmissionMode = meeting.AdmissionMode,
                    JoinCode = meeting.JoinCode,
                    Status = meeting.Status,
                    CreatedAt = meeting.CreatedAt,
                    DailyRoomName = room.DailyRoomName,
                    RoomUrl = room.DailyRoomUrl
                });
        }

        public async Task<MeetResult<MeetingInfoResponse>> GetAsync(long userId, string joinCode, CancellationToken ct)
        {
            var code = joinCode.Trim().ToUpperInvariant();

            var meeting = await _db.Meetings
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.JoinCode == code && m.DailyRoom != null, ct);

            if (meeting == null)
                return new(MeetError.NotFound);

            if (meeting.IsEnded)
                return new(MeetError.Ended, Message: "Cuộc họp này đã kết thúc.");

            return new(
                MeetError.None,
                new MeetingInfoResponse
                {
                    MeetingId = meeting.Id,
                    Title = meeting.Title,
                    JoinCode = code,
                    IsOwner = meeting.OwnerId == userId,
                    RequireApproval = meeting.RequiresApproval,
                    IsLocked = meeting.IsLocked
                });
        }

        public async Task<MeetResult<JoinMeetRoomResponse>> JoinAsync(long userId, string joinCode, CancellationToken ct)
        {
            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId, ct);

            if (user == null)
                return new(MeetError.Unauthorized);

            var code = joinCode.Trim().ToUpperInvariant();

            var meeting = await _db.Meetings
                .AsNoTracking()
                .Include(m => m.DailyRoom)
                .FirstOrDefaultAsync(m => m.JoinCode == code, ct);

            if (meeting == null || meeting.DailyRoom == null)
                return new(MeetError.NotFound);

            if (meeting.IsEnded)
                return new(MeetError.Ended, Message: "Cuộc họp này đã kết thúc.");

            var isOwner = meeting.OwnerId == userId;

            // Phòng đã khoá thì chỉ chủ phòng vào lại được.
            if (meeting.IsLocked && !isOwner)
                return new(MeetError.Forbidden, Message: "Chủ phòng đã khoá cuộc họp, không vào thêm được.");

            if (meeting.RequiresApproval && !isOwner)
            {
                return new(
                    MeetError.None,
                    new JoinMeetRoomResponse
                    {
                        MeetingId = meeting.Id,
                        IsOwner = false,
                        RequireApproval = true,
                        RoomUrl = meeting.DailyRoom.DailyRoomUrl,
                        MeetingToken = null,
                        IsLocked = meeting.IsLocked
                    });
            }

            DailyTokenResponse tokenResponse;

            try
            {
                tokenResponse = await PostAsync<DailyTokenResponse>(
                "meeting-tokens",
                new
                {
                    properties = new
                    {
                        room_name = meeting.DailyRoom.DailyRoomName,
                        user_id = user.Id.ToString(
                            System.Globalization.CultureInfo.InvariantCulture),
                        user_name = user.DisplayName,
                        is_owner = isOwner,
                        exp = DateTimeOffset.UtcNow
                            .AddHours(1)
                            .ToUnixTimeSeconds()
                    }
                },
                ct);
            }
            catch (HttpRequestException)
            {
                return new(MeetError.DailyUnavailable);
            }

            return new(
                MeetError.None,
                new JoinMeetRoomResponse
                {
                    MeetingId = meeting.Id,
                    IsOwner = isOwner,
                    RequireApproval = meeting.RequiresApproval,
                    RoomUrl = meeting.DailyRoom.DailyRoomUrl,
                    MeetingToken = tokenResponse.Token,
                    IsLocked = meeting.IsLocked
                });
        }

        public async Task<MeetResult<AdmissionResponse>> SetAdmissionAsync(long userId, string joinCode, bool requireApproval, CancellationToken ct)
        {
            var code = joinCode.Trim().ToUpperInvariant();

            var meeting = await _db.Meetings
                .Include(m => m.DailyRoom)
                .FirstOrDefaultAsync(m => m.JoinCode == code, ct);

            if (meeting == null || meeting.DailyRoom == null)
                return new(MeetError.NotFound);

            if (meeting.OwnerId != userId)
                return new(MeetError.Forbidden, Message: "Chỉ chủ phòng mới đổi được chế độ duyệt.");

            if (meeting.IsEnded)
                return new(MeetError.Ended, Message: "Cuộc họp này đã kết thúc.");

            if (requireApproval)
            {
                try
                {
                    await PostAsync<DailyRoomResponse>(
                        $"rooms/{meeting.DailyRoom.DailyRoomName}",
                        new { properties = new { enable_knocking = true } },
                        ct);
                }
                catch (HttpRequestException)
                {
                    return new(MeetError.DailyUnavailable);
                }
            }

            meeting.SetRequireApproval(requireApproval, DateTime.UtcNow);
            await _db.SaveChangesAsync(ct);

            return new(
                MeetError.None,
                new AdmissionResponse { RequireApproval = meeting.RequiresApproval });
        }

        public async Task<MeetResult<LockResponse>> SetLockAsync(long userId, string joinCode, bool locked, CancellationToken ct)
        {
            var code = joinCode.Trim().ToUpperInvariant();

            var meeting = await _db.Meetings
                .FirstOrDefaultAsync(m => m.JoinCode == code && m.DailyRoom != null, ct);

            if (meeting == null)
                return new(MeetError.NotFound);

            if (meeting.OwnerId != userId)
                return new(MeetError.Forbidden, Message: "Chỉ chủ phòng mới khoá được cuộc họp.");

            if (meeting.IsEnded)
                return new(MeetError.Ended, Message: "Cuộc họp này đã kết thúc.");

            meeting.SetLocked(locked, DateTime.UtcNow);
            await _db.SaveChangesAsync(ct);

            return new(
                MeetError.None,
                new LockResponse { IsLocked = meeting.IsLocked });
        }

        // Kết thúc cho mọi người: đánh dấu ended trong DB rồi xoá room bên Daily
        // (Daily xoá room là đẩy hết người đang ở trong ra).
        public async Task<MeetResult<MeetingInfoResponse>> EndAsync(long userId, string joinCode, CancellationToken ct)
        {
            var code = joinCode.Trim().ToUpperInvariant();

            var meeting = await _db.Meetings
                .Include(m => m.DailyRoom)
                .FirstOrDefaultAsync(m => m.JoinCode == code, ct);

            if (meeting == null || meeting.DailyRoom == null)
                return new(MeetError.NotFound);

            if (meeting.OwnerId != userId)
                return new(MeetError.Forbidden, Message: "Chỉ chủ phòng mới kết thúc được cuộc họp.");

            if (!meeting.IsEnded)
            {
                meeting.End(DateTime.UtcNow);
                await _db.SaveChangesAsync(ct);
            }

            // DB đã ghi ended nên không ai lấy được token mới nữa.
            // Xoá room lỗi thì thôi, FE chủ phòng cũng đã eject mọi người rồi.
            try
            {
                await DeleteRoomAsync(meeting.DailyRoom.DailyRoomName, ct);
            }
            catch (HttpRequestException)
            {
            }

            return new(
                MeetError.None,
                new MeetingInfoResponse
                {
                    MeetingId = meeting.Id,
                    Title = meeting.Title,
                    JoinCode = code,
                    IsOwner = true,
                    RequireApproval = meeting.RequiresApproval,
                    IsLocked = meeting.IsLocked
                });
        }

        private async Task DeleteRoomAsync(string roomName, CancellationToken ct)
        {
            using var response = await _http.DeleteAsync($"rooms/{roomName}", ct);

            // 404 = room đã bị xoá / hết hạn trước đó, coi như xong.
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return;

            response.EnsureSuccessStatusCode();
        }

        private async Task<DailyRoomResponse> CreateRoomAsync(string roomName, CancellationToken ct)
        {
            return await PostAsync<DailyRoomResponse>(
                "rooms",
                new
                {
                    name = roomName,
                    privacy = "private",
                    properties = new
                    {
                        max_participants = 10,
                        enforce_unique_user_ids = true,
                        enable_knocking = true,
                        enable_prejoin_ui = true,
                        enable_chat = true,
                        enable_screenshare = true
                    }
                },
                ct);
        }

        private async Task<T> PostAsync<T>(string path, object body, CancellationToken ct)
        {
            using var response = await _http.PostAsJsonAsync(
                path,
                body,
                ct);

            response.EnsureSuccessStatusCode();

            return await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct) ?? throw new HttpRequestException("Daily trả về dữ liệu rỗng.");
        }
    }
}