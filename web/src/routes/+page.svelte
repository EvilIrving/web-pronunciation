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

{#snippet ipa(word: Word, accent: Accent)}
  {@const isUs = accent === 'us'}
  {@const ipaText = isUs ? word.ipa : word.ipa_uk}
  {@const hasAudio = isUs ? word.audio_url : word.audio_url_uk}
  {@const active = isPlaying(word, accent)}
  {#if ipaText}
    {#if hasAudio}
      <button onclick={() => play(word, accent)} class="ipa {active ? 'on' : ''}">
        [{isUs ? 'US' : 'UK'}] /{ipaText}/{active ? ' ▮▮' : ''}
      </button>
    {:else}
      <span class="ipa dim">[{isUs ? 'US' : 'UK'}] /{ipaText}/</span>
    {/if}
  {/if}
{/snippet}

<svelte:head><title>pron</title></svelte:head>

<div class="term">
  <header>
    <span class="prompt">$</span>
    <input type="text" placeholder="grep ..." value={searchQuery} oninput={search}/>
    <span class="count">{total} entries</span>
  </header>

  <main>
    {#if !isInitialized}
      <p class="msg">loading...</p>
    {:else if !words.length}
      <p class="msg">no match{searchQuery ? ` for "${searchQuery}"` : ''}</p>
    {:else}
      <VirtualList
        items={words}
        itemHeight={28}
        gap={0}
        columns={1}
        columnBreakpoints={{ 768: 2 }}
        height="100%"
        class="flex-1"
        onScrollEnd={() => !isLoading && hasMore && load()}
        getKey={(w) => w.id}
      >
        {#snippet children({ item: word })}
          <div class="row">
            <span class="w">{word.word}</span>
            {@render ipa(word, 'us')}
            {@render ipa(word, 'uk')}
          </div>
        {/snippet}
      </VirtualList>
      {#if isLoading}<p class="msg">...</p>{/if}
      {#if !hasMore}<p class="msg">-- EOF --</p>{/if}
    {/if}
  </main>
</div>

<style>
  :global(html, body) { background: #1a1a1a; }
  .term {
    min-height: 100vh;
    background: #1a1a1a;
    color: #b0b0b0;
    font: 13px/1.6 ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; gap: .5rem;
    padding: .5rem 1rem;
    background: #222; border-bottom: 1px solid #333;
  }
  .prompt { color: #6a9955; }
  header input {
    flex: 1; background: none; border: none; outline: none;
    color: #e0e0e0; font: inherit; caret-color: #6a9955;
  }
  header input::placeholder { color: #555; }
  .count { color: #666; font-size: 12px; }

  main {
    background: #1a1a1a;
    max-width: 80rem; margin: auto; padding: .5rem 1rem;
    height: calc(100vh - 42px);
    display: flex; flex-direction: column;
  }
  main :global(.flex-1) { flex: 1; min-height: 0; }
    main :global(.virtual-list-container) {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    main :global(.virtual-list-container)::-webkit-scrollbar { display: none; }

  .msg { color: #555; padding: 1rem 0; text-align: center; }

  .row {
    display: flex; align-items: baseline; gap: 1rem; height: 100%;
    padding: .25rem 0; border-bottom: 1px solid #262626;
  }
  .row:hover { background: #222; }
  .w { color: #e0e0e0; min-width: 10ch; }

  .ipa {
    background: none; border: none; padding: 0; font: inherit;
    color: #6a9955; cursor: pointer;
  }
  .ipa:hover { color: #8bc36a; }
  .ipa.on { color: #b5cea8; }
  .ipa.dim { color: #444; cursor: default; }
</style>
