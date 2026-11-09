# Skill Vault

GitHub에 흩어진 스킬·플러그인·MCP 서버·오픈소스를 **링크 한 줄로 가져와** 이해하고, 자동으로 분류해 두었다가 **언제든 바로 적용**할 수 있게 해 주는 개인용 웹앱입니다.

서버가 없는 정적 사이트라 **GitHub Pages에 무료로 배포**할 수 있고, 데이터는 브라우저(localStorage)에 저장되며 JSON으로 내보내기/가져오기가 됩니다.

## 기능

| 기능 | 설명 |
| --- | --- |
| 링크 붙여넣기 → 분석 | `https://github.com/owner/repo`, `/tree/<branch>/sub/dir`, `owner/repo` 모두 인식. 붙여넣는 즉시 분석 시작 |
| 종류 자동 감지 | Claude 스킬(SKILL.md), 스킬 모음, Claude 플러그인 / 마켓플레이스, MCP 서버, npm, Python, 일반 저장소 |
| 의존성 파악 | 런타임(Node/Python), 시스템 도구(ffmpeg 등), npm/pip 패키지, MCP 서버, 필요한 환경 변수·API 키 |
| 적용 방법 생성 | `npx degit …` 한 줄 설치, `/plugin marketplace add`, `claude mcp add …`, ZIP 내려받기 |
| 미리보기 | SKILL.md / README 렌더링, 파일 목록, 프론트매터, 포함된 하위 스킬·플러그인 (개별 분석 가능) |
| 자동 분류 | 디자인 / 개발 / AI·에이전트 / 문서·글쓰기 / 데이터·분석 / 생산성·일상 / 데브옵스 / 보안 / 브라우저·자동화 / 마케팅 / 미디어 / 학습 + 사용자 정의 카테고리 |
| 보관함 | 검색, 카테고리·종류·상태 필터, 메모, 상태(써볼 것 / 사용 중 / 보관), 수동 분류 덮어쓰기 |
| 백업 | JSON 내보내기·가져오기(합치기), 예시 서재 33건 불러오기 |

## 개발

```bash
npm install
npm run dev
```

## 배포 (GitHub Pages, 무료)

1. 이 폴더를 GitHub 저장소로 올립니다 (`main` 브랜치).
2. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
3. `main`에 푸시하면 `.github/workflows/deploy.yml`이 빌드해서 `https://<user>.github.io/<repo>/` 에 올립니다.

저장소 이름이 `<user>.github.io`라면 워크플로의 `GITHUB_PAGES_BASE`를 `/`로 바꾸세요.

다른 무료 호스팅(Vercel, Netlify, Cloudflare Pages)도 `npm run build` → `dist/` 를 올리면 됩니다.

## GitHub API 한도

토큰 없이 시간당 60회 요청(분석 1건당 2회 + 파일 읽기는 raw 주소라 무제한)이 가능합니다. 설정에서 개인 토큰(`public_repo` 또는 읽기 전용 fine-grained)을 넣으면 5000회로 늘고 비공개 저장소도 읽습니다. 토큰은 브라우저에만 저장됩니다.

## 확장하기

- **새 종류 추가**: `src/lib/analyzers/detectors.ts`의 `DETECTORS` 배열에 감지기를 하나 추가합니다. 파일 목록을 보고 `SkillAnalysis`를 돌려주면 됩니다. 순서대로 실행되며 먼저 맞는 것이 이깁니다.
- **카테고리 추가**: 설정 화면에서 이름과 키워드로 추가하거나, `src/data/categories.ts`의 기본 규칙을 수정합니다.
- **도구·환경변수 인식**: `src/lib/analyzers/common.ts`의 `KNOWN_TOOLS`, `IGNORED_ENV`.
- **예시 데이터**: `src/data/seed.ts`.
