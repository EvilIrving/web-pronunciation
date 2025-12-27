<script lang="ts">
  import { goto } from '$app/navigation'
  import { signIn, authState } from '$lib/auth.svelte'

  let email = $state('')
  let password = $state('')
  let error = $state<string | null>(null)
  let loading = $state(false)

  // 如果已登录，直接跳转到 admin
  $effect(() => {
    if (authState.user) {
      goto('/admin')
    }
  })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = null
    loading = true

    try {
      console.log('开始登录...')
      const result = await signIn(email, password)
      console.log('登录结果:', result)
      if (result.error) {
        error = result.error.message
        console.error('登录错误:', result.error)
      } else {
        console.log('登录成功，使用 goto 跳转...')
        await goto('/admin', { replaceState: true, noScroll: true })
      }
    } catch (err) {
      error = '发生未知错误'
      console.error(err)
    } finally {
      loading = false
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-terminal-bg py-12 px-4 font-mono">
  <div class="max-w-sm w-full space-y-6">
    <div>
      <h2 class="text-center text-lg text-terminal-text-primary">
        $ <span class="text-terminal-accent">login</span>
      </h2>
    </div>

    <form class="space-y-4" onsubmit={handleSubmit}>
      <div class="space-y-3">
        <div>
          <label for="email-address" class="sr-only">邮箱地址</label>
          <input
            id="email-address"
            name="email"
            type="email"
            autocomplete="email"
            required
            bind:value={email}
            class="input-terminal w-full px-3 py-2 text-sm"
            placeholder="email"
          />
        </div>
        <div>
          <label for="password" class="sr-only">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            bind:value={password}
            class="input-terminal w-full px-3 py-2 text-sm"
            placeholder="password"
          />
        </div>
      </div>

      {#if error}
        <div class="text-terminal-error text-sm text-center">{error}</div>
      {/if}

      <div>
        <button
          type="submit"
          disabled={loading}
          class="btn-terminal w-full py-2 text-sm disabled:opacity-50"
        >
          {loading ? '...' : 'submit'}
        </button>
      </div>

      <div class="text-center">
        <a href="/" class="text-sm text-terminal-text-muted hover:text-terminal-text-secondary">
          ← back
        </a>
      </div>
    </form>
  </div>
</div>
