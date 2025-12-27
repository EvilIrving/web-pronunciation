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

<div class="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        管理员登录
      </h2>
    </div>

    <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
      <div class="rounded-md shadow-sm -space-y-px">
        <div>
          <label for="email-address" class="sr-only">邮箱地址</label>
          <input
            id="email-address"
            name="email"
            type="email"
            autocomplete="email"
            required
            bind:value={email}
            class="relative block w-full rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            placeholder="邮箱地址"
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
            class="relative block w-full rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            placeholder="密码"
          />
        </div>
      </div>

      {#if error}
        <div class="text-red-600 text-sm text-center">{error}</div>
      {/if}

      <div>
        <button
          type="submit"
          disabled={loading}
          class="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </div>

      <div class="text-center">
        <a href="/" class="text-sm text-gray-600 hover:text-gray-500">
          返回首页
        </a>
      </div>
    </form>
  </div>
</div>
