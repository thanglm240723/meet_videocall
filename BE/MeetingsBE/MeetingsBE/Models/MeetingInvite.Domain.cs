namespace MeetingsBE.Models;

public partial class MeetingInvite
{
    public const string DeliveryPending = "pending";

    public const string ResponsePending = "pending";
    public const string ResponseAccepted = "accepted";
    public const string ResponseDeclined = "declined";

    public static MeetingInvite For(string email, DateTime now)
    {
        return new MeetingInvite
        {
            Email = User.NormalizeEmail(email),
            DeliveryStatus = DeliveryPending,
            Response = ResponsePending,
            CreatedAt = now
        };
    }

    public const string AttendancePresent = "present";
    public const string AttendanceAbsent = "absent";

    public static bool IsAttendance(string? value)
        => value is null or AttendancePresent or AttendanceAbsent;

    public void Respond(bool accept, DateTime now)
    {
        Response = accept ? ResponseAccepted : ResponseDeclined;
        RespondedAt = now;
    }

    // null = bỏ đánh dấu (về "chưa điểm danh").
    public void MarkAttendance(string? attendance, DateTime now)
    {
        if (!IsAttendance(attendance))
            throw new ArgumentException("Attendance must be present, absent or null.", nameof(attendance));

        Attendance = attendance;
        AttendanceAt = attendance == null ? null : now;
    }
}
