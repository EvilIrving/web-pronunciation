<script lang="ts">
  import { onMount } from 'svelte';
  import type { Word } from '$lib/types';
  import VirtualList from '$lib/components/VirtualList.svelte';

  // 状态
  let words = $state<Word[]>([]);
  let searchQuery = $state('');
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let hasMore = $state(true);
  let offset = $state(0);
  let total = $state(0);
  let currentAudio = $state<HTMLAudioElement | null>(null);
  let playingWordId = $state<string | null>(null);
  let playingUkWordId = $state<string | null>(null);

  const LIMIT = 100;
  let searchTimeout: ReturnType<typeof setTimeout>;

  // 加载词汇
  async function loadWords(reset = false) {
    if (isLoading || (!hasMore && !reset)) return;
    
    isLoading = true;
    const currentOffset = reset ? 0 : offset;
    
    try {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        offset: currentOffset.toString(),
      });
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/words?${params}`);
      const json = await res.json();

      if (json.error) {
        console.error('Load words error:', json.error);
        return;
      }

      if (reset) {
        words = json.data;
        offset = LIMIT;
      } else {
        words = [...words, ...json.data];
        offset = currentOffset + LIMIT;
      }
      
      total = json.total;
      hasMore = json.hasMore;
      isInitialized = true;
    } catch (e) {
      console.error('Load words error:', e);
    } finally {
      isLoading = false;
    }
  }

  // 搜索处理（防抖）
  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      hasMore = true;
      loadWords(true);
    }, 300);
  }

  // 播放美音
  function playAudio(word: Word) {
    if (!word.audio_url) return;

    // 停止当前播放的音频
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    // 停止英音播放
    if (playingUkWordId !== null) {
      playingUkWordId = null;
    }

    // 如果点击的是同一个正在播放的，则停止
    if (playingWordId === word.id) {
      playingWordId = null;
      return;
    }

    // 播放新音频
    const audio = new Audio(word.audio_url);
    currentAudio = audio;
    playingWordId = word.id;

    audio.play().catch(e => {
      console.error('Audio play error:', e);
      playingWordId = null;
    });

    audio.onended = () => {
      playingWordId = null;
      currentAudio = null;
    };
  }

  // 播放英音
  function playAudioUk(word: Word) {
    if (!word.audio_url_uk) return;

    // 停止当前播放的音频
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    // 停止美音播放
    if (playingWordId !== null) {
      playingWordId = null;
    }

    // 如果点击的是同一个正在播放的，则停止
    if (playingUkWordId === word.id) {
      playingUkWordId = null;
      return;
    }

    // 播放新音频
    const audio = new Audio(word.audio_url_uk);
    currentAudio = audio;
    playingUkWordId = word.id;

    audio.play().catch(e => {
      console.error('Audio play error:', e);
      playingUkWordId = null;
    });

    audio.onended = () => {
      playingUkWordId = null;
      currentAudio = null;
    };
  }

  // 加载更多处理
  function handleScrollEnd() {
    if (!isLoading && hasMore) {
      loadWords();
    }
  }

  // 初始加载
  onMount(() => {
    loadWords(true);
  });
</script>

<svelte:head>
  <title>发音词典</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
  <!-- 顶部搜索栏 -->
  <header class="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-slate-200 shadow-sm">
    <div class="max-w-4xl mx-auto px-4 py-4">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold text-slate-800 shrink-0">📖 发音词典</h1>
        <div class="relative flex-1">
          <input
            type="text"
            placeholder="搜索单词..."
            value={searchQuery}
            oninput={handleSearch}
            class="w-full px-4 py-2.5 pl-10 bg-slate-100 border border-slate-200 
                   rounded-xl text-slate-800 placeholder:text-slate-400
                   focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white
                   transition-all duration-200"
          />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      <!-- 统计信息 -->
      <div class="mt-2 text-sm text-slate-500">
        {#if searchQuery.trim()}
          找到 <span class="font-medium text-slate-700">{total}</span> 个结果
        {:else}
          共 <span class="font-medium text-slate-700">{total}</span> 个单词
        {/if}
      </div>
    </div>
  </header>

  <!-- 词汇列表 -->
  <main class="max-w-5xl mx-auto px-4 py-6 h-[calc(100vh-180px)]">
    {#if !isInitialized}
      <!-- 初始加载中 -->
      <div class="flex flex-col items-center justify-center py-20">
        <div class="flex items-center gap-2 text-slate-500">
          <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-lg">加载中...</span>
        </div>
      </div>
    {:else if words.length === 0}
      <div class="flex flex-col items-center justify-center py-20 text-slate-400">
        <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p class="text-lg">
          {#if searchQuery.trim()}
            没有找到匹配「{searchQuery}」的单词
          {:else}
            暂无词汇数据
          {/if}
        </p>
      </div>
    {:else}
      <!-- 虚拟列表 -->
      <VirtualList
        items={words}
        itemHeight={56}
        gap={10}
        columns={1}
        columnBreakpoints={{ 640: 2 }}
        height="100%"
        onScrollEnd={handleScrollEnd}
        getKey={(word) => word.id}
      >
        {#snippet children({ item: word })}
          <div class="w-full h-full flex items-center gap-3 p-3 bg-white/80 backdrop-blur-sm rounded-[14px]
                 shadow-[0_1px_3px_rgba(0,0,0,0.06)]
                 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-white
                 transition-all duration-200 ease-out">
            <!-- 单词 -->
            <span class="text-[16px] font-medium text-slate-800 shrink-0">
              {word.word}
            </span>

            <!-- 音标区域 -->
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <!-- 美音 -->
              {#if word.ipa}
                {#if word.audio_url}
                  <button
                    onclick={() => playAudio(word)}
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[13px]
                           text-blue-600 hover:text-blue-800 hover:bg-blue-50
                           transition-colors cursor-pointer
                           {playingWordId === word.id ? 'bg-blue-100 animate-pulse' : ''}"
                    title="点击播放美音"
                  >
                    <span class="text-[10px] text-blue-400 font-sans">US</span>
                    <span>/{word.ipa}/</span>
                    {#if playingWordId === word.id}
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    {/if}
                  </button>
                {:else}
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[13px] text-slate-400" title="无音频">
                    <span class="text-[10px] text-slate-300 font-sans">US</span>
                    <span>/{word.ipa}/</span>
                  </span>
                {/if}
              {/if}

              <!-- 英音 -->
              {#if word.ipa_uk}
                {#if word.audio_url_uk}
                  <button
                    onclick={() => playAudioUk(word)}
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[13px]
                           text-green-600 hover:text-green-800 hover:bg-green-50
                           transition-colors cursor-pointer
                           {playingUkWordId === word.id ? 'bg-green-100 animate-pulse' : ''}"
                    title="点击播放英音"
                  >
                    <span class="text-[10px] text-green-400 font-sans">UK</span>
                    <span>/{word.ipa_uk}/</span>
                    {#if playingUkWordId === word.id}
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    {/if}
                  </button>
                {:else}
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[13px] text-slate-400" title="无音频">
                    <span class="text-[10px] text-slate-300 font-sans">UK</span>
                    <span>/{word.ipa_uk}/</span>
                  </span>
                {/if}
              {/if}
            </div>
          </div>
        {/snippet}
      </VirtualList>

      <!-- 加载更多状态 -->
      {#if isLoading}
        <div class="flex justify-center py-8">
          <div class="flex items-center gap-2 text-slate-500">
            <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>加载中...</span>
          </div>
        </div>
      {:else if !hasMore && words.length > 0}
        <div class="text-center py-8 text-slate-400">
          — 已加载全部 {total} 个单词 —
        </div>
      {/if}
    {/if}
  </main>
</div>

<style>
  /* 无需额外样式，虚拟列表组件已包含滚动条样式 */
</style>
