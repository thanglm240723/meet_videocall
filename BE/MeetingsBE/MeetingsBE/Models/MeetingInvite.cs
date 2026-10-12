using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class MeetingInvite
{
    public long Id { get; set; }

    public long MeetingId { get; set; }

    public string Email { get; set; } = null!;

    public string DeliveryStatus { get; set; } = null!;

    public DateTime? LastSentAt { get; set; }

    public string Response { get; set; } = null!;

    public DateTime? RespondedAt { get; set; }

    public string? Attendance { get; set; }

    public DateTime? AttendanceAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Meeting Meeting { get; set; } = null!;
}
