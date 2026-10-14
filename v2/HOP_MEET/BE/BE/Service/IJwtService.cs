using BE.Model;

namespace BE.Service
{
    public interface IJwtService
    {
        (string Token, DateTime ExpiresAt) GenerateToken(User user);
    }
}
