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

  const LIMIT = 100;
  let debounce: ReturnType<typeof setTimeout>;

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
    const url = accent === 'us' ? word.audio_url : word.audio_url_uk;
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

  onMount(() => load(true));
</script>

{#snippet spinner(size = 5)}
  <svg class="animate-spin w-{size} h-{size}" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
{/snippet}

{#snippet ipa(word: Word, accent: Accent)}
  {@const isUs = accent === 'us'}
  {@const ipaText = isUs ? word.ipa : word.ipa_uk}
  {@const hasAudio = isUs ? word.audio_url : word.audio_url_uk}
  {@const active = isPlaying(word, accent)}
  {@const color = isUs ? 'blue' : 'green'}

  {#if ipaText}
    {#if hasAudio}
      <button
        onclick={() => play(word, accent)}
        class="ipa-btn {color} {active ? 'active' : ''}"
        title="播放{isUs ? '美' : '英'}音"
      >
        <span class="label">{isUs ? 'US' : 'UK'}</span>
        <span>/{ipaText}/</span>
        {#if active}
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        {/if}
      </button>
    {:else}
      <span class="ipa-btn muted">
        <span class="label">{isUs ? 'US' : 'UK'}</span>
        <span>/{ipaText}/</span>
      </span>
    {/if}
  {/if}
{/snippet}

<svelte:head>
  <title>发音词典</title>
</svelte:head>

<div class="page">
  <header>
    <div class="header-inner">
      <h1>📖 发音词典</h1>
      <div class="search-box">
        <input type="text" placeholder="搜索单词..." value={searchQuery} oninput={search}/>
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>
    </div>
    <p class="stats">
      {searchQuery.trim() ? '找到' : '共'} <b>{total}</b> {searchQuery.trim() ? '个结果' : '个单词'}
    </p>
  </header>

  <main>
    {#if !isInitialized}
      <div class="center"><div class="flex gap-2 text-slate-500">{@render spinner(8)}<span>加载中...</span></div></div>
    {:else if !words.length}
      <div class="center empty">
        <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <p>{searchQuery.trim() ? `没有找到「${searchQuery}」` : '暂无词汇'}</p>
      </div>
    {:else}
      <VirtualList
        items={words}
        itemHeight={56}
        gap={10}
        columns={1}
        columnBreakpoints={{ 640: 2 }}
        height="100%"
        onScrollEnd={() => !isLoading && hasMore && load()}
        getKey={(w) => w.id}
      >
        {#snippet children({ item: word })}
          <div class="word-card">
            <span class="word">{word.word}</span>
            <div class="ipa-group">
              {@render ipa(word, 'us')}
              {@render ipa(word, 'uk')}
            </div>
          </div>
        {/snippet}
      </VirtualList>

      {#if isLoading}
        <div class="load-more">{@render spinner()}<span>加载中...</span></div>
      {:else if !hasMore}
        <p class="end-mark">— 全部 {total} 个 —</p>
      {/if}
    {/if}
  </main>
</div>

<style>
  .page { min-height: 100vh; background: linear-gradient(135deg, #f8fafc, #f1f5f9); }

  header {
    position: sticky; top: 0; z-index: 10;
    backdrop-filter: blur(12px); background: rgba(255,255,255,.8);
    border-bottom: 1px solid #e2e8f0; padding: 1rem;
  }
  .header-inner { max-width: 56rem; margin: auto; display: flex; align-items: center; gap: 1rem; }
  h1 { font-size: 1.25rem; font-weight: 700; color: #1e293b; white-space: nowrap; }
  .search-box { position: relative; flex: 1; }
  .search-box input {
    width: 100%; padding: .625rem 1rem .625rem 2.5rem;
    background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: .75rem;
    font-size: .875rem; color: #1e293b; outline: none; transition: .2s;
  }
  .search-box input:focus { background: #fff; box-shadow: 0 0 0 2px rgba(59,130,246,.3); }
  .search-box .icon { position: absolute; left: .75rem; top: 50%; transform: translateY(-50%); width: 1.25rem; height: 1.25rem; color: #94a3b8; }
  .stats { max-width: 56rem; margin: .5rem auto 0; font-size: .875rem; color: #64748b; }
  .stats b { color: #334155; }

  main { max-width: 64rem; margin: auto; padding: 1.5rem 1rem; height: calc(100vh - 140px); }

  .center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; }
  .empty { color: #94a3b8; gap: 1rem; }

  .word-card {
    display: flex; align-items: center; gap: .75rem; height: 100%; padding: .75rem;
    background: rgba(255,255,255,.8); border-radius: .875rem;
    box-shadow: 0 1px 3px rgba(0,0,0,.06); transition: .2s;
  }
  .word-card:hover { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .word { font-size: 1rem; font-weight: 500; color: #1e293b; flex-shrink: 0; }
  .ipa-group { display: flex; align-items: center; gap: .75rem; flex: 1; min-width: 0; }

  .ipa-btn {
    display: inline-flex; align-items: center; gap: .25rem;
    padding: .125rem .375rem; border-radius: .375rem;
    font-family: ui-monospace, monospace; font-size: .8125rem;
    transition: .15s; cursor: pointer; border: none; background: none;
  }
  .ipa-btn .label { font-size: .5rem; font-family: system-ui; }
  .ipa-btn.blue { color: #2563eb; }
  .ipa-btn.blue .label { color: #60a5fa; }
  .ipa-btn.blue:hover { background: #eff6ff; color: #1d4ed8; }
  .ipa-btn.blue.active { background: #dbeafe; animation: pulse 1s infinite; }
  .ipa-btn.green { color: #16a34a; }
  .ipa-btn.green .label { color: #4ade80; }
  .ipa-btn.green:hover { background: #f0fdf4; color: #15803d; }
  .ipa-btn.green.active { background: #dcfce7; animation: pulse 1s infinite; }
  .ipa-btn.muted { color: #94a3b8; cursor: default; }
  .ipa-btn.muted .label { color: #cbd5e1; }

  .load-more { display: flex; justify-content: center; align-items: center; gap: .5rem; padding: 2rem 0; color: #64748b; }
  .end-mark { text-align: center; padding: 2rem 0; color: #94a3b8; }

  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .6; } }
</style>
