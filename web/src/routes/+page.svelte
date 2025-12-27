<script lang="ts">
  import { onMount } from 'svelte';
  import type { Word } from '$lib/types';
  import VirtualList from '$lib/components/VirtualList.svelte';

  type Accent = 'us' | 'uk' | 'common';

  let { children } = $props();
  let words = $state<Word[]>([]);
  let searchQuery = $state('');
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let hasMore = $state(true);
  let offset = $state(0);
  let total = $state(0);
  let audio = $state<HTMLAudioElement | null>(null);
  let playing = $state<{ id: string; accent: Accent } | null>(null);
  let theme = $state<'terminal' | 'claude' | 'github'>('terminal');

  const LIMIT = 50;
  const themes: Array<'terminal' | 'claude' | 'github'> = ['terminal', 'claude', 'github'];
  let debounce: ReturnType<typeof setTimeout>;
  let isMobile = $state(false);
  let copied = $state(false);

  function toggleTheme() {
    const idx = themes.indexOf(theme);
    const next = themes[(idx + 1) % themes.length];
    theme = next;
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  function checkMobile() {
    if (typeof window !== 'undefined') {
      isMobile = window.innerWidth < 640;
    }
  }

  function copyEmail() {
    navigator.clipboard.writeText('jescain2024@gmail.com');
    copied = true;
    setTimeout(() => copied = false, 2000);
  }

  async function load(reset = false) {
    if (isLoading || (!hasMore && !reset)) return;
    isLoading = true;
    const off = reset ? 0 : offset;

    try {
      const p = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (searchQuery.trim()) p.set('search', searchQuery.trim());

      const res = await fetch(`/api/words?${p}`);
      const json = await res.json();
      if (json.error) return console.error(json.error);

      words = reset ? json.data : [...words, ...json.data];
      offset = off + LIMIT;
      total = json.total;
      hasMore = json.hasMore;
      isInitialized = true;
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  function search(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value;
    clearTimeout(debounce);
    debounce = setTimeout(() => { hasMore = true; load(true); }, 300);
  }

  function getAudioUrl(word: Word, accent: Accent): string | null {
    if (accent === 'us') return word.audio_url_us;
    if (accent === 'uk') return word.audio_url_uk;
    return word.audio_url;
  }

  function play(word: Word, accent: Accent) {
    const url = getAudioUrl(word, accent);
    if (!url) return;

    audio?.pause();
    if (playing?.id === word.id && playing?.accent === accent) {
      playing = null;
      audio = null;
      return;
    }

    const a = new Audio(url);
    audio = a;
    playing = { id: word.id, accent };
    a.play().catch(() => (playing = null));
    a.onended = () => { playing = null; audio = null; };
  }

  function isPlaying(word: Word, accent: Accent) {
    return playing?.id === word.id && playing?.accent === accent;
  }

  function getIpaText(word: Word, accent: Accent): string {
    if (accent === 'us') return word.ipa_us?.replace(/^\/+|\/+$/g, '') ?? '';
    if (accent === 'uk') return word.ipa_uk?.replace(/^\/+|\/+$/g, '') ?? '';
    return word.ipa?.replace(/^\/+|\/+$/g, '') ?? '';
  }

  function themeIcon() {
    if (theme === 'terminal') {
      // Claude icon (C)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 10h8M8 14h4"/></svg>`;
    }
    if (theme === 'claude') {
      // UNIX icon ($)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M8 12h8"/></svg>`;
    }
    // GitHub icon (cat)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`;
  }

  onMount(() => {
    console.log('%c错了不要紧，顺口就是好。', 'color: #666; font-style: italic;');
    checkMobile();
    load(true);
    window.addEventListener('resize', checkMobile);

    const saved = localStorage.getItem('theme') as 'terminal' | 'claude' | 'github' | null;
    if (saved && themes.includes(saved)) {
      theme = saved;
      document.documentElement.setAttribute('data-theme', saved);
    }
  });
</script>

<svelte:head>
  <title>技术词汇发音 | Tech Vocabulary Index</title>
  <meta name="description" content="程序员技术词汇发音索引。收录 coroutine、cache、daemon、enum 等常用技术词汇的 IPA 音标和标准发音。">
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] transition-colors duration-[var(--transition)] no-select">
  <header class="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
    {#if theme === 'terminal'}
      <span class="text-[var(--color-accent)] text-lg leading-none">$</span>
    {:else}
      <div class="w-6 h-6 rounded bg-[var(--color-accent)] flex items-center justify-center text-white text-xs font-bold">C</div>
    {/if}
    <input
      type="text"
      placeholder="grep ... (搜搜看自己读错美，如: coroutine, cache)"
      value={searchQuery}
      oninput={search}
      class="flex-1 min-w-0 bg-transparent border-none outline-none text-[var(--color-text-primary)] caret-[var(--color-accent)] placeholder:text-[var(--color-text-muted)] py-2 select-text font-inherit"
    />
    {#if !isMobile}
      <span class="text-[var(--color-text-dim)] text-xs shrink-0">{total} entries</span>
    {/if}
  </header>

  <main class="bg-[var(--color-bg)] max-w-7xl mx-auto px-4 pb-20 h-[calc(100vh-var(--header-height,60px))] flex flex-col relative">
    {#if !isInitialized}
      <p class="text-[var(--color-text-muted)] py-4 text-center">loading...</p>
    {:else if !words.length}
      <p class="text-[var(--color-text-muted)] py-4 text-center">
        未找到"{searchQuery}"
        {#if searchQuery}
          <span class="block mt-2">如果希望收录此词，请 <button onclick={copyEmail} class="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] underline bg-transparent border-none p-0 cursor-pointer font-inherit">{copied ? '已复制 ✓' : '复制邮箱'}</button></span>
          <span class="block mt-1 text-xs text-[var(--color-text-dim)]">或 <a href="mailto:jescain2024@gmail.com?subject=建议收录词汇：{searchQuery}&body=请补充该词的发音信息" class="text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] underline">点击发邮件给我</a></span>
        {/if}
      </p>
    {:else}
      <VirtualList
        items={words}
        itemHeight={isMobile ? 48 : 36}
        gap={0}
        columns={1}
        columnBreakpoints={{ 640: 2, 1024: 3 }}
        height="100%"
        class="flex-1 min-h-0"
        onScrollEnd={() => !isLoading && hasMore && load()}
        getKey={(w) => w.id}
      >
        {#snippet children({ item: word })}
          <div class="flex items-center gap-2 h-full px-3 border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-hover)] touch-manipulation transition-colors">
            <span class="text-[var(--color-text-primary)] min-w-[8ch] truncate font-medium">{word.word}</span>
            <div class="flex-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {#if word.audio_url_us || word.ipa_us}
                {@const ipaText = word.ipa_us?.replace(/^\/+|\/+$/g, '') ?? ''}
                {@const hasAudio = !!word.audio_url_us}
                {@const active = isPlaying(word, 'us')}
                {#if hasAudio}
                  <button onclick={() => play(word, 'us')} class="bg-transparent border-none p-0 font-inherit cursor-pointer text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] {active ? 'text-[var(--color-accent-active)]' : ''}">
                    <span class="text-[9px] text-[var(--color-text-muted)] mr-1">US</span>{ipaText ? `/${ipaText}/` : '🔊'}{active}<span class="ml-1">{active ? '▮▮' : ''}</span>
                  </button>
                {:else}
                  <span class="text-[var(--color-disabled)] cursor-default"><span class="text-[9px] text-[var(--color-text-muted)] mr-1">US</span>/{ipaText}/</span>
                {/if}
              {/if}
              {#if word.audio_url_uk || word.ipa_uk}
                {@const ipaText = word.ipa_uk?.replace(/^\/+|\/+$/g, '') ?? ''}
                {@const hasAudio = !!word.audio_url_uk}
                {@const active = isPlaying(word, 'uk')}
                {#if hasAudio}
                  <button onclick={() => play(word, 'uk')} class="bg-transparent border-none p-0 font-inherit cursor-pointer text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] {active ? 'text-[var(--color-accent-active)]' : ''}">
                    <span class="text-[9px] text-[var(--color-text-muted)] mr-1">UK</span>{ipaText ? `/${ipaText}/` : '🔊'}{active}<span class="ml-1">{active ? '▮▮' : ''}</span>
                  </button>
                {:else}
                  <span class="text-[var(--color-disabled)] cursor-default"><span class="text-[9px] text-[var(--color-text-muted)] mr-1">UK</span>/{ipaText}/</span>
                {/if}
              {/if}
              {#if word.audio_url || word.ipa}
                {@const ipaText = word.ipa?.replace(/^\/+|\/+$/g, '') ?? ''}
                {@const hasAudio = !!word.audio_url}
                {@const active = isPlaying(word, 'common')}
                {#if hasAudio}
                  <button onclick={() => play(word, 'common')} class="bg-transparent border-none p-0 font-inherit cursor-pointer text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] {active ? 'text-[var(--color-accent-active)]' : ''}">
                    <span class="text-[9px] text-[var(--color-text-muted)] mr-1">EN</span>{ipaText ? `/${ipaText}/` : '🔊'}{active}<span class="ml-1">{active ? '▮▮' : ''}</span>
                  </button>
                {:else}
                  <span class="text-[var(--color-disabled)] cursor-default"><span class="text-[9px] text-[var(--color-text-muted)] mr-1">EN</span>/{ipaText}/</span>
                {/if}
              {/if}
            </div>
          </div>
        {/snippet}
      </VirtualList>
      {#if isLoading}<p class="text-[var(--color-text-muted)] py-4 text-center text-sm">...</p>{/if}
      {#if !hasMore}<p class="text-[var(--color-text-dim)] text-xs text-center pb-2 pt-4">--- 错了不要紧，顺口就是好 ---</p>{/if}
    {/if}
  </main>

  <footer class="fixed bottom-4 right-4 flex items-center gap-4 z-10">
    <span class="text-[10px] text-[var(--color-text-dim)]">© 2025 web-pronunciation</span>
    <button
      onclick={toggleTheme}
      class="theme-toggle"
      title="切换主题"
    >
      {@html themeIcon()}
    </button>
  </footer>
</div>

<style>
  @media (max-width: 639px) {
    :global(body) {
      overflow-x: hidden;
    }
  }

  main :global(.virtual-list-container) {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  main :global(.virtual-list-container)::-webkit-scrollbar { display: none; }
</style>
