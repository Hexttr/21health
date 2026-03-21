import React from 'react';
import ReactMarkdown from 'react-markdown';

type AIResponseContentProps = {
  content: string;
};

function looksLikeHeading(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  const normalized = trimmed.replace(/:$/, '');
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!trimmed || normalized.length > 48) return false;
  if (words.length < 1 || words.length > 7) return false;
  if (/^#{1,6}\s/.test(trimmed)) return false;
  if (/^[-*•]\s/.test(trimmed)) return false;
  if (/^\d+\.\s/.test(trimmed)) return false;
  if (/[.!?;]$/.test(trimmed)) return false;
  if (!/^[A-ZА-ЯЁ0-9]/.test(normalized)) return false;
  if (/[|]{2,}/.test(normalized)) return false;
  if (!nextLine || !nextLine.trim()) return false;
  return words.some((word) => word.length > 3);
}

function splitCompressedPipeRows(line: string): string[] {
  const normalized = line
    .replace(/\|\|(?=\s*(?:#|[-:]{2,}|\d+)\s*\|)/g, '|\n|')
    .replace(/\|\s+\|(?=\s*(?:#|[-:]{2,}|\d+)\s*\|)/g, '|\n|');

  return normalized
    .split(/\n/)
    .flatMap((part) => {
      const trimmed = part.trim();
      if (!trimmed) return [];

      const firstTableRowIndex = trimmed.search(/\|\s*(?:#|[-:]{2,}|[A-Za-zА-Яа-яЁё][^|\n]{0,32}|\d+)\s*\|/);
      if (firstTableRowIndex <= 0) {
        return [trimmed];
      }

      const prefix = trimmed.slice(0, firstTableRowIndex).trim();
      const tablePart = trimmed.slice(firstTableRowIndex).trim();
      return [prefix, tablePart].filter(Boolean);
    })
    .flatMap((part) => part.split(/(?=\|\s*(?:#|[-:]{2,}|\d+)\s*\|)/g))
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitPipeCells(row: string): string[] {
  return row
    .split('|')
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function isPipeDividerRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function formatStructuredPipeRow(cells: string[], previousWasList = false): string[] {
  if (cells.length === 0 || isPipeDividerRow(cells)) return [];

  const firstCell = cells[0];
  if (/^#$/i.test(firstCell)) {
    return previousWasList ? [''] : [];
  }

  if (/^\d+$/.test(firstCell)) {
    const [, title, ...details] = cells;
    if (!title) return [];

    const formatted = [`${firstCell}. **${title}**`];
    if (details.length > 0) {
      formatted.push(`   ${details.join(' · ')}`);
    }
    return formatted;
  }

  if (cells.length >= 2) {
    const [title, ...details] = cells;
    const formatted = [`- **${title}**`];
    if (details.length > 0) {
      formatted.push(`  ${details.join(' · ')}`);
    }
    return formatted;
  }

  return [cells.join(' ')];
}

function normalizeStructuredTables(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  let previousWasPipeList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const pipeCount = (trimmed.match(/\|/g) || []).length;

    if (pipeCount >= 4) {
      const expandedRows = splitCompressedPipeRows(trimmed);
      let producedAnyStructuredRow = false;

      for (const row of expandedRows) {
        const cells = splitPipeCells(row);
        const formattedRows = formatStructuredPipeRow(cells, previousWasPipeList || producedAnyStructuredRow);

        if (formattedRows.length > 0) {
          output.push(...formattedRows);
          producedAnyStructuredRow = true;
        } else if (!isPipeDividerRow(cells) && row) {
          output.push(row);
        }
      }

      if (producedAnyStructuredRow) {
        output.push('');
        previousWasPipeList = true;
      }
      continue;
    }

    output.push(trimmed ? line : '');
    previousWasPipeList = false;
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n');
}

function preprocessAIContent(raw: string): string {
  const normalized = normalizeStructuredTables(raw).trim();
  if (!normalized) return normalized;

  const hasExplicitMarkdown = /(^|\n)(#{1,6}\s|[-*]\s|\d+\.\s|>\s|```|\|.+\|)/m.test(normalized);
  if (hasExplicitMarkdown) {
    return normalized;
  }

  const lines = normalized.split('\n').map((line) => line.trimEnd());
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const nextLine = lines[index + 1];

    if (!line) {
      if (output[output.length - 1] !== '') {
        output.push('');
      }
      continue;
    }

    if (looksLikeHeading(line, nextLine)) {
      if (output[output.length - 1] !== '') output.push('');
      output.push(`### ${line}`);
      output.push('');
      continue;
    }

    const bulletMatch = line.match(/^[•*-]\s+(.+)/);
    if (bulletMatch) {
      output.push(`- ${bulletMatch[1]}`);
      continue;
    }

    const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numberedMatch) {
      output.push(`${numberedMatch[1]}. ${numberedMatch[2]}`);
      continue;
    }

    if (/^[-_*=]{3,}$/.test(line)) {
      output.push('---');
      continue;
    }

    output.push(line);
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function AIResponseContent({ content }: AIResponseContentProps) {
  const prepared = preprocessAIContent(content);

  return (
    <div className="ai-prose prose max-w-none text-[13.5px] leading-[1.75] text-foreground/90 md:text-[14.5px] md:leading-[1.8]">
      <ReactMarkdown
        components={{
          h1: ({ node: _node, ...props }) => <h1 {...props} className="mt-8 mb-3 text-[1.55rem] font-semibold tracking-[-0.02em] text-foreground md:text-[1.75rem]" />,
          h2: ({ node: _node, ...props }) => <h2 {...props} className="mt-7 mb-3 text-[1.28rem] font-semibold tracking-[-0.018em] text-foreground md:text-[1.45rem]" />,
          h3: ({ node: _node, ...props }) => <h3 {...props} className="mt-6 mb-2.5 text-[1.08rem] font-semibold tracking-[-0.015em] text-foreground md:text-[1.16rem]" />,
          h4: ({ node: _node, ...props }) => <h4 {...props} className="mt-5 mb-2 text-[0.98rem] font-semibold text-foreground md:text-[1.02rem]" />,
          p: ({ node: _node, ...props }) => <p {...props} className="my-3 text-[13.5px] leading-[1.75] text-foreground/90 md:my-3.5 md:text-[14.5px] md:leading-[1.8]" />,
          ul: ({ node: _node, ...props }) => <ul {...props} className="my-3.5 list-disc space-y-1.5 pl-5 marker:text-muted-foreground md:my-4" />,
          ol: ({ node: _node, ...props }) => <ol {...props} className="my-3.5 list-decimal space-y-1.5 pl-5 marker:text-muted-foreground md:my-4" />,
          li: ({ node: _node, ...props }) => <li {...props} className="pl-1 text-[13.5px] leading-[1.72] text-foreground/90 md:text-[14.5px]" />,
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80" />,
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              {...props}
              className="my-4 border-l-2 border-border/80 pl-4 text-foreground/80 italic md:my-5 md:pl-5"
            />
          ),
          code: ({ node: _node, inline, className, children, ...props }) => (
            inline ? (
              <code
                {...props}
                className={`rounded-md border border-border/50 bg-secondary/45 px-1.5 py-0.5 font-mono text-[0.92em] text-foreground ${className || ''}`.trim()}
              >
                {children}
              </code>
            ) : (
              <code {...props} className={className}>
                {children}
              </code>
            )
          ),
          pre: ({ node: _node, ...props }) => (
            <pre
              {...props}
              className="my-5 overflow-x-auto rounded-2xl border border-border/60 bg-secondary/35 px-4 py-3.5 text-[12.5px] leading-6 text-foreground md:px-5 md:py-4 md:text-[13px]"
            />
          ),
          table: ({ node: _node, ...props }) => (
            <div className="my-5 overflow-x-auto rounded-2xl border border-border/60 bg-background/80">
              <table {...props} className="min-w-full border-collapse text-[13px] leading-6 md:text-[13.5px]" />
            </div>
          ),
          hr: ({ node: _node, ...props }) => <hr {...props} className="my-6 border-0 border-t border-border/60 md:my-7" />,
          th: ({ node: _node, ...props }) => <th {...props} className="border-b border-border/50 bg-secondary/30 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" />,
          td: ({ node: _node, ...props }) => <td {...props} className="border-b border-border/30 px-4 py-2.5 align-top text-foreground/90" />,
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
