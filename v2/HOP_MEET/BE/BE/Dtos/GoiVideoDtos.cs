namespace BE.Dtos
{

    public record CallMemberDto(
        long UserId,
        string DisplayName,
        string Email,
        bool IsOwner,
        string Response,
        string Result,
        bool InRoom,
        bool Online,
        bool WaitingApproval);

    public record CallViewDto(
        long CallId,
        string Type,
        string Status,
        string? EndReason,
        long OwnerId,
        string OwnerName,
        DateTime? StartedAt,
        List<CallMemberDto> Members);

    public record JoinInfoDto(CallViewDto Call);

    public record CallInRoomInfo(string DisplayName, bool IsOwner);
}
