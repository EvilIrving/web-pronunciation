import { createServerClient } from '@supabase/ssr'
import { type Handle, redirect } from '@sveltejs/kit'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

const ADMIN_ROLE_KEY = 'admin_role'

export const handle: Handle = async ({ event, resolve }) => {
    console.log('[Hook] Request:', event.request.method, event.url.pathname)

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

    const session = await event.locals.getSession()
    console.log('[Hook] Session:', session ? `user=${session.user.email}` : 'null')

    if (session?.user) {
        event.locals.user = session.user
        const appMetadata = session.user.app_metadata || {}
        const userMetadata = session.user.user_metadata || {}
        event.locals.isAdmin = Boolean(
            appMetadata[ADMIN_ROLE_KEY] === true ||
            userMetadata[ADMIN_ROLE_KEY] === true
        )
        console.log('[Hook] Auth:', {
            email: session.user.email,
            isAdmin: event.locals.isAdmin,
            app_admin: appMetadata[ADMIN_ROLE_KEY],
            user_admin: userMetadata[ADMIN_ROLE_KEY]
        })
    } else {
        event.locals.user = null
        event.locals.isAdmin = false
        console.log('[Hook] No session')
    }

    return resolve(event, {
        filterSerializedResponseHeaders: (name) => name === 'content-range',
    })
}