import { supabase } from '$lib/supabase'
import { browser } from '$app/environment'
import type { User, Session } from '@supabase/supabase-js'

export type AuthState = {
	user: User | null
	session: Session | null
	loading: boolean
}

class AuthStateManager {
	private _state: AuthState = {
		user: null,
		session: null,
		loading: true
	}

	get value(): AuthState {
		return this._state
	}

	set user(user: User | null) {
		this._state.user = user
		// 持久化到 localStorage
		if (browser) {
			if (user) {
				localStorage.setItem('auth_user', JSON.stringify(user));
			} else {
				localStorage.removeItem('auth_user');
			}
		}
	}

	set session(session: Session | null) {
		this._state.session = session
	}

	set loading(loading: boolean) {
		this._state.loading = loading
	}
}

// 单例实例
export const authState = new AuthStateManager()

export async function signIn(email: string, password: string) {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password
	})
	if (error) return { error }
	if (browser) {
		authState.user = data.user
		authState.session = data.session
	}
	return { data }
}

export async function signOut() {
	const { error } = await supabase.auth.signOut()
	if (error) return { error }
	if (browser) {
		authState.user = null
		authState.session = null
	}
	return { error: null }
}

export function initAuth() {
	if (!browser) return

	supabase.auth.getSession().then(({ data: { session } }) => {
		authState.session = session
		authState.user = session?.user ?? null
		authState.loading = false
	})

	supabase.auth.onAuthStateChange((_event, session) => {
		authState.session = session
		authState.user = session?.user ?? null
		authState.loading = false
	})
}

export async function getSession() {
	const {
		data: { session },
		error
	} = await supabase.auth.getSession()
	if (error) return null
	if (browser) {
		authState.session = session
		authState.user = session?.user ?? null
	}
	return session
}
