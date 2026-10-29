# CI 및 통합 배포

## 필요한 CI 작업

1. PR 및 master 변경: npm ci 이후 Svelte/TypeScript 검사, lint, Vitest만 실행.
2. 릴리스 태그: 태그 형식 및 master 포함 여부 검증, 타입 검사, lint, Vitest.
3. 릴리스 태그: Windows/Linux amd64 Tauri 프로덕션 빌드.
4. 릴리스 태그: FreeBSD/OpenBSD amd64 VM 네이티브 빌드 및 tar.gz 패키징.
5. 릴리스 태그: Android 웹 빌드, Capacitor sync, 서명 APK/AAB 빌드.
6. 모든 산출물 누락 검사 및 SHA256SUMS 생성 후 단일 GitHub Release 공개.

PR에서는 웹 빌드와 네이티브 플랫폼 빌드를 실행하지 않습니다.
플랫폼별 빌드는 릴리스 태그에서 한 번씩만 실행합니다.

## 배포 트리거

기본 배포 브랜치는 master입니다. master에 포함된 커밋에
vX.Y.Z 또는 X.Y.Z 태그를 push하면 배포합니다. 브랜치 push만으로는
릴리스를 만들지 않습니다. 태그는 브랜치 정보를 포함하지 않으므로
워크플로에서 master에 포함된 커밋인지 별도로 검사합니다.

```sh
git switch master
git pull --ff-only
git tag v0.1.1
git push origin v0.1.1
```

같은 버전에 v0.1.1과 0.1.1을 중복 생성하지 마세요.
태그 형식은 정수 3개이며 선행 0, prerelease, build metadata는 허용하지 않습니다.
Android versionCode는 major * 1000000 + minor * 1000 + patch입니다.
major는 2099 이하, minor/patch는 999 이하이며 0.0.0은 허용하지 않습니다.
버전은 이전 배포보다 증가시켜야 Android 업데이트가 가능합니다.

## Android 서명 설정

Settings → Secrets and variables → Actions에 다음 repository secrets를 등록하세요.

| Secret                    | 내용                                   |
| ------------------------- | -------------------------------------- |
| ANDROID_KEYSTORE_BASE64   | 배포용 JKS 파일을 base64로 인코딩한 값 |
| ANDROID_KEYSTORE_PASSWORD | JKS 비밀번호                           |
| ANDROID_KEY_ALIAS         | 서명 키 alias                          |
| ANDROID_KEY_PASSWORD      | 키 비밀번호                            |

동일한 키를 계속 사용하고 별도로 백업하세요. 키가 없으면 배포는 실패하며
debug 키로 대체하지 않습니다. PR CI에는 키가 필요 없습니다.
APK와 AAB를 함께 생성하지만 Google Play 업로드는 수행하지 않습니다.

## 배포 파일

- satsight-X.Y.Z-windows-amd64.zip: 실행 파일. WebView2 Runtime 필요.
- satsight-X.Y.Z-linux-amd64.tar.gz: Ubuntu 24.04에서 빌드한 실행 파일.
- satsight-X.Y.Z-freebsd-amd64.tar.gz: FreeBSD 14.3 VM에서 빌드한 실행 파일.
- satsight-X.Y.Z-openbsd-amd64.tar.gz: OpenBSD 8.0 VM에서 빌드한 실행 파일.
- satsight-X.Y.Z-android.apk: 서명된 설치용 APK.
- satsight-X.Y.Z-android.aab: 서명된 앱 번들.
- SHA256SUMS: 모든 파일의 SHA-256.

Unix tar.gz는 시스템 라이브러리를 포함하지 않습니다. Linux에는 GTK3,
WebKitGTK 4.1, appindicator 관련 런타임이 필요합니다. BSD에도 해당 OS의
GTK3/WebKitGTK 4.1 및 연결된 라이브러리가 필요하며, 빌드 OS와 호환되는
버전에서 사용해야 합니다. BSD 압축 파일에는 linked-libraries.txt도 포함합니다.

현재 Tauri 2.x에는 FreeBSD/OpenBSD 조건부 코드가 있습니다. BSD에서는 npm
Tauri CLI 및 설치 패키지 번들러를 사용하지 않고, Linux에서 생성한 정적
프런트엔드를 VM에 전달한 다음 cargo build와 tauri/custom-protocol로
프로덕션 앱을 빌드합니다. BSD 지원은 실제 VM CI 결과로 검증해야 하며,
컴파일 성공이 GUI/카메라/외부 브라우저 기능의 실행 검증을 대신하지 않습니다.

한 플랫폼이라도 실패하면 공개 릴리스는 생성하지 않습니다. 업로드 도중
실패한 경우 draft로 남으며 동일한 실행을 재시도할 수 있습니다. 이미 공개된
릴리스는 덮어쓰지 않습니다. 배포에는 기본 GITHUB_TOKEN의 contents: write만
사용하고 별도 PAT는 필요하지 않습니다.
