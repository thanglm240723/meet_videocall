using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class CallJoinReq
{
    public long Id { get; set; }

    public long CallMemberId { get; set; }

    public DateTime RequestedAt { get; set; }

    public virtual CallMember CallMember { get; set; } = null!;
}
