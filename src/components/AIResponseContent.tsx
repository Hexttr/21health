import React from 'react';
import ReactMarkdown from 'react-markdown';

type AIResponseContentProps = {
  content: string;
};

function looksLikeHeading(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 72) return false;
  if (/^#{1,6}\s/.test(trimmed)) return false;
  if (/^[-*•]\s/.test(trimmed)) return false;
  if (/^\d+\.\s/.test(trimmed)) return false;
  if (/[.!?;:]$/.test(trimmed)) return false;
  if (!nextLine || !nextLine.trim()) return false;
  return true;
}

function preprocessAIContent(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
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

    output.push(line);
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function AIResponseContent({ content }: AIResponseContentProps) {
  const prepared = preprocessAIContent(content);

  return (
    <div className="prose prose-sm max-w-none text-[14px] leading-7 text-foreground prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-strong:text-foreground prose-headings:mb-3 prose-headings:mt-6 prose-headings:font-serif prose-headings:text-[15px] prose-headings:font-semibold prose-h3:border-l-2 prose-h3:border-primary/30 prose-h3:pl-3 prose-code:rounded prose-code:bg-secondary/70 prose-code:px-1.5 prose-code:py-0.5 prose-pre:rounded-2xl prose-pre:border prose-pre:border-border/50 prose-pre:bg-secondary/70 prose-blockquote:border-primary/30 prose-blockquote:bg-primary/5 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:text-foreground">
      <ReactMarkdown
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4" />,
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto rounded-xl border border-border/50 bg-background/80">
              <table {...props} className="min-w-full border-collapse text-sm" />
            </div>
          ),
          th: ({ node: _node, ...props }) => <th {...props} className="border-b border-border/50 bg-secondary/40 px-3 py-2 text-left font-medium" />,
          td: ({ node: _node, ...props }) => <td {...props} className="border-b border-border/30 px-3 py-2 align-top" />,
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
