---
name: figma-to-react
description: Converts a Figma frame or component into pixel-perfect React/TSX files that match the project's codebase. Use when given a Figma URL, node ID, or design screenshot to implement as a React screen or component. Triggers on "implement this Figma screen", "convert design to React", "build this UI", "pixel-perfect component", or any time a Figma URL or node reference appears alongside a coding task.
argument-hint: <figma-url-or-node-id> [output-path]
disable-model-invocation: true
---

# Figma → React

## Overview

This skill provides a structured workflow for implementing a Figma design as pixel-perfect React/TSX files. It produces two files per component: a `ComponentName.tsx` and a `styles.ts` using `styled-components` with the project's `S` namespace convention.

## Skill Boundaries

- Use this skill when implementing any screen or component from a Figma design
- Always read existing project files before writing — reuse components and tokens, never recreate them
- If the Figma URL or node ID is missing, stop and ask before proceeding

## Prerequisites

- Figma URL or node ID for the target frame/component
- Access to the project source (`src/`) to audit existing components and tokens
- Figma MCP configured (`mcp__figma__get_figma_data`, `mcp__figma__download_figma_images`)

## Required Workflow

**Follow these steps in order. Do not skip steps.**

### Step 1: Extract the Figma design

Call the Figma MCP tools in sequence:

```
mcp__figma__get_figma_data(url="$0")
mcp__figma__download_figma_images(url="$0")
```

Record **exactly** from the response:
- Frame dimensions, layout mode (`NONE` = absolute positioning, `HORIZONTAL`/`VERTICAL` = auto-layout)
- Every layer: name, type, fills (hex/rgba), strokes, effects (box-shadow), border-radius
- Text layers: characters, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textAlign
- Auto-layout frames: paddingTop/Right/Bottom/Left, itemSpacing, primaryAxisAlignItems, counterAxisAlignItems
- Component/Instance layer names — these are candidates for reuse from `src/components/`

### Step 2: Audit the codebase

Before writing any code, read the project. Run:

```bash
# Existing styles.ts files — study the convention in use
find src -name "styles.ts" | head -6 | xargs head -50 2>/dev/null

# Existing components — find reusable candidates
find src/components -name "index.tsx" | head -8 | xargs head -30 2>/dev/null

# Design tokens / CSS variables / theme
find src -name "theme*.ts" -o -name "tokens*.ts" -o -name "colors.ts" -o -name "palette.ts" \
  | grep -v node_modules | head -5 | xargs cat 2>/dev/null

# Import alias
cat tsconfig.json 2>/dev/null \
  | python3 -c "import sys,json; c=json.load(sys.stdin); print(c.get('compilerOptions',{}).get('paths',{}))"
```

Extract from the output:
1. **Reusable components** — anything in `src/components/` that matches a Figma layer. Import and reuse; never recreate.
2. **Token/variable names** — map every Figma fill color and spacing value to an existing CSS variable or theme token. Never use raw hex values.
3. **`styles.ts` pattern** — the existing files define the exact convention to follow (see Style rules below).
4. **Import alias** — use `src/`, `@/`, or `~/` prefix as found in tsconfig.

### Step 3: Map Figma layers to code

Before writing any JSX, create a mental mapping:

| Figma layer type | Code equivalent |
|---|---|
| Frame with auto-layout (HORIZONTAL) | `styled.div` with `display: flex; flex-direction: row` |
| Frame with auto-layout (VERTICAL) | `styled.div` with `display: flex; flex-direction: column` |
| Frame without auto-layout | `styled.div` with `position: relative` |
| Text | `<Typography.Text>`, `<Typography.Title>`, or `styled.span` |
| Instance of a component | Import and reuse the existing project component |
| Rectangle / shape | `styled.div` with background, border-radius, etc. |
| Icon (vector) | Match to `@ant-design/icons` by shape |
| Image | `styled.img` or antd `<Avatar>` / `<Image>` |

### Step 4: Write `styles.ts`

Create `styles.ts` next to the component. All styled-components live here, exported as properties of a single `S` object.

**Convention — always follow exactly:**

