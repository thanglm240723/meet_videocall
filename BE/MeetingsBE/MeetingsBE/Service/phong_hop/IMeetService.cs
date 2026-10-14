using MeetingsBE.Dtos;

namespace MeetingsBE.Service
{
    public interface IMeetService
    {
        Task<MeetResult<MeetRoomResponse>> CreateAsync(long ownerId, CancellationToken ct);

        Task<MeetResult<MeetingInfoResponse>> GetAsync(long userId, string joinCode, CancellationToken ct);

        Task<MeetResult<JoinMeetRoomResponse>> JoinAsync(long userId, string joinCode, CancellationToken ct);
        Task<MeetResult<AdmissionResponse>> SetAdmissionAsync(long userId, string joinCode, bool requireApproval, CancellationToken ct);

        Task<MeetResult<LockResponse>> SetLockAsync(long userId, string joinCode, bool locked, CancellationToken ct);

        Task<MeetResult<MeetingInfoResponse>> EndAsync(long userId, string joinCode, CancellationToken ct);

        public sealed record MeetResult<T>(MeetError Error, T? Data = null, string? Message = null) where T : class;


        public enum MeetError
        {
            None,
            InvalidRequest,
            Unauthorized,
            NotFound,
            Forbidden,
            Expired,
            Ended,
            DailyUnavailable
        }
    }
}
