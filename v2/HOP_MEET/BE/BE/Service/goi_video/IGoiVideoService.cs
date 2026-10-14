using BE.Dtos;

namespace BE.Service.goi_video
{
    public interface IGoiVideoService
    {
        Task<CallViewDto> StartCallAsync(long ownerId, List<string> emails, CancellationToken ct = default);
        Task<CallViewDto> AcceptAsync(long callId, long userId, CancellationToken ct = default);
        Task<CallViewDto> DeclineAsync(long callId, long userId, CancellationToken ct = default);
        Task<CallViewDto> LeaveAsync(long callId, long userId, CancellationToken ct = default);
        Task<CallViewDto> EndForAllAsync(long callId, long userId, CancellationToken ct = default);

        // goi nhom: nguoi da roi muon vao lai thi phai cho nguoi goi duyet
        Task<CallViewDto> RejoinAsync(long callId, long userId, CancellationToken ct = default);
        Task<CallViewDto> ApproveRejoinAsync(long callId, long ownerId, long userId, bool accept, CancellationToken ct = default);

        Task<List<CallViewDto>> GetMyCallsAsync(long userId, CancellationToken ct = default);

        // worker goi dinh ky: chuong qua 30s thi tinh la nho
        Task<List<CallViewDto>> ExpireRingingAsync(CancellationToken ct = default);

        // MeetHub kiem tra truoc khi cho vao phong media
        Task<CallInRoomInfo> CheckInRoomAsync(long callId, long userId, CancellationToken ct = default);
    }
}
