using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class CallJoinLog
{
    public long Id { get; set; }

    public long CallMemberId { get; set; }

    public DateTime JoinedAt { get; set; }

    public DateTime? LeftAt { get; set; }

    public virtual CallMember CallMember { get; set; } = null!;
}
