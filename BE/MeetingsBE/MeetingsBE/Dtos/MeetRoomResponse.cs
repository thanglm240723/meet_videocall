using MeetingsBE.Models;
using System;

namespace MeetingsBE.Dtos;

public sealed class MeetRoomResponse
{
    public long MeetingId { get; set; }

    public long OwnerId { get; set; }

    public bool IsOwner { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string MeetingType { get; set; } = null!;

    public string CreationMode { get; set; } = null!;

    public DateTime? ScheduledStartAt { get; set; }

    public int? OpenEarlyMinutes { get; set; }

    public string? AdmissionMode { get; set; }

    public string? Location { get; set; }

    public string? JoinCode { get; set; }

    public string Status { get; set; } = null!;

    public string? DailyRoomName { get; set; }

    public string? RoomUrl { get; set; }

    public DateTime CreatedAt { get; set; }

 

}

    
public sealed class MeetingInfoResponse
{
    public long MeetingId { get; set; }
    public string Title { get; set; } = null!;
    public string JoinCode { get; set; } = null!;
    public bool IsOwner { get; set; }

    public bool RequireApproval { get; set; }
}

public sealed class JoinMeetRoomResponse
{
    public long MeetingId { get; set; }
    public bool IsOwner { get; set; }

    public bool RequireApproval { get; set; }

    public string RoomUrl { get; set; } = null!;

    public string? MeetingToken { get; set; }
}

public sealed class AdmissionResponse
{
    public bool RequireApproval { get; set; }
}
