using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class Call
{
    public long Id { get; set; }

    public long OwnerId { get; set; }

    public string CallType { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    public string? EndReason { get; set; }

    public virtual ICollection<CallMember> CallMembers { get; set; } = new List<CallMember>();

    public virtual User Owner { get; set; } = null!;
}
