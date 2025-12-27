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

  onMount(() => load(true));
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
        [{isUs ? 'US' : 'UK'}] /{ipaText}/{#if isAI}<sup class="text-[9px] text-terminal-text-muted ml-0.5">ai</sup>{/if}{active ? ' ▮▮' : ''}
      </button>
    {:else}
      <span class="text-terminal-disabled cursor-default">[{isUs ? 'US' : 'UK'}] /{ipaText}/{#if isAI}<sup class="text-[9px] text-terminal-text-muted ml-0.5">ai</sup>{/if}</span>
    {/if}
  {/if}
{/snippet}

<svelte:head><title>pron</title></svelte:head>

<div class="min-h-screen bg-terminal-bg text-terminal-text-secondary font-mono text-[13px] leading-relaxed">
  <header class="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-terminal-bg-secondary border-b border-terminal-border">
    <span class="text-terminal-accent">$</span>
    <input 
      type="text" 
      placeholder="grep ..." 
      value={searchQuery} 
      oninput={search}
      class="flex-1 bg-transparent border-none outline-none text-terminal-text-primary font-mono caret-terminal-accent placeholder:text-terminal-text-muted"
    />
    <span class="text-terminal-text-dim text-xs">{total} entries</span>
  </header>

  <main class="bg-terminal-bg max-w-7xl mx-auto px-4 py-2 h-[calc(100vh-42px)] flex flex-col">
    {#if !isInitialized}
      <p class="text-terminal-text-muted py-4 text-center">loading...</p>
    {:else if !words.length}
      <p class="text-terminal-text-muted py-4 text-center">no match{searchQuery ? ` for "${searchQuery}"` : ''}</p>
    {:else}
      <VirtualList
        items={words}
        itemHeight={28}
        gap={0}
        columns={1}
        columnBreakpoints={{ 768: 2 }}
        height="100%"
        class="flex-1 min-h-0"
        onScrollEnd={() => !isLoading && hasMore && load()}
        getKey={(w) => w.id}
      >
        {#snippet children({ item: word })}
          <div class="flex items-baseline gap-4 h-full py-1 border-b border-terminal-border-light hover:bg-terminal-bg-secondary">
            <span class="text-terminal-text-primary min-w-[10ch]">{word.word}</span>
            {@render ipa(word, 'us')}
            {@render ipa(word, 'uk')}
          </div>
        {/snippet}
      </VirtualList>
      {#if isLoading}<p class="text-terminal-text-muted py-4 text-center">...</p>{/if}
      {#if !hasMore}<p class="text-terminal-text-muted py-4 text-center">-- EOF --</p>{/if}
    {/if}
  </main>
</div>

<style>
  main :global(.virtual-list-container) {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  main :global(.virtual-list-container)::-webkit-scrollbar { display: none; }
</style>
