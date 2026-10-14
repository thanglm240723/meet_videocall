namespace BE.Dtos
{
    public record NewScheduleRequest(string Title, string? Description, DateTime StartAt, string Location, List<string> Emails);

    public record RespondRequest(bool Accept);

    public record AttendanceRequest(string Email, string? Attendance);

    public record ScheduleAttendeeDto(string Email, string DisplayName, string? Response, DateTime? RespondedAt, string? Attendance);

    public record ScheduleViewDto(
        long MeetingId, string Title, string? Description, DateTime StartAt, string Location, string Status,
        long OwnerId, string OwnerName, bool IsOwner, string? MyResponse, List<ScheduleAttendeeDto> Attendees);

    public record ScheduleNoticeDto(string Kind, long MeetingId, string Title, DateTime StartAt, string ActorName, string? Response);

    public record ScheduleResult(ScheduleViewDto View, ScheduleNoticeDto? Notice, List<long> NotifyUserIds);
}
