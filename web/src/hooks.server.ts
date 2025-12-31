import { createServerClient } from '@supabase/ssr'
import { type Handle, redirect } from '@sveltejs/kit'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

// Admin role check key - should match custom claim or metadata key in Supabase
const ADMIN_ROLE_KEY = 'admin_role'

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' })
				})
			},
		},
	})

	event.locals.getSession = async () => {
		const {
			data: { session },
		} = await event.locals.supabase.auth.getSession()
		return session
	}

	// Parse user and admin status from session
	const session = await event.locals.getSession()
	if (session?.user) {
		event.locals.user = session.user
		// Check for admin role in user metadata or app_metadata
		const appMetadata = session.user.app_metadata || {}
		const userMetadata = session.user.user_metadata || {}
		event.locals.isAdmin = Boolean(
			appMetadata[ADMIN_ROLE_KEY] === true ||
			userMetadata[ADMIN_ROLE_KEY] === true
		)
		// Debug log - 临时调试用
		console.log('[Auth Debug]', {
			email: session.user.email,
			isAdmin: event.locals.isAdmin,
			appMetadata,
			userMetadata
		})
	} else {
		event.locals.user = null
		event.locals.isAdmin = false
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range',
	})
}
