namespace BE.Dtos
{
    public record UserDto(long Id, string Email, string DisplayName);

    public record AuthResponse(string AccessToken, DateTime ExpiresAt, UserDto User);
}
