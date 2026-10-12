using Microsoft.AspNetCore.Authentication.JwtBearer;
using MeetingsBE.Hubs;
using MeetingsBE.Models;
using MeetingsBE.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Net.Http.Headers;
var builder = WebApplication.CreateBuilder(args);

var dailyApiKey = builder.Configuration["Daily:ApiKey"];

if (string.IsNullOrWhiteSpace(dailyApiKey))
{
    throw new InvalidOperationException(
        "Thiếu cấu hình Daily:ApiKey.");
}

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddDbContext<MeetingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
//JWT Authentication
builder.Services
    .AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
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
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];

                if (!string.IsNullOrEmpty(token)
                    && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    context.Token = token;
                }

                return Task.CompletedTask;
            }
        };
    });


void ConfigureDaily(HttpClient http)
{
    http.BaseAddress = new Uri("https://api.daily.co/v1/");
    http.Timeout = TimeSpan.FromSeconds(20);

    http.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("Bearer", dailyApiKey);
}

builder.Services.AddHttpClient<IMeetService, MeetService>(ConfigureDaily);
builder.Services.AddHttpClient<IDailyClient, DailyClient>(ConfigureDaily);

//DI
builder.Services.AddScoped<IAutheService, AuthService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddSingleton<IScheduleNotifier, ScheduleNotifier>();
builder.Services.AddScoped<IScheduleService, ScheduleService>();
builder.Services.AddSignalR();
builder.Services.AddSingleton<CallPresence>();
builder.Services.AddSingleton<CallLocks>();
builder.Services.AddSingleton<ICallNotifier, CallNotifier>();
builder.Services.AddScoped<ICallService, CallService>();
builder.Services.AddHostedService<CallTimeoutWorker>();

//Authorization
var requireAuthPolicy = new AuthorizationPolicyBuilder()
    .RequireAuthenticatedUser()
    .Build();

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(requireAuthPolicy);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();

    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint(
            "/openapi/v1.json",
            "Meetings API");
    });
}

app.UseHttpsRedirection();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<CallHub>("/hubs/calls");

app.MapFallbackToFile("index.html").AllowAnonymous();


app.Run();
