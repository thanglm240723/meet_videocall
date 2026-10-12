using System;

namespace MeetingsBE.Models;

public class MeetingDailyRoom
{
    public long MeetingId { get; private set; }

    public string DailyRoomName { get; private set; } = null!;

    public string DailyRoomUrl { get; private set; } = null!;

    public DateTime CreatedAt { get; private set; }

    public virtual Meeting Meeting { get; private set; } = null!;

    public MeetingDailyRoom() { }



    public static MeetingDailyRoom Create(long id ,  string name , string url , DateTime createdAt  )
    {
        if(string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Daily room name cannot be null or empty.", nameof(name));
        }
        if(string.IsNullOrWhiteSpace(url))
        {
            throw new ArgumentException("Daily room URL cannot be null or empty.", nameof(url));
        }


        return new MeetingDailyRoom
        {
            MeetingId = id,
            DailyRoomName = name,
            DailyRoomUrl = url,
            CreatedAt = createdAt
        };
    }
}