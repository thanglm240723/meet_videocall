using BE.Data;
using BE.Model;
using BE.Realtime;
using BE.Service;
using BE.Service.goi_video;
using BE.Service.phong_hop;
using BE.Service.lich_hop;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

// Giu cach luu DateTime nhu SQL Server cu (timestamp khong mui gio, code tu lo UTC)
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

//Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddSignalR();
builder.Services.AddSingleton<RoomRegistry>();

//JWT Authentication
builder.Services
    .AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
       
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,

            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],

            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    builder.Configuration["Jwt:Key"]!
                )
            )
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

//CORS cho FE (Vite)
builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"])
              .AllowAnyHeader()
              .AllowAnyMethod()));

//DI
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// Hop + goi video
builder.Services.AddScoped<IPhongHopService, PhongHopService>();
builder.Services.AddScoped<IGoiVideoService, GoiVideoService>();
builder.Services.AddScoped<LichHopService>();
builder.Services.AddSingleton<OnlineUsers>();
builder.Services.AddHostedService<RingTimeoutWorker>();

var app = builder.Build();


if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Chay sau Caddy: lay dung scheme https va IP that cua client
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseHttpsRedirection();

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<MeetHub>("/hubs/meet");
app.MapHub<CuocGoiHub>("/hubs/calls");
app.Run();
