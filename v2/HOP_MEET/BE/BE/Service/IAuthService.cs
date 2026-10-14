using BE.Dtos;

namespace BE.Service
{
    public interface IAuthService
    {
        Task<AuthResponse> RegisterUserAsync(RegisterRequest req, CancellationToken ct);
        Task<AuthResponse> LoginUserAsync(LoginRequest req, CancellationToken ct);
        Task<UserDto?> GetUserAsync(long id, CancellationToken ct);
    }
}
