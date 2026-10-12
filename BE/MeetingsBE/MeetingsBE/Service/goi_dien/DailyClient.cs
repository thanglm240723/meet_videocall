using System.Globalization;
using MeetingsBE.Dtos;

namespace MeetingsBE.Service;

public interface IDailyClient
{
    Task<DailyRoomResponse> CreateRoomAsync(string roomName, int maxParticipants, DateTimeOffset expiresAt, CancellationToken ct);

    Task<string> CreateTokenAsync(string roomName, long userId, string userName, bool isOwner, DateTimeOffset expiresAt, CancellationToken ct);
}

public sealed class DailyClient : IDailyClient
{
    private readonly HttpClient _http;

    public DailyClient(HttpClient http)
    {
        _http = http;
    }

    public Task<DailyRoomResponse> CreateRoomAsync(string roomName, int maxParticipants, DateTimeOffset expiresAt, CancellationToken ct)
    {
        return PostAsync<DailyRoomResponse>(
            "rooms",
            new
            {
                name = roomName,
                privacy = "private",
                properties = new
                {
                    max_participants = maxParticipants,
                    enforce_unique_user_ids = true,
                    enable_knocking = false,
                    enable_prejoin_ui = false,
                    enable_chat = false,
                    enable_screenshare = true,
                    exp = expiresAt.ToUnixTimeSeconds(),
                    eject_at_room_exp = true
                }
            },
            ct);
    }

    public async Task<string> CreateTokenAsync(string roomName, long userId, string userName, bool isOwner, DateTimeOffset expiresAt, CancellationToken ct)
    {
        var result = await PostAsync<DailyTokenResponse>(
            "meeting-tokens",
            new
            {
                properties = new
                {
                    room_name = roomName,
                    user_id = userId.ToString(CultureInfo.InvariantCulture),
                    user_name = userName,
                    is_owner = isOwner,
                    exp = expiresAt.ToUnixTimeSeconds(),
                    eject_at_token_exp = true
                }
            },
            ct);

        return result.Token;
    }

    private async Task<T> PostAsync<T>(string path, object body, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync(path, body, ct);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct)
               ?? throw new HttpRequestException("Daily trả về dữ liệu rỗng.");
    }
}

public sealed record DailyTokenResponse(string Token);
