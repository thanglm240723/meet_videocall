using BE.Realtime;
using Microsoft.AspNetCore.SignalR;

namespace BE.Service.goi_video
{
    // Cu 2 giay quet 1 lan: ai do chuong qua 30s ma chua nghe -> nho
    public class RingTimeoutWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<CuocGoiHub> _hub;
        private readonly ILogger<RingTimeoutWorker> _logger;

        public RingTimeoutWorker(IServiceScopeFactory scopeFactory, IHubContext<CuocGoiHub> hub, ILogger<RingTimeoutWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _hub = hub;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));

            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var goiVideo = scope.ServiceProvider.GetRequiredService<IGoiVideoService>();

                    var changed = await goiVideo.ExpireRingingAsync(stoppingToken);
                    foreach (var call in changed)
                        await CuocGoiHub.SendCallAsync(_hub.Clients, call);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Loi khi xu ly het gio do chuong");
                }
            }
        }
    }
}
