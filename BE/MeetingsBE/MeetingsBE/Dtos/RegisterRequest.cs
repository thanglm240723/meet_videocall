using System.ComponentModel.DataAnnotations;

namespace MeetingsBE.Dtos
{
    public class RegisterRequest
    {
        [Required(ErrorMessage = "Vui lòng nhập tên hiển thị.")]
        [StringLength(100, MinimumLength = 2, ErrorMessage = "Tên hiển thị dài từ 2 đến 100 ký tự.")]
        public string DisplayName { get; set; } = null!;

        [Required(ErrorMessage = "Vui lòng nhập email.")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
        [StringLength(320, ErrorMessage = "Email tối đa 320 ký tự.")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
        [StringLength(100, MinimumLength = 8, ErrorMessage = "Mật khẩu dài từ 8 đến 100 ký tự.")]
        [RegularExpression(@"^(?=.*\p{L})(?=.*\d).+$", ErrorMessage = "Mật khẩu phải có cả chữ cái và chữ số.")]
        public string Password { get; set; } = null!;
    }
}
