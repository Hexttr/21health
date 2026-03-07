import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function normalizeStructuredTables(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const pipeCount = (trimmed.match(/\|/g) || []).length;

    if (pipeCount >= 4) {
      output.push(...splitCompressedPipeRows(trimmed));
      continue;
    }

    output.push(trimmed ? line : '');
  }

  return output.join('\n');
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
    <div className="prose max-w-none text-[15px] leading-[1.9] text-foreground/95 prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-strong:font-semibold prose-strong:text-foreground prose-headings:mt-8 prose-headings:mb-4 prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-[-0.02em] prose-h1:text-[2rem] prose-h2:text-[1.65rem] prose-h3:text-[1.28rem] prose-h4:text-[1.08rem] prose-hr:my-7 prose-hr:border-border/60 prose-code:rounded-md prose-code:bg-secondary/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-pre:my-5 prose-pre:rounded-3xl prose-pre:border prose-pre:border-border/50 prose-pre:bg-secondary/55 prose-pre:px-5 prose-pre:py-4 prose-pre:text-[13px] prose-blockquote:my-5 prose-blockquote:rounded-r-2xl prose-blockquote:border-l-2 prose-blockquote:border-primary/25 prose-blockquote:bg-primary/5 prose-blockquote:px-5 prose-blockquote:py-3 prose-blockquote:text-foreground prose-table:my-5 prose-thead:border-b prose-thead:border-border/50">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4" />,
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto rounded-2xl border border-border/50 bg-background/85">
              <table {...props} className="min-w-full border-collapse text-[14px]" />
            </div>
          ),
          hr: ({ node: _node, ...props }) => <hr {...props} className="border-0 border-t border-border/60" />,
          th: ({ node: _node, ...props }) => <th {...props} className="border-b border-border/50 bg-secondary/35 px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" />,
          td: ({ node: _node, ...props }) => <td {...props} className="border-b border-border/30 px-4 py-3 align-top leading-6" />,
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
