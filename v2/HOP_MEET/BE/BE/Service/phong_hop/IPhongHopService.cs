using BE.Dtos;
using BE.Model;

namespace BE.Service.phong_hop
{
    public interface IPhongHopService
    {
        Task<CreatedMeetingDto> CreateMeetingAsync(long userId, CancellationToken ct = default);
        Task<MeetingInfoDto?> GetMeetingInfoAsync(string joinCode, long userId, CancellationToken ct = default);
        Task<bool?> SetAdmissionAsync(string joinCode, long userId, bool requireApproval, CancellationToken ct = default);

       
        Task<JoinCheckResult> CheckJoinAsync(string joinCode, long userId, CancellationToken ct = default);
        Task ApproveJoinAsync(long meetingId, long userId, bool accept, CancellationToken ct = default);
        Task CancelJoinRequestAsync(long meetingId, long userId, CancellationToken ct = default);

        Task OpenJoinLogAsync(long memberId, CancellationToken ct = default);
        Task CloseJoinLogAsync(long memberId, CancellationToken ct = default);

        Task<List<ChatMessageDto>> GetMessagesAsync(long meetingId, CancellationToken ct = default);
        Task<ChatMessageDto> SaveMessageAsync(long meetingId, long memberId, string text, CancellationToken ct = default);
        Task SetMutedByOwnerAsync(long meetingId, long userId, bool muted, CancellationToken ct = default);

        Task DeleteMessagesAsync(long meetingId, CancellationToken ct = default);
        Task EndMeetingAsync(long meetingId, CancellationToken ct = default);
    }

    public record JoinCheckResult(Meeting Meeting, MeetingMember? Member, bool IsOwner);
}
