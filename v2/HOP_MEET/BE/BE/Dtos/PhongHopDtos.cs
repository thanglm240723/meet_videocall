namespace BE.Dtos
{
    public record CreatedMeetingDto(long MeetingId, string JoinCode);

    public record MeetingInfoDto(long MeetingId, string Title, string JoinCode, bool IsOwner, bool RequireApproval);

    public record SetAdmissionRequest(bool RequireApproval);

    public record ChatMessageDto(long Id, long SenderUserId, string SenderName, string Text, long Timestamp);

    public record WaitingPersonDto(long UserId, string Name);
}
