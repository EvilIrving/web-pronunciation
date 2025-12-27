// 扩展 globalThis 类型
declare global {
  var __rateLimitQueues: Record<string, number[]> | undefined;
}

/**
 * 统一的速率限制器
 * 用于保护第三方 API 调用（有道、欧陆词典等）
 */

// 速率限制配置
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// 各 provider 的限制配置
const CONFIGS: Record<string, RateLimitConfig> = {
  youdao: { maxRequests: 5, windowMs: 60 * 1000 },      // 有道：每分钟 5 次
  eudic: { maxRequests: 5, windowMs: 60 * 1000 },       // 欧陆：每分钟 5 次
  frdic: { maxRequests: 10, windowMs: 60 * 1000 },      // frdic：每分钟 10 次（相对宽松）
};

// 存储各 provider 的请求时间戳（使用 global 避免服务端热重载重置）
const requestQueues: Record<string, number[]> = globalThis.__rateLimitQueues || {};
globalThis.__rateLimitQueues = requestQueues;

/**
 * 检查速率限制
 * @param provider - provider 名称
 * @returns { allowed: boolean, waitSeconds: number, remaining: number }
 */
export function checkRateLimit(provider: string): { allowed: boolean; waitSeconds: number; remaining: number } {
  const config = CONFIGS[provider] || { maxRequests: 5, windowMs: 60 * 1000 };
  const queue = requestQueues[provider] || [];

  const now = Date.now();

  // 清理过期的请求记录
  const validTimes = queue.filter(t => now - t < config.windowMs);
  requestQueues[provider] = validTimes;

  if (validTimes.length >= config.maxRequests) {
    const oldest = validTimes[0];
    const waitSeconds = Math.ceil((oldest + config.windowMs - now) / 1000);
    return { allowed: false, waitSeconds, remaining: 0 };
  }

  // 记录本次请求
  requestQueues[provider] = [...validTimes, now];
  return { allowed: true, waitSeconds: 0, remaining: config.maxRequests - validTimes.length - 1 };
}

/**
 * 带速率限制的请求包装器
 * @param provider - provider 名称
 * @param fn - 要执行的异步函数
 * @returns 函数结果，如果被限流则抛出错误
 */
export async function withRateLimit<T>(
  provider: string,
  fn: () => Promise<T>
): Promise<T> {
  const { allowed, waitSeconds } = checkRateLimit(provider);

  if (!allowed) {
    throw new Error(`rate limited: ${provider}, retry after ${waitSeconds}s`);
  }

  return fn();
}

/**
 * 速率限制错误信息
 */
export class RateLimitError extends Error {
  waitSeconds: number;

  constructor(provider: string, waitSeconds: number) {
    super(`rate limited: ${provider}, retry after ${waitSeconds}s`);
    this.name = 'RateLimitError';
    this.waitSeconds = waitSeconds;
  }
}

/**
 * 获取指定 provider 的当前请求计数
 */
export function getRequestCount(provider: string): number {
  const queue = requestQueues[provider] || [];
  const now = Date.now();
  const config = CONFIGS[provider] || { maxRequests: 5, windowMs: 60 * 1000 };
  return queue.filter(t => now - t < config.windowMs).length;
}

/**
 * 获取指定 provider 的剩余请求数
 */
export function getRemainingRequests(provider: string): number {
  const { remaining } = checkRateLimit(provider);
  return remaining;
}

/**
 * 重置指定 provider 的速率限制
 */
export function resetRateLimit(provider: string): void {
  requestQueues[provider] = [];
}

/**
 * 获取所有 provider 的状态
 */
export function getRateLimitStatus(): Record<string, { count: number; remaining: number; limit: number }> {
  const status: Record<string, { count: number; remaining: number; limit: number }> = {};

  for (const provider of Object.keys(CONFIGS)) {
    const queue = requestQueues[provider] || [];
    const now = Date.now();
    const config = CONFIGS[provider];
    const validCount = queue.filter(t => now - t < config.windowMs).length;
    status[provider] = {
      count: validCount,
      remaining: config.maxRequests - validCount,
      limit: config.maxRequests
    };
  }

  return status;
}
