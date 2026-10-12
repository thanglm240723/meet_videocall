namespace MeetingsBE.Dtos;

public sealed record CallView(
    long CallId,
    string Type,
    string Status,
    string? EndReason,
    long OwnerId,
    string OwnerName,
    DateTime? StartedAt,
    IReadOnlyList<CallMemberView> Members);

public sealed record CallMemberView(
    long UserId,
    string DisplayName,
    string Email,
    bool IsOwner,
    string Response,
    string Result,
    bool InRoom,
    bool Online);

public sealed record CallJoinInfo(CallView Call, string RoomUrl, string Token);
