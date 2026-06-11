import Groq from 'groq-sdk';

export interface AiLinkData {
  title: string;
  description: string;
  notes: string;
  category: string;
  tags: string[];
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

export async function generateLinkData(url: string): Promise<AiLinkData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let pageContent = '';
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const html = await response.text();
      pageContent = extractText(html);
    }
  } catch {
    clearTimeout(timeoutId);
  }

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Bạn là trợ lý phân tích trang web và trả về dữ liệu có cấu trúc dạng JSON.
Cho URL và nội dung trang, hãy trả về JSON với đúng các trường sau:
- "title": tiêu đề ngắn gọn, rõ ràng cho trang (tối đa 100 ký tự)
- "description": một câu mô tả trang là gì (tối đa 200 ký tự)
- "notes": 2-3 câu về nội dung trang và lý do hữu ích (tối đa 400 ký tự)
- "category": một nhãn danh mục duy nhất (ví dụ: "Lập trình", "Thiết kế", "Tin tức", "Hướng dẫn", "Công cụ", "Tài liệu", "Video", "Mạng xã hội") — chọn cái phù hợp nhất
- "tags": mảng 3-5 từ khóa lowercase tiếng Anh (ví dụ: ["react", "nextjs", "frontend"])

Luôn trả lời title, description, notes, category bằng tiếng Việt. Tags luôn là từ khóa tiếng Anh viết thường.
Chỉ trả về JSON hợp lệ, không markdown.`,
      },
      {
        role: 'user',
        content: `URL: ${url}\n\n${pageContent ? `Page content:\n${pageContent}` : '(Could not fetch page content)'}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from AI');

  const parsed = JSON.parse(text) as Partial<AiLinkData>;

  return {
    title: String(parsed.title ?? '').slice(0, 100),
    description: String(parsed.description ?? '').slice(0, 200),
    notes: String(parsed.notes ?? '').slice(0, 400),
    category: String(parsed.category ?? '').slice(0, 50),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 5)
      : [],
  };
}
