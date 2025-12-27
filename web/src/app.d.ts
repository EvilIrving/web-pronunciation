// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: ReturnType<typeof import('@supabase/ssr').createServerClient>
			getSession: () => Promise<import('@supabase/supabase-js').Session | null>
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
