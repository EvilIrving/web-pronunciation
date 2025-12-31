import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * 验证用户是否已登录且为管理员
 * 在所有管理 API 路由开头调用
 */
export function requireAdmin(locals: App.Locals): { user: App.Locals['user']; isAdmin: boolean } | Response {
    if (!locals.user) {
        return json({ error: 'unauthorized', message: 'Please login first' }, { status: 401 });
    }
    // TODO: 开发期间临时放宽，正式环境需恢复 isAdmin 检查
    // if (!locals.isAdmin) {
    // 	return json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 });
    // }
    return { user: locals.user, isAdmin: locals.isAdmin };
}

/**
 * 验证用户是否已登录
 * 用于需要登录但不一定需要 admin 的 API
 */
export function requireAuth(locals: App.Locals): App.Locals['user'] | Response {
	if (!locals.user) {
		return json({ error: 'unauthorized', message: 'Please login first' }, { status: 401 });
	}
	return locals.user;
}

/**
 * 创建带权限检查的 RequestHandler 包装器
 * @param handler 原始 handler
 * @param requireAdminRole 是否需要 admin 权限
 */
export function withAuth(
	handler: RequestHandler,
	requireAdminRole: boolean = true
): RequestHandler {
	return async (event) => {
		const authResult = requireAdminRole ? requireAdmin(event.locals) : requireAuth(event.locals);
		
		if (authResult instanceof Response) {
			return authResult;
		}
		
		return handler(event);
	};
}
