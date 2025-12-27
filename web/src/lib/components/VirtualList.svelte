<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  // Props
  interface Props<T> {
    /** 数据数组 */
    items: T[];
    /** 单个项目高度（不含间距） */
    itemHeight: number;
    /** 项目间距，默认 12 */
    gap?: number;
    /** 列数，默认 1 */
    columns?: number;
    /** 响应式列数断点配置，如 { 640: 2, 1024: 3 } 表示 >=640px 时 2 列，>=1024px 时 3 列 */
    columnBreakpoints?: Record<number, number>;
    /** 缓冲区项目数，默认 6 */
    bufferCount?: number;
    /** 滚动到底部回调 */
    onScrollEnd?: () => void;
    /** 触发滚动到底部的阈值，默认 200 */
    scrollThreshold?: number;
    /** 容器高度，默认 100% */
    height?: string;
    /** 容器类名 */
    class?: string;
    /** 获取项目唯一 key 的函数 */
    getKey: (item: T, index: number) => string | number;
    /** 渲染每个项目的 snippet */
    children: Snippet<[{ item: T; index: number }]>;
  }

  let {
    items,
    itemHeight,
    gap = 12,
    columns = 1,
    columnBreakpoints,
    bufferCount = 6,
    onScrollEnd,
    scrollThreshold = 200,
    height = '100%',
    class: className = '',
    getKey,
    children
  }: Props<T> = $props();

  // 内部状态
  let containerRef = $state<HTMLElement | null>(null);
  let scrollTop = $state(0);
  let containerHeight = $state(600);
  let actualColumns = $state(columns);

  // 计算行高（含间距）
  let rowHeight = $derived(itemHeight + gap);

  // 更新响应式列数
  function updateColumns() {
    if (typeof window === 'undefined') {
      actualColumns = columns;
      return;
    }

    if (!columnBreakpoints) {
      actualColumns = columns;
      return;
    }

    const width = window.innerWidth;
    const breakpoints = Object.keys(columnBreakpoints)
      .map(Number)
      .sort((a, b) => b - a); // 从大到小排序

    for (const bp of breakpoints) {
      if (width >= bp) {
        actualColumns = columnBreakpoints[bp];
        return;
      }
    }
    actualColumns = columns;
  }

  // 计算行数
  let rowCount = $derived(Math.ceil(items.length / actualColumns));

  // 计算总高度
  let totalHeight = $derived(rowCount * rowHeight);

  // 计算可见范围
  let visibleRange = $derived.by(() => {
    const startRow = Math.floor(scrollTop / rowHeight);
    const visibleRows = Math.ceil(containerHeight / rowHeight);

    const startIndex = Math.max(0, (startRow - bufferCount) * actualColumns);
    const endIndex = Math.min(items.length, (startRow + visibleRows + bufferCount) * actualColumns);

    return { startIndex, endIndex };
  });

  // 可见项目列表
  let visibleItems = $derived.by(() => {
    const result: { item: T; index: number; style: string }[] = [];
    const { startIndex, endIndex } = visibleRange;
    const colWidth = 100 / actualColumns;
    const gapX = gap / 2;

    for (let i = startIndex; i < endIndex; i++) {
      if (items[i]) {
        const row = Math.floor(i / actualColumns);
        const col = i % actualColumns;

        result.push({
          item: items[i],
          index: i,
          style: `
            position: absolute;
            top: ${row * rowHeight}px;
            left: ${col * colWidth}%;
            width: ${colWidth}%;
            height: ${rowHeight}px;
            padding: 0 ${gapX}px ${gap}px;
            box-sizing: border-box;
          `.replace(/\s+/g, ' ').trim()
        });
      }
    }
    return result;
  });

  // 处理滚动
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    scrollTop = target.scrollTop;

    // 检查是否需要加载更多
    if (onScrollEnd) {
      const { scrollHeight, clientHeight } = target;
      if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
        onScrollEnd();
      }
    }
  }

  // 容器 action
  function containerAction(node: HTMLElement) {
    containerRef = node;
    containerHeight = node.clientHeight;

    // 监听容器尺寸变化
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

  // 导出方法供外部调用
  export function scrollTo(offset: number) {
    if (containerRef) {
      containerRef.scrollTop = offset;
    }
  }

  export function scrollToIndex(index: number) {
    const row = Math.floor(index / actualColumns);
    scrollTo(row * rowHeight);
  }
</script>

<div
  class="virtual-list-container {className}"
  style="height: {height}; overflow-y: auto; position: relative;"
  use:containerAction
  onscroll={handleScroll}
>
  <div
    class="virtual-list-content"
    style="position: relative; height: {totalHeight}px; width: 100%;"
  >
    {#each visibleItems as { item, index, style } (getKey(item, index))}
      <div {style}>
        {@render children({ item, index })}
      </div>
    {/each}
  </div>
</div>


<style>
  .virtual-list-container {
    scrollbar-width: thin; /* Firefox */
    scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
  }
  
  .virtual-list-container::-webkit-scrollbar {
    width: 6px;
  }
  
  .virtual-list-container::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .virtual-list-container::-webkit-scrollbar-thumb {
    background-color: rgba(155, 155, 155, 0.5);
    border-radius: 3px;
    transition: background-color 0.2s;
  }
  
  .virtual-list-container::-webkit-scrollbar-thumb:hover {
    background-color: rgba(155, 155, 155, 0.7);
  }
</style>