```ts
import styled from 'styled-components';

// Import existing project components to extend them
import { ExistingComponent } from 'src/components/ExistingComponent';

export const S = {
  // Extend an existing project component
  ExistingComponent: styled(ExistingComponent)`
    position: absolute;
    left: 50%;
  `,

  // Extend an antd component
  Card: styled(Card)`
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  `,

  // Plain HTML element
  Wrapper: styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
  `,

  // Dynamic styles — use transient props ($prefix) to avoid forwarding to DOM
  Row: styled.div<{ $isActive?: boolean }>`
    background: ${({ $isActive }) =>
      $isActive ? 'var(--color-primary-light)' : 'transparent'};
  `,
};
```

**Rules:**
- Single `S` export object — every styled component is a property of `S`
- Prefer `styled(ExistingComponent)` over rewriting the component's styles from scratch
- Use CSS variables from project tokens for all colors, spacing, radii — never raw hex
- Transient props use `$` prefix to prevent forwarding non-HTML attributes to the DOM
- Never use `.module.scss`, `classNames`, or inline `style={}`

### Step 5: Write the TSX component

```tsx
import { Trans } from '@lingui/react';
import { useLingui } from '@lingui/react';
import { Button, Typography } from 'antd';
import { SomeIcon } from '@ant-design/icons';
import React from 'react';

import { S } from './styles';

const { Text, Title } = Typography;

interface ComponentNameProps {
  // explicit types — no `any`
}

export function ComponentName({ ... }: ComponentNameProps) {
  const { t } = useLingui();

  return (
    <S.Wrapper>
      {/* JSX matching Figma layout exactly */}
    </S.Wrapper>
  );
}
```

**Rules:**
- Every user-visible string wrapped in `<Trans>` or `` t`...` `` from `@lingui/react`
- Use `antd` 5.x as primary UI library — `theme.useToken()`, `Space.Compact`, `Flex`, `App`
- Use `@ant-design/icons` for every icon — identify by shape from the Figma layer name
- Use `react-hook-form` + `@hookform/resolvers/yup` for all forms
- Use `date-fns` v2 for dates — never `moment`
- Use `react-router-dom` v6 — `useNavigate`, `useParams`, `<Link>`
- TypeScript strict types on all props — no `any`
- Keep files ≤ 200 lines; extract sub-components when needed

### Step 6: Pixel-perfect checklist

Verify every point against the Figma MCP data before saving:

- [ ] Font size, weight, line-height match every text layer
- [ ] All colors reference CSS vars / antd tokens — zero raw hex values
- [ ] Padding, gap, margin match auto-layout values exactly
- [ ] Border-radius and box-shadow match layer effects
- [ ] Icon identity correct from `@ant-design/icons`
- [ ] Button variant correct (`primary` / `default` / `text` / `link` / `danger` / `ghost`)
- [ ] Flex direction and alignment match Figma layout mode
- [ ] Every Figma Instance layer mapped to an existing `src/components/` component
- [ ] Interactive states handled if shown in design (hover, disabled, loading, error)
- [ ] Every user-visible string wrapped in `<Trans>` or `` t`...` ``
- [ ] All styled components in `styles.ts` under `S` — none inline in TSX

### Step 7: Save files

Write to the path in `$1`. If `$1` is empty, ask the user for the target directory.

Output:
1. `ComponentName.tsx` — complete, runnable, zero `// TODO`
2. `styles.ts` — all styled-components under `S`, following the project convention
3. A short **decision log** in the chat: one line per trade-off made
   (e.g., `Extended existing <Card> from src/components — reuses project shadow token`)

## Common Pitfalls

1. **Recreating existing components**: Always scan `src/` first. If a `<Spinner>`, `<Avatar>`, or `<Modal>` already exists in the project, extend it with `styled(ExistingComponent)` rather than rebuilding it.

2. **Hardcoded colors**: Every color in Figma must map to a CSS variable or antd token. If no matching token exists, ask the user rather than hardcoding.

3. **Skipping i18n**: Every visible string — button labels, placeholders, headings, empty states — must be wrapped. No exceptions.

4. **Inline styles in TSX**: All styles belong in `styles.ts`. Using `style={{ marginTop: 8 }}` in JSX breaks the convention.

5. **Forgetting transient props**: A prop like `isActive` passed to a `styled.div` will trigger a React DOM warning. Always prefix dynamic props with `$` (`$isActive`).

6. **Wrong icon library**: Only `@ant-design/icons`. Never heroicons, lucide, react-icons, or others not in `package.json`.

7. **Auto-layout direction**: Figma `HORIZONTAL` = `flex-direction: row`, `VERTICAL` = `flex-direction: column`. `itemSpacing` = `gap`. Don't confuse them.

8. **Absolute vs auto-layout frames**: A Figma frame with layout mode `NONE` uses absolute positioning. Use `position: absolute` with `top`/`left`/`right`/`bottom` values from the layer, not flexbox.
