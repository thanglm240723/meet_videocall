using System.Text.Json;
using System.Text.Json.Serialization;

namespace MeetingsBE.Dtos
{
    public sealed class DailyRoomResponse
    {
        [JsonPropertyName("id")]
        public string DailyRoomId { get; set; } = null!;

        [JsonPropertyName("name")]
        public string DailyRoomName { get; set; } = null!;

        [JsonPropertyName("api_created")]
        public bool ApiCreated { get; set; }

        [JsonPropertyName("privacy")]
        public string Privacy { get; set; } = null!;

        [JsonPropertyName("url")]
        public string DailyRoomUrl { get; set; } = null!;

        [JsonPropertyName("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [JsonPropertyName("config")]
        public Dictionary<string, JsonElement> Config { get; set; } = new();
    }
}
