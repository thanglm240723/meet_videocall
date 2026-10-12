namespace MeetingsBE.Models;


public class CallDailyRoom
{
    public long CallId { get; private set; }

    public string DailyRoomName { get; private set; } = null!;

    public string DailyRoomUrl { get; private set; } = null!;

    public DateTime CreatedAt { get; private set; }

    public DateTime ExpiresAt { get; private set; }

    public virtual Call Call { get; private set; } = null!;

    private CallDailyRoom() { }

    public static CallDailyRoom Create(Call call, string name, string url, DateTime createdAt, DateTime expiresAt)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Daily room name cannot be empty.", nameof(name));

        if (string.IsNullOrWhiteSpace(url) || url.Length > 500)
            throw new ArgumentException("Daily room URL is invalid.", nameof(url));

        if (expiresAt <= createdAt)
            throw new ArgumentException("Room must expire after it is created.", nameof(expiresAt));

        return new CallDailyRoom
        {
            Call = call,
            DailyRoomName = name,
            DailyRoomUrl = url,
            CreatedAt = createdAt,
            ExpiresAt = expiresAt
        };
    }
}
