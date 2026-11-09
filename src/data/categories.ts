import type { CategoryRule } from '../lib/types'

/**
 * Built-in category rules. Each keyword is matched (case-insensitive) against the item's name,
 * description, tags, topics, README head and file names. Users can add their own rules in
 * Settings; those are merged with these at runtime. A custom rule with the same id as a builtin
 * extends its keyword list.
 */
export const BUILTIN_CATEGORIES: CategoryRule[] = [
  {
    id: 'design',
    label: '디자인',
    builtin: true,
    keywords: ['design', 'ui', 'ux', 'figma', 'tailwind', 'css', 'frontend', 'landing', 'typography', 'palette', 'icon', 'animation', 'shadcn', '디자인', 'brand', 'logo', 'svg', 'illustration', 'visual', 'demo'],
  },
  {
    id: 'dev',
    label: '개발',
    builtin: true,
    keywords: ['code', 'coding', 'developer', 'refactor', 'debug', 'testing', 'typescript', 'javascript', 'rust', 'golang', 'react', 'vue', 'svelte', 'node', 'api', 'sdk', 'library', 'framework', 'lint', 'compile', 'github', 'commit', 'review', '개발', 'programming', 'software', 'backend', 'database', 'sql', 'cli', 'app builder', '앱 빌더', '바이브코딩', 'windows', 'macos', 'swiftui', 'winui', '맥 앱', '윈도우 앱', '코딩'],
  },
  {
    id: 'ai-agent',
    label: 'AI·에이전트',
    builtin: true,
    keywords: ['agent', 'agents', 'llm', 'prompt', 'claude', 'anthropic', 'openai', 'gpt', 'mcp', 'model context protocol', 'rag', 'embedding', 'langchain', 'orchestration', 'subagent', 'autonomous', 'copilot', 'ai', '에이전트', 'skill', 'skills', 'plugin', '플러그인', '스킬', 'codex', 'deepseek', 'gemini', 'ollama', 'hugging face', '온디바이스', '멀티 에이전트', '프록시'],
  },
  {
    id: 'docs-writing',
    label: '문서·글쓰기',
    builtin: true,
    keywords: ['document', 'docs', 'documentation', 'writing', 'markdown', 'pdf', 'docx', 'pptx', 'slides', 'presentation', 'xlsx', 'excel', 'spreadsheet', 'report', 'blog', 'article', 'essay', 'notes', 'obsidian', 'notion', '문서', '글쓰기', 'translation', 'translate', 'grammar', 'proofread', 'summarize', '지식베이스', 'knowledge', '법률', 'law', 'legal', '사무'],
  },
  {
    id: 'data',
    label: '데이터·분석',
    builtin: true,
    keywords: ['data', 'analytics', 'analysis', 'chart', 'visualization', 'dashboard', 'pandas', 'numpy', 'jupyter', 'statistics', 'csv', 'dataset', 'etl', 'metrics', '분석', '데이터', 'scraping', 'crawler', 'ontology', '온톨로지', 'text-to-sql', 'ml', '금융', 'finance', 'trading', '트레이딩', 'terminal'],
  },
  {
    id: 'productivity',
    label: '생산성·일상',
    builtin: true,
    keywords: ['productivity', 'todo', 'task', 'calendar', 'schedule', 'reminder', 'habit', 'journal', 'daily', 'routine', 'email', 'gmail', 'slack', 'memory', 'brain', 'personal', 'life', 'health', 'recipe', 'travel', 'budget', '일상', '생산성', 'planner', '자동화', 'invoice', '비서'],
  },
  {
    id: 'devops',
    label: '데브옵스·배포',
    builtin: true,
    keywords: ['devops', 'deploy', 'deployment', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'github actions', 'pipeline', 'terraform', 'aws', 'gcp', 'azure', 'cloudflare', 'vercel', 'netlify', 'server', 'infra', 'infrastructure', 'monitoring', 'nginx', '배포', 'cloud', '로컬 ai 서버', '서버', 'vm', 'sandbox'],
  },
  {
    id: 'security',
    label: '보안',
    builtin: true,
    keywords: ['security', 'secure', 'vulnerability', 'pentest', 'ctf', 'audit', 'owasp', 'auth', 'oauth', 'encryption', 'secrets', 'malware', 'exploit', '보안', 'privacy', 'compliance', 'osint', 'shodan', '다크웹', '지오로케이션', 'geolocation'],
  },
  {
    id: 'browser-automation',
    label: '브라우저·자동화',
    builtin: true,
    keywords: ['browser', 'chrome', 'playwright', 'puppeteer', 'selenium', 'automation', 'automate', 'bot', 'rpa', 'computer use', '컴퓨터 사용', 'desktop', 'web scraping', 'gui'],
  },
  {
    id: 'marketing',
    label: '마케팅·비즈니스',
    builtin: true,
    keywords: ['marketing', 'seo', 'growth', 'sales', 'crm', 'customer', 'business', 'startup', 'pitch', 'investor', 'social media', 'twitter', 'instagram', 'youtube', 'newsletter', 'ads', '마케팅', 'ecommerce', 'launch', 'entrepreneur'],
  },
  {
    id: 'media',
    label: '미디어·영상',
    builtin: true,
    keywords: ['video', 'audio', 'music', 'podcast', 'speech', 'voice', 'tts', 'whisper', 'ffmpeg', 'image generation', 'stable diffusion', 'photo', 'camera', 'ocr', '영상', '음성', 'subtitle', '숏폼', '녹화', 'screen recording', 'montage', '비디오'],
  },
  {
    id: 'education',
    label: '학습·교육',
    builtin: true,
    keywords: ['learn', 'learning', 'tutorial', 'course', 'teach', 'tutor', 'education', 'study', 'flashcard', 'quiz', 'exam', 'math', 'physics', 'science', 'research', 'paper', 'arxiv', '학습', '교육', '공부', '튜터', '물리', '딥리서치', 'deep research'],
  },
]

export const FALLBACK_CATEGORY: CategoryRule = { id: 'etc', label: '기타', keywords: [], builtin: true }
