using BE.Data;
using BE.Dtos;
using BE.Model;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BE.Service
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _dbContext;
        private readonly IJwtService _jwtService;
        private readonly IPasswordHasher<User> _passwordHasher;

        public AuthService(AppDbContext dbContext, IJwtService jwtService, IPasswordHasher<User> passwordHasher)
        {
            _dbContext = dbContext;
            _jwtService = jwtService;
            _passwordHasher = passwordHasher;
        }

        public async Task<AuthResponse> RegisterUserAsync(RegisterRequest req, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(req.Email))
                throw new ArgumentException("Email cannot be empty.");
            if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
                throw new ArgumentException("Password must be at least 6 characters.");

            var email = User.NormalizeEmail(req.Email);
            if (await _dbContext.Users.AnyAsync(u => u.Email == email, ct))
                throw new InvalidOperationException("Email is already registered.");

            var user = User.Create(req.DisplayName, email, DateTime.UtcNow);
            user.SetPasswordHash(_passwordHasher.HashPassword(user, req.Password));

            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync(ct);

            // dang ky xong dang nhap luon -> tra token giong Login
            var (token, expiresAt) = _jwtService.GenerateToken(user);
            return new AuthResponse(token, expiresAt, ToDto(user));
        }

        public async Task<AuthResponse> LoginUserAsync(LoginRequest req, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                throw new UnauthorizedAccessException("Invalid email or password.");

            var email = User.NormalizeEmail(req.Email);
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
            if (user is null)
                throw new UnauthorizedAccessException("Invalid email or password.");

            var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
            if (result == PasswordVerificationResult.Failed)
                throw new UnauthorizedAccessException("Invalid email or password.");

            if (result == PasswordVerificationResult.SuccessRehashNeeded)
            {
                user.SetPasswordHash(_passwordHasher.HashPassword(user, req.Password));
                await _dbContext.SaveChangesAsync(ct);
            }

            var (token, expiresAt) = _jwtService.GenerateToken(user);
            return new AuthResponse(token, expiresAt, ToDto(user));
        }

        public async Task<UserDto?> GetUserAsync(long id, CancellationToken ct)
        {
            var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
            return user is null ? null : ToDto(user);
        }

        private static UserDto ToDto(User user) => new(user.Id, user.Email, user.DisplayName);
    }
}
