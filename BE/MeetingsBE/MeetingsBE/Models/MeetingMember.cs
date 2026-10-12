using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class MeetingMember
{
    public long Id { get; set; }

    public long MeetingId { get; set; }

    public long UserId { get; set; }

    public string DisplayName { get; set; } = null!;

    public bool IsMutedByOwner { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Meeting Meeting { get; set; } = null!;

    public virtual MeetingJoinLog? MeetingJoinLog { get; set; }

    public virtual ICollection<MeetingMessage> MeetingMessages { get; set; } = new List<MeetingMessage>();

    public virtual User User { get; set; } = null!;
}
