namespace MeetingsBE.Models;

public partial class Call
{
    public const string TypePersonal = "personal";
    public const string TypeGroup = "group";

    public const string StatusRinging = "ringing";
    public const string StatusActive = "active";
    public const string StatusEnded = "ended";
    public const string StatusCancelled = "cancelled";

    public const string EndNoAnswer = "no_answer";
    public const string EndDeclined = "declined";
    public const string EndCallerCancelled = "caller_cancelled";
    public const string EndParticipantLeft = "participant_left";
    public const string EndNoParticipants = "no_participants";
    public const string EndOwnerEndedAll = "owner_ended_all";

    public virtual CallDailyRoom? DailyRoom { get; set; }

    public bool IsGroup => CallType == TypeGroup;

    public bool IsOver => Status is StatusEnded or StatusCancelled;

    public static Call Start(long ownerId, bool group, DateTime now)
    {
        return new Call
        {
            OwnerId = ownerId,
            CallType = group ? TypeGroup : TypePersonal,
            Status = StatusRinging,
            CreatedAt = now
        };
    }

    public void Activate(DateTime now)
    {
        if (Status != StatusRinging)
            return;

        Status = StatusActive;
        StartedAt = now;
    }

    public void Finish(string reason, DateTime now)
    {
        if (IsOver)
            return;

        Status = StartedAt == null ? StatusCancelled : StatusEnded;
        EndedAt = now;
        EndReason = reason;

        foreach (var member in CallMembers)
        {
            if (member.IsRinging)
                member.Miss(now);

            member.CloseLog(now);
        }
    }
}
