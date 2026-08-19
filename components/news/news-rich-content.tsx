import Image from "next/image"
import type { ReactNode } from "react"

type Block =
  | { type: "h2" | "h3" | "p" | "quote"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "image"; url: string; alt: string }

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i += 1
      continue
    }

    const imageMatch = line.match(/^!\[(.*)\]\((https?:\/\/[^)]+)\)$/)
    if (imageMatch) {
      blocks.push({ type: "image", alt: imageMatch[1] || "Article image", url: imageMatch[2] })
      i += 1
      continue
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() })
      i += 1
      continue
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() })
      i += 1
      continue
    }
    if (line.startsWith("> ")) {
      blocks.push({ type: "quote", text: line.slice(2).trim() })
      i += 1
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""))
        i += 1
      }
      blocks.push({ type: "ul", items })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""))
        i += 1
      }
      blocks.push({ type: "ol", items })
      continue
    }

    const paragraphLines = [line]
    i += 1
    while (i < lines.length) {
      const candidate = lines[i].trim()
      if (!candidate) break
      if (/^(##|###|> |[-*]\s+|\d+\.\s+|!\[)/.test(candidate)) break
      paragraphLines.push(candidate)
      i += 1
    }
    blocks.push({ type: "p", text: paragraphLines.join(" ") })
  }

  return blocks
}

function renderInline(text: string, keyPrefix: string) {
  const parts: ReactNode[] = []
  let rest = text
  let i = 0
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^)]+)\))/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(rest)) !== null) {
    const idx = match.index
    const token = match[0]
    if (idx > 0) parts.push(rest.slice(0, idx))

    if (token.startsWith("**")) {
      parts.push(<strong key={`${keyPrefix}-b-${i++}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith("*")) {
      parts.push(<em key={`${keyPrefix}-i-${i++}`}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
      if (link) {
        parts.push(
          <a
            key={`${keyPrefix}-a-${i++}`}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 underline underline-offset-2"
          >
            {link[1]}
          </a>,
        )
      } else {
        parts.push(token)
      }
    }

    rest = rest.slice(idx + token.length)
    pattern.lastIndex = 0
  }
  if (rest) parts.push(rest)
  return parts
}

export function NewsRichContent({ content }: { content: string }) {
  const blocks = parseBlocks(content)
  return (
    <div className="space-y-4 text-slate-100">
      {blocks.map((block, index) => {
        if (block.type === "h2") return <h2 key={index} className="pt-4 text-2xl font-extrabold">{renderInline(block.text, `h2-${index}`)}</h2>
        if (block.type === "h3") return <h3 key={index} className="pt-2 text-xl font-bold">{renderInline(block.text, `h3-${index}`)}</h3>
        if (block.type === "quote") return <blockquote key={index} className="border-l-4 border-red-600 bg-white/5 px-4 py-3 italic text-slate-200">{renderInline(block.text, `q-${index}`)}</blockquote>
        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-6">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `ul-${index}-${itemIndex}`)}</li>)}
            </ul>
          )
        }
        if (block.type === "ol") {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-6">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `ol-${index}-${itemIndex}`)}</li>)}
            </ol>
          )
        }
        if (block.type === "image") {
          return (
            <div key={index} className="relative aspect-[16/9] overflow-hidden rounded-xl border border-white/10">
              <Image src={block.url} alt={block.alt} fill className="object-cover" />
            </div>
          )
        }
        return <p key={index} className="leading-7 text-slate-200">{renderInline(block.text, `p-${index}`)}</p>
      })}
    </div>
  )
}
