namespace MeetingsBE.Models;

public partial class CallMember
{
    public const string ChannelOwner = "owner";
    public const string ChannelInApp = "in_app";

    public const string ResponsePending = "pending";
    public const string ResponseAccepted = "accepted";
    public const string ResponseDeclined = "declined";
    public const string ResponseNoAnswer = "no_answer";

    public const string ResultPending = "pending";
    public const string ResultConnected = "connected";
    public const string ResultMissed = "missed";
    public const string ResultDeclined = "declined";

    public bool IsOwner => DeliveryChannel == ChannelOwner;

    public bool IsRinging => DeliveryChannel == ChannelInApp && ResponseStatus == ResponsePending;

    public bool InRoom => CallJoinLogs.Any(l => l.LeftAt == null);

    public static CallMember Owner(User user, DateTime now)
    {
        return new CallMember
        {
            UserId = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            DeliveryChannel = ChannelOwner,
            DeliveryStatus = "sent",
            InvitedAt = now,
            ResponseStatus = ResponseAccepted,
            RespondedAt = now,
            Result = ResultConnected
        };
    }

    public static CallMember Callee(User user, bool online, DateTime now, TimeSpan ringFor)
    {
        return new CallMember
        {
            UserId = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            DeliveryChannel = ChannelInApp,
            DeliveryStatus = online ? "sent" : "failed",
            InvitedAt = now,
            RingExpiresAt = now.Add(ringFor),
            ResponseStatus = ResponsePending,
            Result = ResultPending
        };
    }

    public void Accept(DateTime now)
    {
        ResponseStatus = ResponseAccepted;
        RespondedAt = now;
        Join(now);
    }

    public void Decline(DateTime now)
    {
        ResponseStatus = ResponseDeclined;
        RespondedAt = now;
        Result = ResultDeclined;
    }

    public void Miss(DateTime now)
    {
        ResponseStatus = ResponseNoAnswer;
        RespondedAt = now;
        Result = ResultMissed;
    }

    public void Join(DateTime now)
    {
        Result = ResultConnected;

        if (!InRoom)
            CallJoinLogs.Add(new CallJoinLog { JoinedAt = now });
    }

    public void CloseLog(DateTime now)
    {
        foreach (var log in CallJoinLogs.Where(l => l.LeftAt == null))
            log.LeftAt = now;
    }
}
