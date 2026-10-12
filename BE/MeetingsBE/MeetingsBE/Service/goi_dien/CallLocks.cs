using System.Collections.Concurrent;

namespace MeetingsBE.Service;

public sealed class CallLocks
{
    private readonly ConcurrentDictionary<long, SemaphoreSlim> _locks = new();

    public async Task<IDisposable> AcquireAsync(long callId, CancellationToken ct)
    {
        var gate = _locks.GetOrAdd(callId, _ => new SemaphoreSlim(1, 1));

        await gate.WaitAsync(ct);

        return new Release(gate);
    }

    public void Forget(long callId) => _locks.TryRemove(callId, out _);

    private sealed class Release : IDisposable
    {
        private readonly SemaphoreSlim _gate;

        public Release(SemaphoreSlim gate)
        {
            _gate = gate;
        }

        public void Dispose() => _gate.Release();
    }
}
