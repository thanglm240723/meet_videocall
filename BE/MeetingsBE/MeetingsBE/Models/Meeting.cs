using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class Meeting
{
    public long Id { get; private set; }

    public long OwnerId { get; private set; }

    public string Title { get; private set; } = null!;

    public string? Description { get; private set; }

    public string MeetingType { get; private set; } = null!;

    public string CreationMode { get; private set; } = null!;

    public DateTime? ScheduledStartAt { get; private set; }

    public int? OpenEarlyMinutes { get; private set; }

    public string? AdmissionMode { get; private set; }

    public string? Location { get; private set; }

    public string? JoinCode { get; private set; }

    public string Status { get; private set; } = null!;

    public DateTime? OpenedAt { get; private set; }

    public DateTime? EndedAt { get; private set; }

    public DateTime? ReminderSentAt { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public virtual ICollection<MeetingInvite> MeetingInvites { get; private set; } = new List<MeetingInvite>();

    public virtual ICollection<MeetingJoinReq> MeetingJoinReqs { get; private set; } = new List<MeetingJoinReq>();

    public virtual ICollection<MeetingMember> MeetingMembers { get; private set; } = new List<MeetingMember>();

    public virtual ICollection<MeetingMessage> MeetingMessages { get; private set; } = new List<MeetingMessage>();

    public virtual User Owner { get; private set; } = null!;

    public virtual MeetingDailyRoom? DailyRoom { get; private set; }

    public Meeting() { }

    public const string TypeOnline = "online";
    public const string TypeOffline = "offline";

    public const string ModeScheduled = "scheduled";

    public const string StatusScheduled = "scheduled";
    public const string StatusCancelled = "cancelled";

    // Phòng họp online: khoá = không cho ai vào thêm, ended = chủ phòng đã kết thúc cho mọi người.
    public const string StatusLocked = "locked";
    public const string StatusEnded = "ended";

    //  auto = vào thẳng, manual = chủ phòng phải duyệt.
    public const string AdmissionAuto = "auto";
    public const string AdmissionManual = "manual";

   
    public bool IsCancelled => string.Equals(Status, StatusCancelled, StringComparison.OrdinalIgnoreCase);

    public bool IsLocked => string.Equals(Status, StatusLocked, StringComparison.OrdinalIgnoreCase);

    public bool IsEnded => string.Equals(Status, StatusEnded, StringComparison.OrdinalIgnoreCase);

    public bool RequiresApproval => string.Equals(AdmissionMode, AdmissionManual, StringComparison.OrdinalIgnoreCase);

    public static Meeting Create(
        long ownerId,
        string title,
        string meetingType,
        string creationMode,
        DateTime? scheduledStartAt = null,
        int? openEarlyMinutes = null,
        string? admissionMode = null,
        string? location = null,
        string? joinCode = null)
    {
        if (ownerId <= 0)
        {
            throw new ArgumentException("Owner ID must be a positive number.", nameof(ownerId));
        }
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title cannot be empty.", nameof(title));
        }
        if (string.IsNullOrWhiteSpace(meetingType))
        {
            throw new ArgumentException("Meeting type cannot be empty.", nameof(meetingType));
        }
        if (string.IsNullOrWhiteSpace(creationMode))
        {
            throw new ArgumentException("Creation mode cannot be empty.", nameof(creationMode));
        }
        return new Meeting
        {
            OwnerId = ownerId,
            Title = title,
            MeetingType = meetingType,
            CreationMode = creationMode,
            ScheduledStartAt = scheduledStartAt,
            OpenEarlyMinutes = openEarlyMinutes,
            AdmissionMode = admissionMode,
            Location = location,
            JoinCode = joinCode,
            Status = StatusScheduled,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    public static Meeting CreateOffline(long ownerId, string title, string? description, DateTime startAt, string location, DateTime now)
    {
        if (string.IsNullOrWhiteSpace(location))
        {
            throw new ArgumentException("Location cannot be empty.", nameof(location));
        }

        var meeting = Create(
            ownerId: ownerId,
            title: title.Trim(),
            meetingType: TypeOffline,
            creationMode: ModeScheduled,
            scheduledStartAt: startAt,
            location: location.Trim());

        meeting.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        meeting.Status = StatusScheduled;
        meeting.CreatedAt = now;
        meeting.UpdatedAt = now;

        return meeting;
    }

    public void Cancel(DateTime now)
    {
        if (IsCancelled)
            return;

        Status = StatusCancelled;
        EndedAt = now;
        UpdatedAt = now;
    }

  
    public void SetRequireApproval(bool required, DateTime now)
    {
        if (!string.Equals(MeetingType, TypeOnline, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Chỉ phòng họp online mới có chế độ duyệt.");

        AdmissionMode = required ? AdmissionManual : AdmissionAuto;
        UpdatedAt = now;
    }

    public void SetLocked(bool locked, DateTime now)
    {
        if (!string.Equals(MeetingType, TypeOnline, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Chỉ phòng họp online mới khoá được.");

        if (IsEnded)
            throw new InvalidOperationException("Cuộc họp đã kết thúc.");

        // Phòng tạo nhanh đang để status = scheduled, mở khoá thì trả về như cũ.
        Status = locked ? StatusLocked : StatusScheduled;
        UpdatedAt = now;
    }

    public void End(DateTime now)
    {
        if (IsEnded)
            return;

        Status = StatusEnded;
        EndedAt = now;
        UpdatedAt = now;
    }
}
