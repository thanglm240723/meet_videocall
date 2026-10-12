using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class MeetingJoinLog
{
    public long Id { get; set; }

    public long MemberId { get; set; }

    public DateTime JoinedAt { get; set; }

    public DateTime? LeftAt { get; set; }

    public virtual MeetingMember Member { get; set; } = null!;
}
