# UNIX 设计风格指南

> 基于 Terminal/UNIX 极简风格的设计规范

## 概述

UNIX 设计风格强调简洁、实用和一致性。源于终端界面的美学传统，注重功能性优先，减少不必要的视觉装饰。

## 核心原则

- **极简主义**: 去除多余装饰，保留核心视觉元素
- **一致性**: 统一的交互模式和视觉语言
- **功能性**: 视觉设计服务于功能，而非喧宾夺主
- **高效性**: 减少认知负担，快速识别和操作

## 颜色系统

### 主色调

| 角色 | 颜色值 | 用途 |
|------|--------|------|
| 背景色 | `#1a1a1a` | 主背景 |
| 次级背景 | `#222` | 卡片、输入框、表格 |
| 悬停背景 | `#262626` | 悬停状态 |
| 边框 | `#333` | 分隔线、边框 |
| 浅边框 | `#262626` | 内部边框 |

### 文字色

| 角色 | 颜色值 | 用途 |
|------|--------|------|
| 主要文字 | `#e0e0e0` | 正文、标题 |
| 次要文字 | `#b0b0b0` | 辅助说明 |
| 弱化文字 | `#555` | 占位符、禁用 |
| 暗淡文字 | `#666` | 次要弱化 |

### 强调色

| 角色 | 颜色值 | 用途 |
|------|--------|------|
| 主色 | `#6a9955` | 链接、重要操作 |
| 主色悬停 | `#8bc36a` | 悬停状态 |
| 主色激活 | `#b5cea8` | 按下状态 |

### 状态色

| 角色 | 颜色值 | 用途 |
|------|--------|------|
| 错误 | `#f14c4c` | 错误状态 |
| 警告 | `#cca700` | 警告状态 |
| 信息 | `#3794ff` | 信息提示 |

## 字体

```css
--font-mono: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
```

使用等宽字体族，优先使用系统等宽字体。

## 圆角

| 尺寸 | 值 | 用途 |
|------|-----|------|
| sm | `2px` | 小型元素 |
| md | `4px` | 按钮、输入框 |
| lg | `6px` | 卡片、模态框 |

## 阴影

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
```

使用柔和的阴影，模拟深度层次。

## 过渡

```css
--transition: 0.1s ease;
```

快速响应，100ms 的过渡动画。

## 组件样式

### 按钮

**Terminal 按钮**:

```css
.btn-terminal {
  background-color: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-accent);
}

.btn-terminal:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
  border-color: var(--color-accent);
  color: var(--color-accent-hover);
}
```

**Claude 按钮**:

```css
.btn-claude {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
}
```

### 输入框

```css
.input {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  outline: none;
}

.input:focus {
  border-color: var(--color-accent);
}
```

### 表格

```css
.table-terminal th,
.table-terminal td {
  border: 1px solid var(--color-border);
  padding: 0.5rem;
  text-align: left;
}

.table-terminal th {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
```

### 卡片

```css
.card-claude {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
```

## 交互状态

### 禁用状态

```css
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### 悬停状态

- 背景色变化：`var(--color-bg)` → `var(--color-bg-hover)`
- 边框颜色变化：`var(--color-border)` → `var(--color-accent)`
- 文字颜色变化：使用强调色系

### 聚焦状态

- 边框颜色变化：`var(--color-border)` → `var(--color-accent)`
- 避免使用过重的聚焦环

## 滚动条

```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}
```

## 文本选择

```css
::selection {
  background-color: var(--color-accent);
  color: white;
}
```

## 主题切换

通过 `data-theme` 属性切换主题：

```css
[data-theme="claude"] { /* Claude 主题 */ }
[data-theme="github"] { /* GitHub 主题 */ }
```

### Claude 主题特点

- 暖色调强调色：`#d97706`
- 浅色背景：`#f7f5f3`
- 圆角更大：`6px - 10px`
- 柔和阴影

### GitHub 主题特点

- 蓝色强调色：`#0969da`
- 白色背景：`#ffffff`
- 清晰的边框

## 设计 Checklist

- [ ] 使用语义化 CSS 变量
- [ ] 保持一致的圆角值
- [ ] 悬停状态使用 `var(--color-bg-hover)`
- [ ] 错误状态使用红色系
- [ ] 主要操作使用强调色
- [ ] 禁用状态降低透明度
- [ ] 避免过重的阴影
- [ ] 过渡动画不超过 150ms