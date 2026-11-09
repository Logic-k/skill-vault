import { categorize, allCategories } from '../lib/categorize'
import { parseGitHubUrl } from '../lib/github'
import { skillId } from '../lib/store'
import { detectPricing, detectSiteType, domainOf, faviconFor, normalizeUrl, webId } from '../lib/web'
import type { CategoryRule, SavedSkill, SkillKind } from '../lib/types'

/**
 * 예시 서재: 2026-11-09 기준 "오픈소스 서재 목록" PDF의 33건.
 * GitHub에서 아직 분석하지 않은 상태(analyzedAt 없음)로 들어가며, 카드의 "분석" 버튼으로 실제 분석을 돌릴 수 있다.
 */
interface SeedItem {
  name: string
  url: string
  kind: SkillKind
  license?: string
  stars?: number
  status: 'want' | 'using' | 'archived'
  group: string
  description: string
  note?: string
  reason?: string
  tags: string[]
}

export const SEED_DATE = '2026-11-09'

const ITEMS: SeedItem[] = [
  { name: 'AIMap', url: 'https://github.com/BishopFox/aimap', kind: 'repo', license: 'MIT', status: 'want', group: 'AI 보안', description: '인터넷에 비밀번호 없이 노출된 AI 서버(MCP·Ollama·vLLM 등)를 Shodan으로 찾아 지문·위험 점수·보안 테스트를 하는 플랫폼.', note: '본인 소유·허가받은 대상 전용. 동명의 nuclide-research/aimap(Go 취약점 스캐너)과는 다른 프로젝트. 과제 설명과 일치하는 BishopFox 쪽을 사용.', reason: '2026-10-28 AI 보안 도구 소개글 2번, 본인 서버 점검용', tags: ['AI 서버 보안', 'Shodan', 'MCP', 'Ollama'] },
  { name: 'Netryx (Astra V2)', url: 'https://github.com/sparkyniner/Netryx-Astra-V2-Geolocation-Tool', kind: 'repo', license: 'MIT', status: 'want', group: 'AI 보안 / OSINT', description: '사진 한 장을 스트리트뷰 파노라마와 대조해 정확한 GPS 좌표로 추적하는 로컬 우선 OSINT 지오로케이션 도구(MegaLoc+MASt3R 파이프라인).', note: '본인 정보·본인 서버 점검용. 같은 저자의 구버전 Netryx-OpenSource-Next-Gen-Street-Level-Geolocation은 구버전이라 신버전인 Astra V2를 정식 주소로 사용.', reason: '2026-10-28 AI 보안 도구 소개글 1번, 본인 점검용', tags: ['지오로케이션', 'OSINT', 'AI 보안'] },
  { name: 'VoidAccess', url: 'https://github.com/KatrielMoses/voidaccess', kind: 'repo', license: 'MIT', status: 'want', group: 'AI 보안 / OSINT', description: '한 번의 질의로 다크웹·유출 로그인·지갑·다크웹 언급을 수집해 관계 그래프와 STIX/MISP 등으로 내보내는 셀프호스트 OSINT 플랫폼.', note: '인가받은 보안 연구용. 원작자 Katriel Moses의 저장소가 정식이며, voidaccess/voidaccess 조직 주소와는 구분.', reason: '2026-10-28 AI 보안 도구 소개글 3번', tags: ['OSINT', '다크웹', '보안 연구'] },
  { name: 'ml-intern', url: 'https://github.com/huggingface/ml-intern', kind: 'python-package', license: 'Apache-2.0', status: 'archived', group: 'AI 에이전트 / ML', description: '논문 읽기·데이터셋 탐색·코드 작성·실험·배포까지 해주는 Hugging Face 자율 ML 엔지니어 에이전트.', note: '주의: 저장소가 아카이브됨. 더 이상 유지보수 안 함. "ML Intern has now moved to the HuggingChat repo" 안내 있음.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 3번, 아카이브 상태로 보관", tags: ['ML 에이전트', 'Hugging Face', '아카이브됨'] },
  { name: 'OpenRig', url: 'https://github.com/mvschwarz/openrig', kind: 'repo', license: 'Apache-2.0', status: 'want', group: 'AI 에이전트 / 멀티 에이전트', description: '에이전트 팀을 YAML로 정의해 한 명령으로 부팅하는 멀티 에이전트 하네스. Claude Code와 Codex를 같은 팀으로 관리.', reason: '2026-10-08 공유된 릴, YAML 정의 Claude Code + Codex 팀 도구', tags: ['멀티 에이전트', 'Claude Code', 'Codex'] },
  { name: 'CRAFT', url: 'https://github.com/Yfacine/CRAFT', kind: 'repo', license: 'MIT', stars: 6, status: 'want', group: 'AI 에이전트 / 코딩 에이전트', description: '상용 프로그램의 업무 흐름을 분석하고, 실제 사용 환경에서 대체할 수 있는 복제품을 만드는 작업공간.', reason: '2026-11-07 공유한 깃헙 링크', tags: ['Codex', 'Windows', '복제품', 'CAD', '소방설비'] },
  { name: 'Towards a More Autonomous Agent System', url: 'https://github.com/deepseek-ai/dsh-superagent-prototype', kind: 'repo', license: 'MIT', status: 'want', group: 'AI 에이전트 / 코딩 에이전트', description: 'DeepSeek Harness용 프로액티브 코딩 에이전트 연구 프로토타입. 하나의 GitHub 저장소를 대상으로 GitHub(선택: Feishu) 요청을 듣고 작업 항목을 열어 자기 세션·디렉토리에서 작업한 뒤 PR 등으로 답함. SETUP.md를 코딩 에이전트와 함께 읽으며 설치.', note: '연구용 프로토타입. 프로덕션 아님, 버그 가능. 공식 DeepSeek 제품이 아닌 참고용 연구 코드.', reason: '자율 에이전트 시스템 구조 참고', tags: ['DeepSeek', 'Harness', '코딩 에이전트', '프로액티브 에이전트', 'Feishu'] },
  { name: 'cua', url: 'https://github.com/trycua/cua', kind: 'repo', license: 'MIT', status: 'want', group: 'AI 에이전트 인프라', description: 'AI 에이전트에 쓸 컴퓨터를 주는 인프라. 크로스 OS 드라이버·클라우드 데스크톱 플릿·로컬 VM·벤치마크 모음.', note: '단, Spaces 앱은 FSL-1.1-MIT 소스 공개형.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 7번", tags: ['컴퓨터 사용 에이전트', '에이전트 인프라'] },
  { name: 'ds2api', url: 'https://github.com/CJackHwang/ds2api', kind: 'repo', status: 'want', group: 'API / LLM 미들웨어', description: 'DeepSeek 웹 채팅 기능을 OpenAI/Claude/Gemini 호환 API로 바꿔주는 Go 미들웨어.', note: '비공식 프로젝트, 약관 확인 필요. README에 LICENSE 파일 존재 언급만 있고 라이선스명 직접 표기 없음. 포크(v5china/ds2api) 표기는 AGPL-3.0, README는 상업 사용 전 LICENSE 확인·저자 허락 필요 명시.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 5번, 비공식이라 약관 확인 필요", tags: ['DeepSeek', 'API', '비공식'] },
  { name: 'CLI-Anything', url: 'https://github.com/HKUDS/CLI-Anything', kind: 'repo', license: 'Apache-2.0', stars: 52109, status: 'want', group: 'CLI / AI 에이전트', description: 'GUI 앱을 전용 CLI + SKILL.md로 만드는 도구. 7단계 파이프라인, Claude Code·Codex 지원, Blender·Godot·Obsidian 등 하네스 보유.', note: '2026-03 공개.', reason: '2026-10-14 공유한 관심 프로젝트', tags: ['CLI', 'SKILL.md', 'Claude Code', 'Codex'] },
  { name: 'Replica', url: 'https://github.com/Jakeschincariol/replica-skill', kind: 'skill-collection', license: 'MIT', stars: 2800, status: 'want', group: 'Claude Code 스킬', description: 'Claude 스킬 11종 묶음(recon→architect→design→build→backend→test→diff→entrepreneur→brand→launch→deploy). 인기 앱을 개선해 클론처럼 다시 만드는 흐름.', note: 'Claude Code 플러그인 설치, Codex 미보장. 원본 모방 시 앱스토어 심사 차단 주의.', reason: '2026-10-09, 10-10, 10-16 세 차례 공유한 관심 프로젝트', tags: ['Claude Code', '스킬', '클론 앱'] },
  { name: 'Stageshow', url: 'https://github.com/benjitaylor/skills', kind: 'skill-collection', license: 'MIT', stars: 2254, status: 'want', group: 'Claude Code 스킬', description: 'AI가 만든 제품 UI의 어설픔을 잡고, 완성된 데모를 영상으로 찍어 스스로 고치는 자기검증 스킬.', reason: '2026-11-07 인스타 캐러셀, X 디자인 총괄 Benji Taylor의 무료 UI 스킬', tags: ['Claude Code', 'Codex', 'UI', '디자인', '데모'] },
  { name: 'BAMA (Build Any Mac App)', url: 'https://github.com/daveebbelaar/bama', kind: 'claude-marketplace', license: 'MIT', stars: 1507, status: 'want', group: 'Claude Code 플러그인 / 맥 앱 빌더', description: '말로 시키면 Swift/SwiftUI 네이티브 맥 앱을 만들어 Dock에 올려 주는 Claude Code 플러그인. 스킬 21개가 대상 앱 전 화면 스크린샷→기능 체크리스트→단계별 빌드, 커밋 전 전 화면 라이트/다크 모드 스냅샷 확인.', note: 'macOS 26 이상·Xcode 26 이상 필요, 윈도우에서는 못 쓰고 맥북 에어 M1에서만 가능. 윈도우용 대안은 같은 제작자의 BAWA. 타 앱 화면 가져오기(클론)는 Claude Pro/Max 컴퓨터 사용 필요, 클론 앱은 개인용으로만 쓸 것. 설치: /plugin marketplace add daveebbelaar/bama → /plugin install bama@bama → /bama. 2026-10-24 공개, 커밋 11개로 초기 단계.', reason: '2026-11-03 공유한 릴, 말로 맥 앱을 만드는 플러그인', tags: ['Claude Code', '맥 앱', 'SwiftUI', '플러그인'] },
  { name: 'Anthropic knowledge-work-plugins', url: 'https://github.com/anthropics/knowledge-work-plugins', kind: 'claude-marketplace', license: 'Apache-2.0', stars: 32000, status: 'want', group: 'Claude Code 플러그인 / 사무 자동화', description: '사무직 AI 비서 플러그인 모음. 11개에서 123개로 확대, 슬랙·피그마·아마존·캔바·어도비 등 직접 플러그인 제공. 문서(.md) 1,173개·코드 27개로 일하는 법을 글로 적은 형태, 스킬 44개, invoice-chase(미수금 독촉 메일 초안) 예시.', note: 'Claude Cowork나 Claude Code(유료) 필요. 연동 회계 프로그램은 QuickBooks·Xero·NetSuite 등 해외 서비스. 교육청 업무자동화 관심과 연결.', reason: '2026-10-26 인스타 릴로 공유한 관심 프로젝트', tags: ['Claude Code', '사무 자동화', '플러그인'] },
  { name: 'BAWA (Build Any Windows App)', url: 'https://github.com/daveebbelaar/bawa', kind: 'claude-marketplace', license: 'MIT', stars: 14, status: 'want', group: 'Claude Code 플러그인 / 윈도우 앱 빌더', description: '말로 시키면 C# + WinUI 3 네이티브 윈도우 앱을 만들어 작업 표시줄에 올려 주는 Claude Code 플러그인. BAMA의 윈도우용 형제 프로젝트. 스킬 22개가 마음에 드는 앱 화면 촬영(클론)→사용자 스토리→한 스토리씩 커밋하며 빌드, 커밋 전 라이트/다크 모드 스냅샷 확인.', note: 'Windows 11 필요(Windows 10 2004 이후도 앱 실행은 가능, Mica 제외). .NET 10 SDK 필요(winget install Microsoft.DotNet.SDK.10), Visual Studio 불필요. 설치: /plugin marketplace add daveebbelaar/bawa → /plugin install bawa@bawa → /bawa. 클론 앱은 개인용으로만 쓸 것. 2026-10-29 공개, 커밋 9개로 초기 단계. 주력 윈도우 머신(갤럭시북4 프로)에서 쓸 수 있는 BAMA 대안.', reason: 'BAMA의 윈도우용 대안. 주력 윈도우 머신에서 쓸 수 있어 BAMA보다 실용적', tags: ['BAMA', 'Claude Code', '윈도우 앱', 'WinUI 3', 'C#'] },
  { name: 'auto-ontology-mcp', url: 'https://github.com/gogoymh/auto-ontology-mcp', kind: 'mcp-server', license: 'Apache-2.0', stars: 18, status: 'want', group: 'MCP / 데이터 · 지식베이스', description: 'NVIDIA Auto Ontology의 시맨틱 레이어를 Claude, ChatGPT 등 MCP 클라이언트용 MCP 서버로 가져온 프로젝트. LLM API 키 불필요. 데이터베이스에 질문하기(온톨로지 기반으로 조인·SQL 검증) + 개인 지식베이스 유지(영수증·명세서·논문·책 노트를 사실·연결된 개념·출처와 함께 저장, Obsidian vault로 내보내기).', note: 'Python 3.12+, uv 필요. Claude Code 설치: claude mcp add auto-ontology -- uvx --from git+https://github.com/gogoymh/auto-ontology-mcp auto-ontology-mcp. 2026-11-06 생성, 커밋 1개로 아주 초기 단계.', reason: '2026-11-07 서재에 직접 추가 요청한 저장소', tags: ['MCP', '온톨로지', 'text-to-SQL', '지식베이스', 'NVIDIA', 'Obsidian'] },
  { name: 'korean-law-mcp', url: 'https://github.com/chrisryugj/korean-law-mcp', kind: 'mcp-server', license: 'MIT', stars: 2700, status: 'want', group: 'MCP / 법률', description: '법제처 Open API 기반 MCP 서버. 법령·판례·행정규칙·자치법규·조약·해석례 검색 + 인용 검증·판례 생사 확인·행위시법 판단.', note: '법제처 Open API 인증키(OC) 무료 발급 필요(open.law.go.kr). Claude Code는 플러그인 2줄 설치가 가장 쉬움, Claude.ai 웹은 커넥터 URL 방식, Codex 미보장.', reason: '2026-10-17 공유한 관심 프로젝트', tags: ['MCP', '법제처', '법률 검색'] },
  { name: 'DeepTutor', url: 'https://github.com/HKUDS/DeepTutor', kind: 'repo', license: 'Apache-2.0', status: 'want', group: '교육 / AI 튜터', description: '채팅 튜터링·퀴즈·리서치·시각화·마스터리 경로를 한 앱에 모은 에이전트 네이티브 평생 개인 튜터링 워크스페이스.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 9번", tags: ['AI 튜터', '교육'] },
  { name: 'Every Joule (Lesson 1만 확인)', url: 'https://github.com/iamtechartist/every-joule-lesson1', kind: 'repo', status: 'want', group: '교육 / 인터랙티브 책', description: '에너지 주제 인터랙티브 3D 물리 책(스프링부터 발전소까지 10개 레슨, 브라우저에서 동작).', note: '부분 확인: 책 전체를 담은 저장소는 찾지 못함. 확인된 것은 Lesson 1만 담은 저장소뿐이며, 나머지 9개 레슨의 저장소는 검색에서 나오지 않음. 공식 사이트는 iamtechartist.com/every-joule/ 로 보이나 GitHub URL로 대체하지 않음.', reason: '2026-10-25 공유한 관심 프로젝트, 전체 책 저장소는 미확인이라 Lesson 1만 부분 기록', tags: ['물리', '인터랙티브 3D', '교육'] },
  { name: 'FinceptTerminal', url: 'https://github.com/Fincept-Corporation/FinceptTerminal', kind: 'repo', license: 'AGPL-3.0', status: 'want', group: '금융 / 트레이딩', description: '블룸버그 스타일 무료 금융 터미널. CFA급 분석·100+ 데이터 커넥터·37개 AI 에이전트, C++20/Qt6 데스크톱 앱.', note: 'Enterprise판은 별도 유료.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 2번", tags: ['금융 터미널', '트레이딩', '블룸버그 대안'] },
  { name: 'Multi-agent deep research for Claude Code', url: 'https://github.com/fivetaku/insane-research', kind: 'claude-plugin', license: 'MIT', status: 'want', group: '딥리서치 / Claude Code 플러그인', description: 'Claude Code용 멀티 에이전트 딥리서치 플러그인. 7단계 파이프라인(질문 범위 설정→검색 계획→병렬 조회→출처 삼각검증→종합→품질검증→출력). 3-5개 에이전트 병렬 실행, 출처 품질 등급 A-E, 핵심 주장은 2개 이상 독립 출처로 교차 검증, 인용 필수로 환각 방지. 요약·전체 보고서·서지·선택적 인터랙티브 웹사이트 출력.', note: '설치: /plugin marketplace add https://github.com/fivetaku/gptaku_plugins.git 후 /plugin install insane-research, 명령어 /insane-research [주제]. 필요: Claude Code CLI.', reason: '멀티 에이전트 딥리서치 파이프라인 참고', tags: ['Claude Code', '딥리서치', '멀티에이전트', '플러그인'] },
  { name: 'ODS (Osmantic Deployment System)', url: 'https://github.com/osmantic-ods/ods', kind: 'repo', license: 'Apache-2.0 배지 / MIT LICENSE 표기 혼재', stars: 6, status: 'want', group: '로컬 AI 서버', description: 'PC/Mac/Linux를 로컬 AI 서버로 바꾸는 스택 설치기. Open WebUI·llama-server·n8n·ComfyUI·Qdrant 등 미리 연결.', note: '주의: 홍보 이미지는 스타 7천개라 하지만 실제 다운로드 저장소는 스타 6개, 라이선스 표기도 혼재. 사용 전 원본 확인 필요. 사용자 하드웨어(갤럭시북4 프로 내장 GPU·M1 에어 8GB)로는 소형 모델(Qwen3.5 2B / Phi-4 Mini 급)만 현실적.', reason: '2026-10-15 공유한 관심 프로젝트, 홍보 수치와 실제 저장소 수치 불일치 주의', tags: ['로컬 AI 서버', 'Open WebUI', 'n8n', 'ComfyUI'] },
  { name: 'Dyad', url: 'https://github.com/dyad-sh/dyad', kind: 'npm-package', license: 'Apache-2.0', stars: 21759, status: 'want', group: '앱 빌더 / 바이브코딩', description: '말로 화면을 설명하면 앱 코드가 내 컴퓨터 폴더에 생성되는 오픈소스 앱 빌더. Lovable 대안. Supabase 연결 시 로그인·DB 연동. 윈도우·맥·리눅스 지원, 가입 없이 실행.', note: 'AI 연결은 직접 설정해야 함. 클로드 구독 연동은 실험 기능, 무료 Gemini 키나 로컬 모델(Ollama·LM Studio)도 가능. 최신 정식 v1.18.0 (2026-10-08 기준).', reason: '2026-10-09 인스타 릴로 공유한 관심 프로젝트', tags: ['앱 빌더', '바이브코딩', 'Lovable 대안', 'Supabase'] },
  { name: 'agent-town', url: 'https://github.com/geezerrrr/agent-town', kind: 'repo', license: 'MIT', stars: 259, status: 'want', group: '에이전트 시각화', description: '이름이 정확히 AgentTown인 저장소. OpenClaw 기반 픽셀 RPG 오피스 형태로 에이전트 작업을 보여줌.', note: '주의: 영상 속 심시티형 화면과는 기능이 다름. YehudaLevi/agentcity와 구분해서 볼 것.', reason: '2026-11-05 공유한 AI 에이전트 시각화 도구 글, 이름 그대로의 AgentTown', tags: ['AgentTown', '에이전트 시각화', '픽셀 오피스'] },
  { name: 'agentcity', url: 'https://github.com/YehudaLevi/agentcity', kind: 'repo', license: 'MIT', stars: 1, status: 'want', group: '에이전트 시각화', description: '심시티형 에이전트 시각화. 레포=건물·작업 종류=구역 콘셉트로, 파일→건물·폴더→구역으로 도시를 그려 에이전트 작업을 한눈에 보여줌.', note: '주의: 이름이 같은 저장소가 여러 개라 구분 필요. 영상 속 심시티형(밤의 도시) 화면은 이 agentcity 콘셉트와 가장 가깝고, 이름이 정확히 AgentTown인 저장소(geezerrrr/agent-town)는 픽셀 RPG 오피스로 기능이 다름. 설치 전 원본 README 대조 필요.', reason: '2026-11-05 공유한 AI 에이전트 시각화 도구 글 2번 화면과 가장 가까운 저장소', tags: ['AgentTown', '에이전트 시각화', '심시티'] },
  { name: 'claude-office', url: 'https://github.com/toplainsoft/claude-office', kind: 'npm-package', license: 'MIT', stars: 23, status: 'want', group: '에이전트 시각화', description: 'Claude Code(+Codex) 작업을 브라우저 속 미니어처 사무실 캐릭터로 보여주는 로컬 도구. ~/.claude/projects/*.jsonl을 0.25초마다 읽어 방(자료실·개발실·서버실·정보검색실·회의실·휴게실)으로 캐릭터 이동, 질문 시 대표실로 엘리베이터.', note: 'localhost:4777, 토큰·패키지 설치 없음, Node.js 18+만 필요. Codex는 ~/.codex/sessions 자동 인식. 신생(2026-10-21 공개, 커밋 3개)이라 완성도 미검증. 한국 제작.', reason: '2026-10-22 공유한 관심 프로젝트', tags: ['에이전트 시각화', 'Claude Code', 'Codex'] },
  { name: 'whatsmyagentdoing', url: 'https://github.com/Charonyuu/whatsmyagentdoing', kind: 'npm-package', license: 'MIT', stars: 377, status: 'want', group: '에이전트 시각화', description: '로컬에서 돌아가는 Claude Code, Codex, Gemini CLI 등의 세션을 작은 오피스로 보여주는 스킬. 일하는 에이전트는 책상에 앉아 생각·타이핑하고, 도움이 필요하면 일어나서 손을 흔듦.', note: 'Node 18+, /myoffice. 2026-10-23 생성.', reason: '2026-11-05 공유한 AI 에이전트 시각화 도구 글 1번', tags: ['에이전트 시각화', '오피스'] },
  { name: 'openscreen', url: 'https://github.com/getopenscreen/openscreen', kind: 'repo', license: 'MIT', status: 'want', group: '영상 / 화면 녹화', description: '화면 녹화 후 커서를 따라 자동 줌·자막·주석을 넣어 데모 영상을 완성하는 무료 데스크톱 앱.', note: '원본 siddharthvaddem/openscreen은 v1.5.0 이후 아카이브됐고, 현재 개발은 원작자 승인 하에 getopenscreen/openscreen에서 계속됨.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 4번", tags: ['데모 영상', '화면 녹화'] },
  { name: 'Pixelle-Video', url: 'https://github.com/ATH-MaaS/Pixelle-Video', kind: 'repo', license: 'Apache-2.0', status: 'want', group: '영상 생성 / AI 비디오', description: '주제만 입력하면 대본·AI 이미지/영상·음성·BGM까지 자동 생성해 숏폼을 완성하는 도구.', note: '조직명이 AIDC-AI에서 ATH-MaaS로 변경됨. 구 주소는 리다이렉트되므로 현행 ATH-MaaS 주소를 사용.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 1번", tags: ['숏폼', '영상 자동 생성', 'AI 비디오'] },
  { name: 'OpenMontage', url: 'https://github.com/calesthio/OpenMontage', kind: 'repo', license: 'AGPL-3.0', status: 'want', group: '영상 제작 / AI 에이전트', description: 'AI 코딩 어시스턴트를 영상 제작 스튜디오로 바꾸는 에이전트형 영상 제작 시스템. 12개 파이프라인, 리서치·대본·소재·편집·렌더까지.', reason: '2026-10-03 공유한 릴에 나온 AI 개발 도구', tags: ['영상 제작', 'AI 에이전트'] },
  { name: 'HeyPuter/everything', url: 'https://github.com/HeyPuter/everything', kind: 'repo', license: 'MIT', stars: 7103, status: 'want', group: '오픈소스 모음', description: "유료 앱들의 무료 오픈소스판 51개 모음. 9개 분야, 브라우저 'Try it' 링크로 바로 사용 가능.", note: '로컬은 Git+Node.js 22.12+ 필요. 2026-10-13 생성, 11/4 기준 스타 7,103개·포크 738개.', reason: '2026-10-19와 2026-11-04 두 차례 공유한 동일 프로젝트', tags: ['오픈소스 대안', '유료 앱 대체'] },
  { name: 'LiteRT-LM', url: 'https://github.com/google-ai-edge/LiteRT-LM', kind: 'repo', license: 'Apache-2.0', status: 'want', group: '온디바이스 AI', description: 'Google의 온디바이스 LLM 실행 오케스트레이션 레이어. Gemma 등 소형 모델을 Android/iOS/데스크톱/IoT에서 GPU/NPU 가속으로 실행.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 6번", tags: ['온디바이스 LLM', 'Gemma', 'Google'] },
  { name: 'free-claude-code', url: 'https://github.com/Alishahryar1/free-claude-code', kind: 'repo', license: 'AGPL-3.0-only', status: 'want', group: '코딩 에이전트 / 프록시', description: 'Claude Code 등 12개 코딩 에이전트를 Anthropic이 아닌 61개 제공자(무료 티어·로컬 포함) 모델로 연결하는 로컬 프록시·런처.', note: '비공식 프로젝트, Anthropic과 무관. 무료 Claude 모델을 주는 것이 아님. 약관 확인 필요.', reason: "2026-10-25 '모르면 손해보는 오픈소스 9가지' 8번, 비공식이라 약관 확인 필요", tags: ['Claude Code', '프록시', '비공식'] },
]

interface WebSeed {
  name: string
  url: string
  description: string
  group: string
  tags: string[]
  pricing?: 'free' | 'freemium' | 'paid'
}

/** AI 웹사이트 예시. GitHub 항목과 달리 "열어서 쓰는" 서비스들이라 사이트 유형·가격 축으로 분류된다. */
const WEB_ITEMS: WebSeed[] = [
  { name: 'Perplexity', url: 'https://www.perplexity.ai', description: '출처를 달아 답하는 AI 검색 엔진. 리서치 초안 잡을 때.', group: '검색·리서치', tags: ['검색', '출처'], pricing: 'freemium' },
  { name: 'NotebookLM', url: 'https://notebooklm.google.com', description: '내 자료(PDF·링크·유튜브)만 근거로 요약·질문·오디오 개요를 만들어 주는 Google 노트.', group: '검색·리서치', tags: ['자료 기반', 'Google'], pricing: 'free' },
  { name: 'Claude', url: 'https://claude.ai', description: 'Anthropic의 어시스턴트. 긴 문서 분석과 코드, 아티팩트 제작에 강함.', group: '챗봇·어시스턴트', tags: ['Anthropic'], pricing: 'freemium' },
  { name: 'ChatGPT', url: 'https://chatgpt.com', description: 'OpenAI의 범용 챗봇. 이미지 생성·웹 검색·데이터 분석 통합.', group: '챗봇·어시스턴트', tags: ['OpenAI'], pricing: 'freemium' },
  { name: 'Hugging Face', url: 'https://huggingface.co', description: '오픈 모델·데이터셋·데모(Spaces) 허브. 모델 찾기와 테스트의 출발점.', group: '모델 허브·API·플랫폼', tags: ['오픈 모델', 'Spaces'], pricing: 'freemium' },
  { name: 'OpenRouter', url: 'https://openrouter.ai', description: '한 API 키로 수백 개 모델을 골라 쓰는 라우터. 무료 모델도 섞여 있음.', group: '모델 허브·API·플랫폼', tags: ['API', '모델 비교'], pricing: 'freemium' },
  { name: 'v0', url: 'https://v0.app', description: '말로 설명하면 React·Tailwind UI를 만들어 주는 Vercel의 생성 도구.', group: '코딩·앱 빌더', tags: ['UI 생성', 'Vercel'], pricing: 'freemium' },
  { name: 'Lovable', url: 'https://lovable.dev', description: '채팅으로 풀스택 웹앱을 만들고 바로 배포하는 앱 빌더.', group: '코딩·앱 빌더', tags: ['바이브코딩'], pricing: 'freemium' },
  { name: 'Midjourney', url: 'https://www.midjourney.com', description: '스타일 품질이 높은 이미지 생성. 웹 에디터로 변형·확장 가능.', group: '이미지 생성·편집', tags: ['이미지 생성'], pricing: 'paid' },
  { name: 'Ideogram', url: 'https://ideogram.ai', description: '글자가 정확하게 들어가는 이미지 생성. 포스터·로고 시안에 유용.', group: '이미지 생성·편집', tags: ['타이포그래피'], pricing: 'freemium' },
  { name: 'ElevenLabs', url: 'https://elevenlabs.io', description: '자연스러운 음성 합성·복제·더빙. 한국어 지원.', group: '음성·음악', tags: ['TTS', '더빙'], pricing: 'freemium' },
  { name: 'Suno', url: 'https://suno.com', description: '가사와 분위기만 적으면 완성곡을 만들어 주는 음악 생성.', group: '음성·음악', tags: ['음악 생성'], pricing: 'freemium' },
  { name: 'Runway', url: 'https://runwayml.com', description: '텍스트·이미지에서 영상을 만들고 편집하는 영상 생성 스튜디오.', group: '영상 생성·편집', tags: ['영상 생성'], pricing: 'freemium' },
  { name: 'Gamma', url: 'https://gamma.app', description: '개요만 주면 발표 자료·문서·웹페이지를 디자인까지 만들어 주는 도구.', group: '디자인·프레젠테이션', tags: ['발표 자료'], pricing: 'freemium' },
  { name: 'Napkin', url: 'https://www.napkin.ai', description: '글을 붙여넣으면 어울리는 도식·그래픽을 자동으로 그려 주는 시각화 도구.', group: '디자인·프레젠테이션', tags: ['도식', '시각화'], pricing: 'freemium' },
  { name: "There's An AI For That", url: 'https://theresanaiforthat.com', description: '용도별 AI 도구 디렉터리. 새 도구 찾을 때 먼저 보는 곳.', group: '뉴스·커뮤니티·디렉터리', tags: ['디렉터리'], pricing: 'free' },
  { name: 'Anthropic 프롬프트 라이브러리', url: 'https://docs.anthropic.com/en/resources/prompt-library/library', description: '용도별로 다듬어진 시스템 프롬프트 모음. 그대로 복사해 쓰거나 변형.', group: '프롬프트·템플릿', tags: ['프롬프트'], pricing: 'free' },
  { name: 'LMArena', url: 'https://lmarena.ai', description: '익명 모델 두 개를 비교 투표해 만든 리더보드. 모델 고를 때 참고.', group: '모델 허브·API·플랫폼', tags: ['벤치마크', '리더보드'], pricing: 'free' },
]

function buildWebSeed(rules: CategoryRule[]): SavedSkill[] {
  return WEB_ITEMS.map((it, i) => {
    const u = normalizeUrl(it.url)!
    const domain = domainOf(u)
    const corpus = `${domain} ${it.name} ${it.description} ${it.tags.join(' ')} ${it.group}`
    const base = {
      kind: 'website' as const,
      name: it.name,
      description: it.description,
      dependencies: [],
      install: [{ title: '바로 열기', note: u.toString() }],
      entryFiles: [],
      tags: [...it.tags, `서재:${it.group}`],
      files: [],
      warnings: [],
    }
    const meta = { fullName: domain, description: it.description, defaultBranch: '', stars: 0, license: null, homepage: u.toString(), language: null, topics: [], pushedAt: '' }
    return {
      ...base,
      id: webId(u),
      source: { owner: domain, repo: '', path: '', url: u.toString() },
      resolvedRef: '',
      meta,
      categories: categorize(base, meta, rules),
      status: 'want' as const,
      web: { url: u.toString(), domain, favicon: faviconFor(domain), siteType: detectSiteType(domain, u.pathname, corpus), pricing: it.pricing ?? detectPricing(corpus), fetchedWith: 'manual' as const },
      addedAt: new Date(Date.parse(SEED_DATE) + (ITEMS.length + WEB_ITEMS.length - i) * 1000).toISOString(),
    }
  })
}

export function buildSeed(customCategories: CategoryRule[]): SavedSkill[] {
  const rules = allCategories(customCategories)
  const web = buildWebSeed(rules)
  const gh = ITEMS.map((it, i) => {
    const src = parseGitHubUrl(it.url)!
    const base = {
      kind: it.kind,
      name: it.name,
      description: it.description,
      dependencies: [],
      install: [{ title: '아직 분석 전', note: '카드의 "GitHub에서 분석" 버튼을 누르면 설치 방법과 의존성을 읽어 옵니다.' }],
      entryFiles: [],
      tags: [...it.tags, `서재:${it.group}`],
      files: [],
      warnings: [],
    }
    const meta = { fullName: `${src.owner}/${src.repo}`, description: null, defaultBranch: 'main', stars: it.stars ?? 0, license: it.license ?? null, homepage: null, language: null, topics: [], pushedAt: '' }
    const note = [it.note && `참고/주의: ${it.note}`, it.reason && `저장한 이유: ${it.reason}`].filter(Boolean).join('\n')
    return {
      ...base,
      id: skillId(src.owner, src.repo, src.path),
      source: src,
      resolvedRef: 'main',
      meta,
      categories: categorize({ ...base, note }, meta, rules),
      note,
      status: it.status,
      addedAt: new Date(Date.parse(SEED_DATE) + (ITEMS.length - i) * 1000).toISOString(),
    }
  })
  return [...gh, ...web]
}
