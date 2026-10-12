using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class CallMember
{
    public long Id { get; set; }

    public long CallId { get; set; }

    public long? UserId { get; set; }

    public string Email { get; set; } = null!;

    public string? DisplayName { get; set; }

    public string DeliveryChannel { get; set; } = null!;

    public string DeliveryStatus { get; set; } = null!;

    public DateTime InvitedAt { get; set; }

    public DateTime? RingExpiresAt { get; set; }

    public string ResponseStatus { get; set; } = null!;

    public DateTime? RespondedAt { get; set; }

    public string Result { get; set; } = null!;

    public byte[]? JoinTokenHash { get; set; }

    public virtual Call Call { get; set; } = null!;

    public virtual ICollection<CallJoinLog> CallJoinLogs { get; set; } = new List<CallJoinLog>();

    public virtual CallJoinReq? CallJoinReq { get; set; }

    public virtual User? User { get; set; }
}
