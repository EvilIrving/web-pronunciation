<script lang="ts">
  import { onMount } from 'svelte';
  import type { Word } from '$lib/types';
  import VirtualList from '$lib/components/VirtualList.svelte';

  type Accent = 'us' | 'uk';

  let words = $state<Word[]>([]);
  let searchQuery = $state('');
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let hasMore = $state(true);
  let offset = $state(0);
  let total = $state(0);
  let audio = $state<HTMLAudioElement | null>(null);
  let playing = $state<{ id: string; accent: Accent } | null>(null);

  const LIMIT = 50;
  let debounce: ReturnType<typeof setTimeout>;

  // 响应式字体大小
  let isMobile = $state(false);
  let copied = $state(false);

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

  function play(word: Word, accent: Accent) {
    const url = accent === 'us' ? word.audio_url_us : word.audio_url_uk;
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

  onMount(() => { checkMobile(); load(true); window.addEventListener('resize', checkMobile); });
</script>

{#snippet ipa(word: Word, accent: Accent)}
  {@const isUs = accent === 'us'}
  {@const ipaText = isUs ? word.ipa_us : word.ipa_uk}
  {@const hasAudio = isUs ? word.audio_url_us : word.audio_url_uk}
  {@const active = isPlaying(word, accent)}
  {@const isAI = word.ipa_source === 'llm'}
  {#if ipaText}
    {#if hasAudio}
      <button 
        onclick={() => play(word, accent)} 
        class="bg-transparent border-none p-0 font-mono text-terminal-accent cursor-pointer hover:text-terminal-accent-hover {active ? 'text-terminal-accent-active' : ''}"
      >
        <sub class="text-[9px] text-terminal-text-muted">{isUs ? 'US' : 'UK'}</sub> /{ipaText}/{#if isAI}<sup class="text-[9px] text-terminal-text-muted ml-0.5">ai</sup>{/if}{active ? ' ▮▮' : ''}
      </button>
    {:else}
      <span class="text-terminal-disabled cursor-default"><sub class="text-[9px] text-terminal-text-muted">{isUs ? 'US' : 'UK'}</sub> /{ipaText}/{#if isAI}<sup class="text-[9px] text-terminal-text-muted ml-0.5">ai</sup>{/if}</span>
    {/if}
  {/if}
{/snippet}

<svelte:head>
    <title>技术词汇发音 | Tech Vocabulary Index</title>
    <meta name="description" content="程序员技术词汇发音索引。收录 coroutine、cache、daemon、enum 等常用技术词汇的 IPA 音标和标准发音。">
  </svelte:head>

<div class="min-h-screen bg-terminal-bg text-terminal-text-secondary font-mono text-sm leading-relaxed">
  <header class="sticky top-0 z-10 flex items-center gap-2 px-3 py-3 bg-terminal-bg-secondary border-b border-terminal-border safe-area-inset-top">
    <span class="text-terminal-accent shrink-0">$</span>
    <input 
      type="text" 
      placeholder="grep ... (搜索技术词汇如: coroutine, cache)" 
      value={searchQuery} 
      oninput={search}
      class="flex-1 min-w-0 bg-transparent border-none outline-none text-terminal-text-primary font-mono caret-terminal-accent placeholder:text-terminal-text-muted py-2"
    />
    {#if !isMobile}
      <span class="text-terminal-text-dim text-xs shrink-0">{total} entries</span>
    {/if}
  </header>

  <main class="bg-terminal-bg max-w-7xl mx-auto px-3 pb-safe h-[calc(100vh-var(--header-height,60px))] flex flex-col">
    {#if !isInitialized}
      <p class="text-terminal-text-muted py-4 text-center">loading...</p>
    {:else if !words.length}
      <p class="text-terminal-text-muted py-4 text-center">
        未找到"{searchQuery}"
        {#if searchQuery}
          <span class="block mt-2">如果希望收录此词，请 <button onclick={copyEmail} class="text-terminal-accent hover:text-terminal-accent-hover underline bg-transparent border-none p-0 cursor-pointer font-inherit">{copied ? '已复制 ✓' : '复制邮箱'}</button></span>
          <span class="block mt-1 text-xs text-terminal-text-dim">或 <a href="mailto:jescain2024@gmail.com?subject=建议收录词汇：{searchQuery}&body=请补充该词的发音信息" class="text-terminal-text-dim hover:text-terminal-text-secondary underline">点击发邮件给我</a></span>
        {/if}
      </p>
    {:else}
      <VirtualList
        items={words}
        itemHeight={isMobile ? 48 : 28}
        gap={0}
        columns={1}
        columnBreakpoints={{ 640: 2, 1024: 3 }}
        height="100%"
        class="flex-1 min-h-0"
        onScrollEnd={() => !isLoading && hasMore && load()}
        getKey={(w) => w.id}
      >
        {#snippet children({ item: word })}
          <div class="flex items-center gap-2 h-full px-2 border-b border-terminal-border-light hover:bg-terminal-bg-secondary touch-manipulation">
            <span class="text-terminal-text-primary min-w-[8ch] truncate font-medium">{word.word}</span>
            <div class="flex-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {@render ipa(word, 'us')}
              {@render ipa(word, 'uk')}
            </div>
          </div>
        {/snippet}
      </VirtualList>
      {#if isLoading}<p class="text-terminal-text-muted py-4 text-center text-sm">...</p>{/if}
      {#if !hasMore}<p class="text-terminal-text-muted py-4 text-center text-sm">-- EOF --</p>{/if}
    {/if}
  </main>
</div>

<style>
  /* 安全区域支持 */
  .safe-area-inset-top {
    padding-top: env(safe-area-inset-top, 20px);
  }
  
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 20px);
  }

  /* 移动端优化 */
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
