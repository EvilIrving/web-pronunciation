<script lang="ts">
  import { onMount } from 'svelte';
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
  let theme = $state<'terminal' | 'claude'>('terminal');

  function toggleTheme() {
    theme = theme === 'terminal' ? 'claude' : 'terminal';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  onMount(() => {
    const saved = localStorage.getItem('theme') as 'terminal' | 'claude' | null;
    if (saved) {
      theme = saved;
      document.documentElement.setAttribute('data-theme', saved);
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] transition-colors duration-var(--transition)">
  {@render children()}
</div>
