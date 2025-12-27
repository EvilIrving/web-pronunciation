<script lang="ts">
  import { onMount } from 'svelte';
  import type { Word } from '$lib/types';

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

  // 虚拟列表状态
  const ITEM_HEIGHT = 80; // 单个项目高度（含 gap 12px）
  const ITEM_CONTENT_HEIGHT = 68; // 实际内容高度
  const BUFFER_COUNT = 6;
  let containerRef = $state<HTMLElement | null>(null);
  let scrollTop = $state(0);
  let containerHeight = $state(600);

  const LIMIT = 20;
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

  // 播放音频
  function playAudio(word: Word) {
    if (!word.audio_url) return;

    // 停止当前播放的音频
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
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

  // 计算列数
  let columns = $state(2);
  
  function updateColumns() {
    if (typeof window !== 'undefined') {
      columns = window.innerWidth >= 640 ? 2 : 1;
    }
  }

  // 计算行数
  let rowCount = $derived(Math.ceil(words.length / columns));
  
  // 计算总高度
  let totalHeight = $derived(rowCount * ITEM_HEIGHT);
  
  // 计算可见范围
  let visibleRange = $derived.by(() => {
    const startRow = Math.floor(scrollTop / ITEM_HEIGHT);
    const visibleRows = Math.ceil(containerHeight / ITEM_HEIGHT);
    
    const startIndex = Math.max(0, (startRow - BUFFER_COUNT) * columns);
    const endIndex = Math.min(words.length, (startRow + visibleRows + BUFFER_COUNT) * columns);
    
    return { startIndex, endIndex };
  });
  
  // 可见项目列表
  let visibleItems = $derived.by(() => {
    const items: { word: Word; index: number; top: number; left: string }[] = [];
    const { startIndex, endIndex } = visibleRange;
    
    for (let i = startIndex; i < endIndex; i++) {
      if (words[i]) {
        const row = Math.floor(i / columns);
        const col = i % columns;
        items.push({
          word: words[i],
          index: i,
          top: row * ITEM_HEIGHT,
          left: columns === 1 ? '0' : col === 0 ? '0' : '50%'
        });
      }
    }
    return items;
  });

  // 处理滚动
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    scrollTop = target.scrollTop;
    
    // 检查是否需要加载更多
    const { scrollHeight, clientHeight } = target;
    if (scrollHeight - scrollTop - clientHeight < 200 && !isLoading && hasMore) {
      loadWords();
    }
  }

  // 容器 action
  function containerAction(node: HTMLElement) {
    containerRef = node;
    containerHeight = node.clientHeight;
    
    // 使用 IntersectionObserver 检测容器尺寸变化
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight = entry.contentRect.height;
      }
    });
    resizeObserver.observe(node);
    
    // 监听窗口 resize 更新列数
    const resizeHandler = () => {
      updateColumns();
    };
    window.addEventListener('resize', resizeHandler);
    updateColumns();

    return {
      destroy() {
        resizeObserver.disconnect();
        window.removeEventListener('resize', resizeHandler);
      }
    };
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
  <main 
    class="max-w-4xl mx-auto px-4 py-6 h-[calc(100vh-120px)] overflow-y-auto"
    use:containerAction
    onscroll={handleScroll}
  >
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
      <!-- 虚拟列表容器 -->
      <div 
        class="relative"
        style="height: {totalHeight}px;"
      >
        {#each visibleItems as { word, index, top, left } (word.id)}
          <div
            class="absolute"
            style="top: {top}px; left: {left}; width: {columns === 1 ? '100%' : '50%'}; height: {ITEM_HEIGHT}px; padding: 0 6px 12px;"
          >
            <button
              onclick={() => playAudio(word)}
              disabled={!word.audio_url}
              class="w-full h-full group relative flex items-center gap-4 p-4 bg-white rounded-2xl 
                     border border-slate-200 shadow-sm
                     hover:shadow-md hover:border-blue-300 hover:bg-blue-50/30
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200 text-left"
            >
              <!-- 播放图标 -->
              <div class="shrink-0 w-12 h-12 flex items-center justify-center rounded-xl
                          {word.audio_url ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white cursor-pointer' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
                          transition-transform duration-200 group-hover:scale-105">
                {#if playingWordId === word.id}
                  <!-- 播放中动画 -->
                  <div class="flex items-end gap-0.5 h-5">
                    <span class="w-1 bg-white rounded-full animate-bounce" style="height: 40%; animation-delay: 0ms;"></span>
                    <span class="w-1 bg-white rounded-full animate-bounce" style="height: 70%; animation-delay: 150ms;"></span>
                    <span class="w-1 bg-white rounded-full animate-bounce" style="height: 50%; animation-delay: 300ms;"></span>
                    <span class="w-1 bg-white rounded-full animate-bounce" style="height: 80%; animation-delay: 450ms;"></span>
                  </div>
                {:else if word.audio_url}
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                {:else}
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                {/if}
              </div>

              <!-- 单词信息 -->
              <div class="flex-1 min-w-0 flex items-baseline gap-2">
                <span class="text-lg font-semibold text-slate-800">
                  {word.word}
                </span>
                {#if word.ipa}
                  <span class="text-sm text-slate-400 font-mono truncate">
                    /{word.ipa}/
                  </span>
                {/if}
              </div>
            </button>
          </div>
        {/each}
      </div>

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
  /* 自定义滚动条 */
  main::-webkit-scrollbar {
    width: 8px;
  }
  main::-webkit-scrollbar-track {
    background: transparent;
  }
  main::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  main::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>
