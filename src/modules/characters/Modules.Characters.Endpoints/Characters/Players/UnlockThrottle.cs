using Microsoft.AspNetCore.Http;
using Starlights.Modules.Characters.Services.Players;

namespace Starlights.Modules.Characters.Endpoints.Characters.Players;

/// <summary>The unlock endpoints' answer when an account has had its tries this minute (see <see cref="UnlockLimiter"/>).</summary>
internal static class UnlockThrottle
{
    /// <summary>Counts the attempt; when over the limit, answers 429 with Retry-After and returns false.</summary>
    public static async Task<bool> TryAsync(UnlockLimiter limiter, HttpContext context, string account, CancellationToken ct)
    {
        if (limiter.TryAttempt(account, out var wait))
        {
            return true;
        }
        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.Response.Headers.RetryAfter = Math.Max(1, (int)Math.Ceiling(wait.TotalSeconds)).ToString();
        await context.Response.WriteAsJsonAsync(new { message = "Too many tries. Wait a minute and try again." }, ct);
        return false;
    }
}
