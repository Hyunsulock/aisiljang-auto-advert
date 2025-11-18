# 자동 업데이트 설정 가이드

이실장 자동화 앱은 GitHub Releases를 통해 자동 업데이트를 지원합니다.

## 설정 완료 사항

✅ `electron-builder.mjs`에 GitHub 설정 완료
✅ `package.json`에 publish 스크립트 추가 완료

## GitHub Token 설정

자동 업데이트를 위해 GitHub Personal Access Token이 필요합니다.

### 1. GitHub Personal Access Token 생성

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)" 클릭
3. 권한 설정:
   - `repo` (전체 체크)
4. 토큰 생성 후 복사

### 2. 환경 변수 설정

터미널에서 다음 명령어 실행 (macOS/Linux):

```bash
export GH_TOKEN="your_github_token_here"
```

Windows (PowerShell):

```powershell
$env:GH_TOKEN="your_github_token_here"
```

또는 `.env` 파일에 추가:

```env
GH_TOKEN=your_github_token_here
```

## 빌드 및 배포

### 1. 로컬 빌드만 (배포 안함)

```bash
npm run compile        # 현재 OS용
npm run compile:mac    # macOS용
npm run compile:win    # Windows용
```

### 2. GitHub Releases에 배포

```bash
npm run publish
# 또는
npm run publish:github
```

이 명령어는 다음을 수행합니다:
1. 앱 빌드
2. GitHub Release 생성
3. 빌드 파일 업로드 (dmg, zip, exe 등)
4. 자동 업데이트를 위한 latest.yml/latest-mac.yml 생성

## 자동 업데이트 작동 방식

1. **앱 시작 시**: AutoUpdater가 GitHub Releases에서 새 버전 확인
2. **새 버전 발견**: 사용자에게 알림 표시
3. **다운로드**: 백그라운드에서 업데이트 다운로드
4. **설치**: 앱 재시작 시 자동 설치

## 버전 관리

버전을 올리려면 `package.json`의 `version` 필드를 수정:

```json
{
  "version": "3.1.0"  // → "3.1.1" 또는 "3.2.0" 등으로 변경
}
```

Semantic Versioning 사용:
- **Major** (1.0.0 → 2.0.0): 하위 호환성 없는 변경
- **Minor** (3.1.0 → 3.2.0): 새 기능 추가 (하위 호환)
- **Patch** (3.1.0 → 3.1.1): 버그 수정

## 배포 워크플로우 예시

```bash
# 1. 버전 업데이트
npm version patch  # 또는 minor, major

# 2. 변경사항 커밋
git add .
git commit -m "chore: release v3.1.1"

# 3. GitHub에 푸시
git push origin main

# 4. 빌드 및 배포
npm run publish

# 5. GitHub Releases에서 Release Notes 작성 (선택사항)
```

## 주의사항

⚠️ **중요**:
- `GH_TOKEN`을 절대 코드나 공개 저장소에 커밋하지 마세요
- 토큰은 안전한 곳에 보관하세요
- CI/CD를 사용한다면 GitHub Secrets에 저장하세요

## 문제 해결

### 업데이트가 작동하지 않는 경우

1. **개발 모드에서는 자동 업데이트가 작동하지 않습니다**
   - 실제 빌드된 앱에서만 작동합니다

2. **"No published versions" 에러**
   - GitHub Releases에 Release가 있는지 확인
   - `latest.yml` 파일이 업로드되었는지 확인

3. **권한 에러**
   - `GH_TOKEN`이 올바르게 설정되었는지 확인
   - 토큰에 `repo` 권한이 있는지 확인

## 참고 자료

- [electron-updater 문서](https://www.electron.build/auto-update)
- [electron-builder 문서](https://www.electron.build/)
- [Semantic Versioning](https://semver.org/lang/ko/)
