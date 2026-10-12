namespace MeetingsBE.Service;

public sealed class CallTimeoutWorker : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromSeconds(2);
    public static readonly TimeSpan OfflineGrace = TimeSpan.FromSeconds(15);

    private readonly IServiceScopeFactory _scopes;
    private readonly CallPresence _presence;
    private readonly ILogger<CallTimeoutWorker> _logger;

    public CallTimeoutWorker(IServiceScopeFactory scopes, CallPresence presence, ILogger<CallTimeoutWorker> logger)
    {
        _scopes = scopes;
        _presence = presence;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Lỗi khi quét cuộc gọi hết giờ");
            }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        using var scope = _scopes.CreateScope();
        var calls = scope.ServiceProvider.GetRequiredService<ICallService>();

        await calls.ExpireRingsAsync(now, ct);

        foreach (var userId in _presence.TakeOfflineBefore(now - OfflineGrace))
        {
            if (!_presence.IsOnline(userId))
                await calls.HandleOfflineAsync(userId, ct);
        }
    }
}
