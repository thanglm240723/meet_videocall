using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class MeetingMessage
{
    public long Id { get; set; }

    public long MeetingId { get; set; }

    public long MemberId { get; set; }

    public string Content { get; set; } = null!;

    public DateTime SentAt { get; set; }

    public virtual Meeting Meeting { get; set; } = null!;

    public virtual MeetingMember MeetingMember { get; set; } = null!;
}
