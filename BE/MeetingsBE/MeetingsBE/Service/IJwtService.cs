using MeetingsBE.Models;

namespace MeetingsBE.Service
{
    public interface IJwtService
    {
        string GenerateTokenAsync(User user);
    }
}
