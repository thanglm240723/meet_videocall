using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class MeetingJoinReq
{
    public long Id { get; set; }

    public long MeetingId { get; set; }

    public long UserId { get; set; }

    public DateTime RequestedAt { get; set; }

    public virtual Meeting Meeting { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
