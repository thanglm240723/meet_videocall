using MeetingsBE.Dtos;
using MeetingsBE.Models;

namespace MeetingsBE.Service
{
    public interface IAutheService
    {
        Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct);

        Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct);

        Task<User?> GetByIdAsync(long userId, CancellationToken ct);

        public sealed record AuthResult(AuthError Error, User? User = null);

        public enum AuthError
        {
            None,
            EmailTaken,
            InvalidCredentials
        }
    }
}
