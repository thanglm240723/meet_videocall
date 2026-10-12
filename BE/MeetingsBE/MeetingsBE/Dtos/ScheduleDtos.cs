namespace MeetingsBE.Dtos;

public sealed class CreateScheduleRequest
{
    public string? Title { get; set; }

    public string? Description { get; set; }

    public DateTimeOffset? StartAt { get; set; }

    public string? Location { get; set; }

    public string[] Emails { get; set; } = [];
}

public sealed class RespondScheduleRequest
{
    public bool Accept { get; set; }
}

public sealed class MarkAttendanceRequest
{
    public string? Email { get; set; }

    public string? Attendance { get; set; }
}

public sealed record ScheduleView(
    long MeetingId,
    string Title,
    string? Description,
    DateTime StartAt,
    string Location,
    string Status,
    long OwnerId,
    string OwnerName,
    bool IsOwner,
    string? MyResponse,
    IReadOnlyList<ScheduleAttendeeView> Attendees);

public sealed record ScheduleAttendeeView(
    string Email,
    string DisplayName,
    string? Response,
    DateTime? RespondedAt,
    string? Attendance);

public sealed record ScheduleNotice(
    string Kind,
    long MeetingId,
    string Title,
    DateTime StartAt,
    string ActorName,
    string? Response);

public sealed record PendingCountResponse(int Count);
